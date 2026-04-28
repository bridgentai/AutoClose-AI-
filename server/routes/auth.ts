import express from 'express';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env.js';
import { findUserByEmail, findUserById, findUserByInternalCodeAny, createUser, updateUser, readAuthSessionVersion, bumpAuthSessionVersion } from '../repositories/userRepository.js';
import { toAuthResponse } from '../mappers/userMapper.js';
import { findInstitutionCodeByCode, findInstitutionCodesByInstitution } from '../repositories/institutionCodeRepository.js';
import { resolveGroupId } from '../utils/resolveLegacyCourse.js';
import { getFirstGroupNameForStudent } from '../repositories/enrollmentRepository.js';
import { findActiveAcademicPeriodForInstitution } from '../repositories/academicPeriodRepository.js';
import { createEnrollment } from '../repositories/enrollmentRepository.js';
import { findInstitutionById, findInstitutionBySlug, findAllInstitutions } from '../repositories/institutionRepository.js';
import { generateUserId } from '../utils/idGenerator.js';
import { getClientIP } from '../middleware/auditMiddleware.js';
import { createActivityLog } from '../repositories/activityLogRepository.js';
import rateLimit from 'express-rate-limit';
import { protect, type AuthRequest, invalidateUserAuthCache } from '../middleware/auth.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function resolveInstitutionId(colegioId: string): Promise<string> {
  if (UUID_REGEX.test(colegioId)) {
    const inst = await findInstitutionById(colegioId);
    if (inst) return inst.id;
  }
  const bySlug = await findInstitutionBySlug(colegioId.toLowerCase());
  if (bySlug) return bySlug.id;
  const all = await findAllInstitutions();
  if (all.length > 0) return all[0].id;
  return colegioId;
}

const router = express.Router();
const TOKEN_EXPIRES = process.env.JWT_EXPIRY ?? '8h';

if (!ENV.JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado');
}

const signSecret = ENV.JWT_SECRET as Secret;
const accessSignOptions: SignOptions = { expiresIn: TOKEN_EXPIRES as SignOptions['expiresIn'] };
const refreshSignOptions: SignOptions = { expiresIn: ENV.JWT_REFRESH_EXPIRES as SignOptions['expiresIn'] };

const generateAccessToken = (id: string, sv: number) =>
  jwt.sign({ id, sv }, signSecret, accessSignOptions);

const generateRefreshToken = (id: string, sv: number) =>
  jwt.sign({ id, sv, tokenUse: 'refresh' }, signSecret, refreshSignOptions);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => ENV.LOAD_TEST_DISABLE_AUTH_RATE_LIMIT,
  message: { message: 'Demasiados intentos de inicio de sesión. Espera unos minutos.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => ENV.LOAD_TEST_DISABLE_AUTH_RATE_LIMIT,
  message: { message: 'Demasiados registros desde esta red. Intenta más tarde.' },
});

const authRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => ENV.LOAD_TEST_DISABLE_AUTH_RATE_LIMIT,
  message: { message: 'Demasiadas solicitudes de renovación. Espera un momento.' },
});

async function generarCodigoUnico(): Promise<string> {
  let codigo: string;
  let existe: boolean;
  let intentos = 0;
  const maxIntentos = 1000;
  do {
    codigo = Math.floor(1000 + Math.random() * 9000).toString();
    const usuarioExistente = await findUserByInternalCodeAny(codigo);
    existe = !!usuarioExistente;
    intentos++;
    if (intentos >= maxIntentos) {
      throw new Error('No se pudo generar un código único después de múltiples intentos.');
    }
  } while (existe);
  return codigo;
}

const CODIGOS_COLEGIO: Record<string, string> = {
  'COLEGIO_DEMO_2025': 'COLEGIO_DEMO_2025',
  'SAN_JOSE_2025': 'SAN_JOSE_2025',
  'SANTA_MARIA_2025': 'SANTA_MARIA_2025',
};

async function syncStudentToGroup(estudianteId: string, grupoId: string | undefined, colegioId: string): Promise<void> {
  if (!grupoId || !estudianteId) return;
  try {
    const resolved = await resolveGroupId(grupoId.trim(), colegioId);
    if (!resolved) return;
    const period = await findActiveAcademicPeriodForInstitution(colegioId);
    await createEnrollment({
      student_id: estudianteId,
      group_id: resolved.id,
      academic_period_id: period?.id ?? null,
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === '23505') return; // unique violation, already enrolled
    console.error('[SYNC] Error syncing student to group:', (err as Error).message);
  }
}

// POST /api/auth/refresh
router.post('/refresh', authRefreshLimiter, async (req, res) => {
  try {
    const raw = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
    if (!raw) {
      return res.status(400).json({ message: 'refreshToken requerido.' });
    }
    const decoded = jwt.verify(raw, signSecret) as { id: string; sv?: number; tokenUse?: string };
    if (decoded.tokenUse !== 'refresh') {
      return res.status(400).json({ message: 'Token no es de renovación.' });
    }
    const u = await findUserById(decoded.id);
    if (!u) {
      return res.status(401).json({ message: 'Usuario no encontrado.' });
    }
    const sv = readAuthSessionVersion(u.config);
    if ((decoded.sv ?? 0) !== sv) {
      return res.status(401).json({ message: 'Sesión no válida.' });
    }
    const token = generateAccessToken(u.id, sv);
    const refreshToken = generateRefreshToken(u.id, sv);
    return res.json({ token, refreshToken });
  } catch (e: unknown) {
    const err = e as { name?: string };
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Refresh expirado. Inicia sesión de nuevo.' });
    }
    return res.status(401).json({ message: 'Refresh inválido.' });
  }
});

// POST /api/auth/logout
router.post('/logout', protect, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.id;
    await bumpAuthSessionVersion(uid);
    invalidateUserAuthCache(uid);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: 'Error al cerrar sesión.' });
  }
});

// GET /api/auth/google
router.get('/google', (req, res) => {
  const { GOOGLE_CLIENT_ID, FRONTEND_URL } = ENV;
  if (!GOOGLE_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_sso_not_configured`);
  }
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const scope = encodeURIComponent('email profile');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  res.redirect(url);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FRONTEND_URL } = ENV;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_sso_not_configured`);
  }
  if (!code || typeof code !== 'string') {
    return res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
  }
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[AUTH Google] Token error:', err);
      return res.redirect(`${FRONTEND_URL}/login?error=token_exchange_failed`);
    }
    const tokenData = (await tokenRes.json()) as { access_token: string };
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      return res.redirect(`${FRONTEND_URL}/login?error=profile_failed`);
    }
    const profile = (await profileRes.json()) as { id: string; email: string; name: string };
    const email = (profile.email || '').toLowerCase();
    if (!email) {
      return res.redirect(`${FRONTEND_URL}/login?error=no_email`);
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=no_account&hint=register_first`);
    }
    if (!['active', 'activo'].includes(user.status)) {
      return res.redirect(`${FRONTEND_URL}/login?error=account_not_active`);
    }
    if (!user.internal_code) {
      const nuevoCodigo = await generarCodigoUnico();
      await updateUser(user.id, { internal_code: nuevoCodigo });
    }
    const refreshed = await findUserById(user.id);
    const sv = readAuthSessionVersion(refreshed?.config ?? user.config);
    const token = generateAccessToken(user.id, sv);
    const params = new URLSearchParams({
      token,
      rol: user.role,
      id: user.id,
      nombre: user.full_name || '',
      email: user.email,
      colegioId: user.institution_id || '',
    });
    if (refreshed?.internal_code) params.set('codigoUnico', refreshed.internal_code);
    const configUserId = ((refreshed?.config ?? user.config) as { userId?: string })?.userId;
    if (configUserId) params.set('userId', configUserId);
    res.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
  } catch (e: unknown) {
    console.error('[AUTH Google]', e);
    res.redirect(`${FRONTEND_URL}/login?error=server_error`);
  }
});

// POST /api/auth/register
router.post('/register', registerLimiter, async (req, res) => {
  let createdUserId: string | null = null;
  try {
    const { nombre, email, password, rol, curso, codigoAcceso, hijoId, materias, seccion } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    const rolesPermitidosPublico = ['estudiante', 'profesor', 'directivo', 'padre', 'administrador-general', 'admin-general-colegio', 'transporte', 'tesoreria', 'nutricion', 'cafeteria', 'asistente', 'asistente-academica', 'super_admin'];
    if (rol === 'school_admin') {
      return res.status(403).json({
        message: 'Este rol no puede ser creado mediante registro público. Contacta al administrador del sistema.',
      });
    }
    if (!rolesPermitidosPublico.includes(rol)) {
      return res.status(400).json({ message: 'Rol inválido.' });
    }

    let colegioId = 'COLEGIO_DEMO_2025';
    let rolFinal = rol;
    const rolesQueRequierenCodigo = ['profesor', 'directivo', 'administrador-general', 'admin-general-colegio', 'transporte', 'tesoreria', 'nutricion', 'cafeteria', 'asistente', 'asistente-academica'];

    if (rol === 'super_admin') {
      colegioId = 'GLOBAL_ADMIN';
    } else if (codigoAcceso) {
      const codigoNormalizado = String(codigoAcceso).toUpperCase().trim();
      let codigoEnBD = await findInstitutionCodeByCode(codigoNormalizado);
      if (!codigoEnBD) {
        const codigoSinEspacios = codigoNormalizado.replace(/\s+/g, '');
        codigoEnBD = (await findInstitutionCodeByCode(codigoSinEspacios)) ?? (await findInstitutionCodeByCode(codigoNormalizado.replace(/_/g, ''))) ?? null;
      }
      if (!codigoEnBD && rol === 'admin-general-colegio') {
        const codigosDelColegio = await findInstitutionCodesByInstitution(codigoNormalizado);
        const forRole = codigosDelColegio.filter((c) => c.role_assigned === 'admin-general-colegio');
        if (forRole.length === 1) codigoEnBD = forRole[0];
        else if (forRole.length > 1) {
          forRole.sort((a, b) => b.id.localeCompare(a.id));
          codigoEnBD = forRole[0];
        }
      }
      if (codigoEnBD) {
        colegioId = codigoEnBD.institution_id;
        rolFinal = codigoEnBD.role_assigned;
      } else {
        const fallback = CODIGOS_COLEGIO[codigoNormalizado];
        if (fallback) colegioId = fallback;
        else if (rol === 'admin-general-colegio') {
          return res.status(400).json({ message: 'El código proporcionado no es válido.' });
        } else if (rolesQueRequierenCodigo.includes(rol)) {
          return res.status(400).json({ message: 'Código del colegio inválido.' });
        }
      }
    } else if (rolesQueRequierenCodigo.includes(rol)) {
      if (rol === 'admin-general-colegio') {
        return res.status(400).json({ message: 'El código del colegio es obligatorio para registrarse como Administrador General del Colegio.' });
      }
      return res.status(400).json({ message: 'El código del colegio es obligatorio para este rol.' });
    }

    if (rol === 'asistente') {
      if (!seccion || !['junior-school', 'middle-school', 'high-school'].includes(seccion)) {
        return res.status(400).json({ message: 'Debes seleccionar una sección válida (Junior School, Middle School o High School).' });
      }
    }

    let materiasArray: string[] = [];
    if (rol === 'profesor') {
      if (!materias || !Array.isArray(materias) || materias.length === 0) {
        return res.status(400).json({ message: 'Los profesores deben especificar al menos una materia.' });
      }
      materiasArray = Array.from(
        new Set(
          materias
            .map((m: string) => String(m).trim())
            .filter((m: string) => m.length > 0)
            .map((m: string) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
        )
      );
      if (materiasArray.length === 0) return res.status(400).json({ message: 'Debes ingresar al menos una materia válida.' });
      if (materiasArray.length > 10) return res.status(400).json({ message: 'No puedes especificar más de 10 materias.' });
    }

    colegioId = await resolveInstitutionId(colegioId);

    const emailNorm = (email as string).toLowerCase();
    const existing = await findUserByEmail(emailNorm);
    if (existing) {
      return res.status(400).json({ message: 'El correo ya está registrado.' });
    }

    const codigoUnico = await generarCodigoUnico();
    const cursoNormalizado = rol === 'estudiante' && curso ? String(curso).toUpperCase().trim() : undefined;
    const passwordHash = await bcrypt.hash(password, 10);
    const config: Record<string, unknown> = {
      curso: cursoNormalizado,
      materias: rolFinal === 'profesor' ? materiasArray : undefined,
      seccion: rolFinal === 'asistente' ? seccion : undefined,
    };

    const newUser = await createUser({
      institution_id: colegioId,
      email: emailNorm,
      password_hash: passwordHash,
      full_name: nombre,
      role: rolFinal,
      status: 'active',
      internal_code: codigoUnico,
      config,
    });
    createdUserId = newUser.id;

    const userIdInfo = generateUserId(rolFinal, newUser.id);
    await updateUser(newUser.id, { config: { ...config, userId: userIdInfo.fullId } });

    if (newUser.role === 'estudiante' && cursoNormalizado) {
      await syncStudentToGroup(newUser.id, cursoNormalizado, colegioId);
    }

    const savedUser = await findUserById(newUser.id);
    const codigoFinal = savedUser?.internal_code ?? codigoUnico;
    const sv = readAuthSessionVersion(savedUser?.config);
    const token = generateAccessToken(newUser.id, sv);
    const refreshToken = generateRefreshToken(newUser.id, sv);

    return res.status(201).json({
      id: newUser.id,
      userId: userIdInfo.fullId,
      nombre: newUser.full_name,
      email: newUser.email,
      rol: newUser.role,
      curso: cursoNormalizado,
      materias: materiasArray,
      colegioId: newUser.institution_id,
      codigoUnico: codigoFinal ?? null,
      seccion: seccion ?? null,
      estado: newUser.status,
      token,
      refreshToken,
    });
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    console.error('[REGISTER] Error:', e?.message);
    if (createdUserId) {
      try {
        const { queryPg } = await import('../config/db-pg.js');
        await queryPg('DELETE FROM users WHERE id = $1', [createdUserId]);
      } catch (_) { }
    }
    if (e?.message?.includes('Rol no reconocido') || e?.message?.includes('userId')) {
      return res.status(400).json({ message: e.message });
    }
    return res.status(500).json({ message: e?.message || 'Error interno del servidor.' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Faltan credenciales.' });
    }
    const emailNorm = (email as string).toLowerCase().trim();

    const pgUser = await findUserByEmail(emailNorm);
    if (!pgUser) {
      return res.status(401).json({ message: 'Usuario no encontrado. Revisa tu correo (usuario).' });
    }
    const estadosPermitidos = ['active', 'activo', 'vinculado', 'pendiente_vinculacion'];
    if (!estadosPermitidos.includes(pgUser.status)) {
      if (pgUser.status === 'suspended') {
        return res.status(403).json({ message: 'Tu cuenta ha sido suspendida. Contacta al administrador.' });
      }
      if (pgUser.status === 'pending') {
        return res.status(403).json({ message: 'Tu cuenta está pendiente de aprobación. Contacta al administrador.' });
      }
      return res.status(403).json({ message: 'Tu cuenta no está activa. Contacta al administrador del colegio.' });
    }
    const isMatch = await bcrypt.compare(password, pgUser.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }
    const sv = readAuthSessionVersion(pgUser.config);
    const token = generateAccessToken(pgUser.id, sv);
    const refreshToken = generateRefreshToken(pgUser.id, sv);
    const userResponse = toAuthResponse(pgUser);
    const config = (pgUser.config ?? {}) as { curso?: string; materias?: string[] };
    let curso = config.curso;
    if (pgUser.role === 'estudiante' && !curso) {
      curso = await getFirstGroupNameForStudent(pgUser.id) ?? undefined;
    }
    // El cliente espera AuthResponse plano con curso/materias en raíz para habilitar queries del dashboard
    try {
      await createActivityLog({
        institution_id: pgUser.institution_id,
        user_id: pgUser.id,
        entity_type: 'session',
        entity_id: null,
        action: 'login',
        ip_address: getClientIP(req),
        metadata: { role: pgUser.role, result: 'success' },
      });
    } catch {
      /* auditoría best-effort */
    }
    return res.json({
      token,
      refreshToken,
      ...userResponse,
      codigoUnico: pgUser.internal_code ?? undefined,
      curso: curso ?? config.curso,
      materias: config.materias,
    });
  } catch (err: unknown) {
    console.error('Error en login:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
