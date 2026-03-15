import express from 'express';
import bcrypt from 'bcryptjs';
import {
  findUserById,
  findUserByEmail,
  findUserByInternalCode,
  findUserByInternalCodeAny,
  findUsersByInstitution,
  findUsersByIds,
  createUser,
  updateUser,
  countUsersByInstitutionAndRole,
} from '../repositories/userRepository.js';
import { findGuardianStudentsByGuardian, findGuardianStudentsByStudent, findGuardianStudent, createGuardianStudent } from '../repositories/guardianStudentRepository.js';
import { createNotification } from '../repositories/notificationRepository.js';
import { findGroupById } from '../repositories/groupRepository.js';
import { getAllCourseGroupsForStudent } from '../repositories/enrollmentRepository.js';
import { findGroupSubjectsByGroupWithDetails } from '../repositories/groupSubjectRepository.js';
import { findSubjectById } from '../repositories/subjectRepository.js';
import { findGroupsByInstitution, countGradeGroupsByInstitution } from '../repositories/groupRepository.js';
import { findSubjectsByInstitution } from '../repositories/subjectRepository.js';
import { countAttendanceByInstitutionAndDateRange } from '../repositories/attendanceRepository.js';
import { protect, AuthRequest } from '../middleware/auth';
import { generateUserId } from '../utils/idGenerator';
import { createBulkUsers, type BulkRowInput } from '../services/bulkUserService';
import { logAdminAction } from '../services/auditLogger';

const router = express.Router();

const generarCodigoUnico = async (): Promise<string> => {
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
};

const generarPasswordAleatorio = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
};

// GET /api/users/profesores
router.get('/profesores', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'directivo') {
      return res.status(403).json({ message: 'Solo directivos pueden acceder a esta ruta' });
    }
    const all = await findUsersByInstitution(user.institution_id);
    const profesores = all.filter((u) => u.role === 'profesor');
    const profesoresConId = profesores.map((u) => ({
      _id: u.id,
      id: u.id,
      userId: (u.config as { userId?: string })?.userId ?? generateUserId(u.role, u.id).fullId,
      nombre: u.full_name,
      email: u.email,
      materias: (u.config as { materias?: string[] })?.materias,
      createdAt: u.created_at,
    }));
    res.json(profesoresConId);
  } catch (error: unknown) {
    console.error('Error al obtener profesores:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al cargar los profesores.' });
  }
});

// GET /api/users/me/courses - Para estudiantes: materias del grupo
router.get('/me/courses', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    if (user.role === 'estudiante') {
      const colegioId = user.institution_id;
      const courseGroups = await getAllCourseGroupsForStudent(userId, colegioId ?? undefined);
      if (!courseGroups.length) return res.status(200).json([]);
      const courses: Array<{
        _id: string;
        nombre: string;
        descripcion: string;
        colorAcento: string;
        icono: string;
        profesorIds: Array<{ _id: string; nombre: string; email: string }>;
        cursos: string[];
      }> = [];
      for (const g of courseGroups) {
        const details = await findGroupSubjectsByGroupWithDetails(g.id, colegioId ?? undefined);
        for (const gs of details) {
          courses.push({
            _id: gs.id,
            nombre: [gs.subject_name, gs.group_name].filter(Boolean).join(' ').trim() || g.name,
            descripcion: gs.subject_description ?? '',
            colorAcento: '',
            icono: '',
            profesorIds: [{ _id: gs.teacher_id, nombre: gs.teacher_name, email: gs.teacher_email }],
            cursos: [g.name],
          });
        }
      }
      return res.status(200).json(courses);
    }
    res.status(200).json([]);
  } catch (error: unknown) {
    console.error('Error al obtener materias:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al cargar las materias.' });
  }
});

// POST /api/users/asignar-codigos
router.post('/asignar-codigos', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'directivo') {
      return res.status(403).json({ message: 'Solo directivos pueden acceder a esta ruta' });
    }
    const all = await findUsersByInstitution(user.institution_id);
    const sinCodigo = all.filter((u) => !u.internal_code || u.internal_code.trim() === '');
    let asignados = 0;
    let errores = 0;
    for (const u of sinCodigo) {
      try {
        const codigo = await generarCodigoUnico();
        await updateUser(u.id, { internal_code: codigo });
        asignados++;
      } catch {
        errores++;
      }
    }
    res.json({
      message: 'Proceso completado',
      usuariosProcesados: sinCodigo.length,
      codigosAsignados: asignados,
      errores,
    });
  } catch (error: unknown) {
    console.error('Error al asignar códigos:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al asignar códigos.' });
  }
});

// GET /api/users/relaciones/:userId
router.get('/relaciones/:userId', protect, async (req: AuthRequest, res) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(403).json({ message: 'No autorizado' });
    const admin = await findUserById(adminId);
    if (!admin || admin.role !== 'admin-general-colegio') {
      return res.status(403).json({ message: 'Solo administradores generales del colegio pueden acceder' });
    }
    const { userId } = req.params;
    const usuario = await findUserById(userId);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (usuario.role === 'estudiante') {
      const links = await findGuardianStudentsByStudent(userId);
      const guardianIds = links.map((l) => l.guardian_id).filter(Boolean);
      if (guardianIds.length === 0) return res.json({ tipo: 'estudiante', padres: [] });
      const padres = await findUsersByIds(guardianIds);
      return res.json({
        tipo: 'estudiante',
        padres: padres.map((p) => ({ _id: p.id, nombre: p.full_name, email: p.email })),
      });
    }
    if (usuario.role === 'padre') {
      const links = await findGuardianStudentsByGuardian(userId);
      const studentIds = links.map((l) => l.student_id).filter(Boolean);
      if (studentIds.length === 0) return res.json({ tipo: 'padre', hijos: [] });
      const hijos = await findUsersByIds(studentIds);
      return res.json({
        tipo: 'padre',
        hijos: hijos.map((h) => ({
          _id: h.id,
          nombre: h.full_name,
          email: h.email,
          curso: (h.config as { curso?: string })?.curso,
        })),
      });
    }
    return res.json({ tipo: usuario.role, padres: [], hijos: [] });
  } catch (error: unknown) {
    console.error('Error al obtener relaciones:', (error as Error).message);
    res.status(500).json({ message: 'Error al obtener relaciones.' });
  }
});

// GET /api/users/by-role
router.get('/by-role', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    const rolUser = req.user?.rol;
    if (!colegioId || !rolUser) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (rolUser !== 'admin-general-colegio' && rolUser !== 'school_admin' && rolUser !== 'directivo') {
      return res.status(403).json({ message: 'Solo administradores del colegio o directivos pueden acceder a esta ruta' });
    }
    let { rol } = req.query;
    if (!rol || typeof rol !== 'string') return res.status(400).json({ message: 'El parámetro "rol" es requerido' });
    rol = (rol as string).trim().toLowerCase();
    const rolMap: Record<string, string> = {
      estudiante: 'estudiante', estudiantes: 'estudiante',
      profesor: 'profesor', profesores: 'profesor',
      padre: 'padre', padres: 'padre',
      directivo: 'directivo', directivos: 'directivo',
      asistente: 'asistente', asistentes: 'asistente',
    };
    const rolNormalizado = rolMap[rol] || rol;
    const rolesPermitidos = ['estudiante', 'profesor', 'padre', 'directivo', 'asistente'];
    if (!rolesPermitidos.includes(rolNormalizado)) {
      return res.status(400).json({ message: `Rol no permitido. Roles permitidos: ${rolesPermitidos.join(', ')}` });
    }
    const all = await findUsersByInstitution(colegioId);
    const usuarios = all.filter((u) => u.role === rolNormalizado);
    const usuariosConId = usuarios.map((u) => ({
      _id: u.id,
      id: u.id,
      userId: (u.config as { userId?: string })?.userId ?? generateUserId(u.role, u.id).fullId,
      nombre: u.full_name,
      email: u.email,
      curso: (u.config as { curso?: string })?.curso,
      estado: u.status || 'active',
      codigoUnico: u.internal_code,
      telefono: u.phone,
      celular: u.phone,
      materias: (u.config as { materias?: string[] })?.materias,
      createdAt: u.created_at,
    }));
    return res.json(usuariosConId);
  } catch (error: unknown) {
    console.error('Error al obtener usuarios por rol:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al cargar los usuarios.' });
  }
});

// GET /api/users/stats
router.get('/stats', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'admin-general-colegio' && user.role !== 'school_admin' && user.role !== 'directivo') {
      return res.status(403).json({ message: 'Solo administradores del colegio o directivos pueden acceder a esta ruta' });
    }
    const onlyActive = req.query.estado === 'active';
    const statusFilter = onlyActive ? 'active' : undefined;
    const [estudiantes, profesores, padres, directivos, asistentes] = await Promise.all([
      countUsersByInstitutionAndRole(colegioId, 'estudiante', statusFilter),
      countUsersByInstitutionAndRole(colegioId, 'profesor', statusFilter),
      countUsersByInstitutionAndRole(colegioId, 'padre', statusFilter),
      countUsersByInstitutionAndRole(colegioId, 'directivo', statusFilter),
      countUsersByInstitutionAndRole(colegioId, 'asistente', statusFilter),
    ]);
    const [gradeGroupCount, subjects] = await Promise.all([
      countGradeGroupsByInstitution(colegioId),
      findSubjectsByInstitution(colegioId),
    ]);
    const cursos = gradeGroupCount;
    const materias = subjects.length;
    const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    const fromStr = startMonth.toISOString().slice(0, 10);
    const toStr = endMonth.toISOString().slice(0, 10);
    const att = await countAttendanceByInstitutionAndDateRange(colegioId, fromStr, toStr);
    const asistenciaResumen = {
      totalRegistros: att.total,
      presentes: att.presentCount,
      porcentajePromedio: att.total > 0 ? Math.round((att.presentCount / att.total) * 100) : 0,
    };
    res.json({
      estudiantes,
      profesores,
      padres,
      directivos,
      asistentes,
      cursos,
      materias,
      asistenciaResumen,
      treasuryResumen: { facturasPendientes: 0, ingresosMes: 0 },
    });
  } catch (error: unknown) {
    console.error('Error al obtener estadísticas:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al cargar las estadísticas.' });
  }
});

// POST /api/users/create
router.post('/create', protect, async (req: AuthRequest, res) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const admin = await findUserById(adminId);
    if (!admin || (admin.role !== 'admin-general-colegio' && admin.role !== 'school_admin')) {
      return res.status(403).json({ message: 'Solo administradores del colegio pueden crear usuarios.' });
    }
    const { nombre, email, rol, curso, telefono, celular, materias: materiasBody, materia, cursos } = req.body;
    const materias = rol === 'profesor' && (materia != null || materiasBody != null)
      ? (Array.isArray(materiasBody) ? materiasBody : (materia != null ? [materia] : materiasBody ? [materiasBody] : []))
      : undefined;

    if (!nombre || !email || !rol) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, email, rol' });
    }
    const rolesPermitidos = ['estudiante', 'profesor', 'padre', 'directivo', 'asistente'];
    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({ message: `Rol no permitido. Roles permitidos: ${rolesPermitidos.join(', ')}` });
    }

    const existing = await findUserByEmail((email || '').toLowerCase());
    if (existing) return res.status(400).json({ message: 'El correo ya está registrado.' });

    const esEstudiante = rol === 'estudiante';
    const codigoUnico = await generarCodigoUnico();
    const passwordPlain = generarPasswordAleatorio();
    const passwordHash = await bcrypt.hash(passwordPlain, 10);

    const config: Record<string, unknown> = {
      curso: rol === 'estudiante' ? curso : undefined,
      materias: rol === 'profesor' && materias ? (Array.isArray(materias) ? materias : [materias]) : undefined,
      userId: undefined as string | undefined,
    };
    const newUser = await createUser({
      institution_id: admin.institution_id,
      email: (email as string).toLowerCase(),
      password_hash: passwordHash,
      full_name: nombre,
      role: rol,
      status: esEstudiante ? 'pendiente_vinculacion' : 'active',
      internal_code: codigoUnico,
      phone: telefono ?? celular ?? null,
      config,
    });
    const userIdInfo = generateUserId(rol, newUser.id);
    await updateUser(newUser.id, { config: { ...config, userId: userIdInfo.fullId } });

    await logAdminAction({
      userId: adminId,
      role: admin.role,
      action: 'create_user',
      entityType: 'user',
      entityId: newUser.id,
      colegioId: admin.institution_id,
      requestData: { rol, email: (email as string).toLowerCase(), nombre },
    });

    res.status(201).json({
      message: esEstudiante
        ? 'Estudiante creado. Debe vincularse con al menos un padre y luego activar la cuenta.'
        : 'Usuario creado exitosamente',
      user: {
        _id: newUser.id,
        nombre: newUser.full_name,
        email: newUser.email,
        rol: newUser.role,
        userId: userIdInfo.fullId,
        codigoUnico: newUser.internal_code,
        estado: newUser.status,
        passwordTemporal: passwordPlain,
      },
    });
  } catch (error: unknown) {
    console.error('Error al crear usuario:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al crear el usuario.' });
  }
});

// POST /api/users/bulk
router.post('/bulk', protect, async (req: AuthRequest, res) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(403).json({ message: 'No autorizado' });
    const admin = await findUserById(adminId);
    if (!admin || (admin.role !== 'admin-general-colegio' && admin.role !== 'school_admin')) {
      return res.status(403).json({
        message: 'Solo administradores del colegio pueden realizar carga masiva de usuarios.',
      });
    }
    const colegioId = admin.institution_id;
    if (!colegioId) return res.status(400).json({ message: 'Colegio no definido para el administrador.' });
    const { rows } = req.body as { rows?: BulkRowInput[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        message: 'Se requiere un array "rows" con al menos una fila. Cada fila: nombre, apellido?, email, rol, codigo_interno?, curso_grupo?',
      });
    }
    const result = await createBulkUsers(rows, colegioId);
    res.status(200).json(result);
  } catch (error: unknown) {
    console.error('Error en carga masiva de usuarios:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al procesar la carga masiva.' });
  }
});

// POST /api/users/reset-password
router.post('/reset-password', protect, async (req: AuthRequest, res) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(403).json({ message: 'No autorizado' });
    const admin = await findUserById(adminId);
    if (!admin || (admin.role !== 'admin-general-colegio' && admin.role !== 'school_admin')) {
      return res.status(403).json({ message: 'Solo administradores del colegio pueden restablecer contraseñas.' });
    }
    const { userId } = req.body as { userId?: string };
    if (!userId) return res.status(400).json({ message: 'Falta userId.' });
    const target = await findUserById(userId);
    if (!target) return res.status(404).json({ message: 'Usuario no encontrado.' });
    if (target.institution_id !== admin.institution_id) {
      return res.status(403).json({ message: 'No puedes restablecer la contraseña de un usuario de otro colegio.' });
    }
    const newPassword = generarPasswordAleatorio();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUser(userId, { password_hash: passwordHash });
    res.status(200).json({
      message: 'Contraseña restablecida. Comparte la nueva contraseña con el usuario.',
      passwordTemporal: newPassword,
    });
  } catch (error: unknown) {
    console.error('Error al restablecer contraseña:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al restablecer la contraseña.' });
  }
});

const ensureAdminColegio = async (req: AuthRequest): Promise<{ ok: true; user: { institution_id: string; role: string } } | { ok: false; status: number; message: string }> => {
  const uid = req.user?.id;
  if (!uid) return { ok: false, status: 403, message: 'No autorizado' };
  const u = await findUserById(uid);
  if (!u || (u.role !== 'admin-general-colegio' && u.role !== 'school_admin')) {
    return { ok: false, status: 403, message: 'Solo administradores generales del colegio pueden realizar esta acción.' };
  }
  return { ok: true, user: { institution_id: u.institution_id, role: u.role } };
};

// GET /api/users/me/hijos
router.get('/me/hijos', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (req.user?.rol !== 'padre') return res.status(403).json({ message: 'Solo padres pueden acceder a esta ruta.' });
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const links = await findGuardianStudentsByGuardian(userId!);
    const studentIds = links.map((l) => l.student_id).filter(Boolean);
    if (studentIds.length === 0) return res.json([]);
    const users = await findUsersByIds(studentIds);
    const hijos = users.map((u) => ({
      _id: u.id,
      id: u.id,
      nombre: u.full_name,
      correo: u.email,
      email: u.email,
      curso: (u.config as { curso?: string })?.curso ?? undefined,
    }));
    return res.json(hijos);
  } catch (e: unknown) {
    console.error('Error en GET /me/hijos:', (e as Error).message);
    res.status(500).json({ message: 'Error al listar hijos.' });
  }
});

// GET /api/users/me/consent
router.get('/me/consent', protect, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const u = await findUserById(uid);
    if (!u) return res.status(404).json({ message: 'Usuario no encontrado.' });
    return res.json({
      consentimientoTerminos: u.consent_terms,
      consentimientoPrivacidad: u.consent_privacy,
      consentimientoFecha: u.consent_at ?? null,
    });
  } catch (e: unknown) {
    console.error('Error en GET /me/consent:', (e as Error).message);
    res.status(500).json({ message: 'Error al obtener consentimiento.' });
  }
});

// POST /api/users/me/consent
router.post('/me/consent', protect, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: 'No autorizado.' });
    const { consentimientoTerminos, consentimientoPrivacidad } = req.body;
    if (consentimientoTerminos !== true || consentimientoPrivacidad !== true) {
      return res.status(400).json({ message: 'Debe aceptar tanto términos como política de privacidad.' });
    }
    await updateUser(uid, {
      consent_terms: true,
      consent_privacy: true,
      consent_at: new Date().toISOString(),
    });
    return res.json({
      success: true,
      message: 'Consentimiento registrado correctamente.',
      consentimientoTerminos: true,
      consentimientoPrivacidad: true,
      consentimientoFecha: new Date().toISOString(),
    });
  } catch (e: unknown) {
    console.error('Error en POST /me/consent:', (e as Error).message);
    res.status(500).json({ message: 'Error al registrar consentimiento.' });
  }
});

// GET /api/users/vinculaciones
router.get('/vinculaciones', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdminColegio(req);
    if (!check.ok) return res.status(check.status).json({ message: check.message });
    const { estudianteId, padreId } = req.query;
    const colegioId = check.user.institution_id;
    if (estudianteId) {
      const list = await findGuardianStudentsByStudent(estudianteId as string);
      const guardianIds = list.map((l) => l.guardian_id);
      const students = list.map((l) => l.student_id);
      const users = await findUsersByIds([...guardianIds, ...students]);
      const byId = new Map(users.map((u) => [u.id, u]));
      const result = list.map((l) => ({
        guardian_id: l.guardian_id,
        student_id: l.student_id,
        padreId: byId.get(l.guardian_id) ? { _id: l.guardian_id, nombre: byId.get(l.guardian_id)!.full_name, email: byId.get(l.guardian_id)!.email } : null,
        estudianteId: byId.get(l.student_id) ? { _id: l.student_id, nombre: byId.get(l.student_id)!.full_name, email: byId.get(l.student_id)!.email, curso: (byId.get(l.student_id)!.config as { curso?: string })?.curso, estado: byId.get(l.student_id)!.status } : null,
      }));
      return res.json(result);
    }
    if (padreId) {
      const list = await findGuardianStudentsByGuardian(padreId as string);
      const guardianIds = list.map((l) => l.guardian_id);
      const studentIds = list.map((l) => l.student_id);
      const users = await findUsersByIds([...guardianIds, ...studentIds]);
      const byId = new Map(users.map((u) => [u.id, u]));
      const result = list.map((l) => ({
        guardian_id: l.guardian_id,
        student_id: l.student_id,
        padreId: byId.get(l.guardian_id) ? { _id: l.guardian_id, nombre: byId.get(l.guardian_id)!.full_name, email: byId.get(l.guardian_id)!.email } : null,
        estudianteId: byId.get(l.student_id) ? { _id: l.student_id, nombre: byId.get(l.student_id)!.full_name, email: byId.get(l.student_id)!.email, curso: (byId.get(l.student_id)!.config as { curso?: string })?.curso, estado: byId.get(l.student_id)!.status } : null,
      }));
      return res.json(result);
    }
    return res.status(400).json({ message: 'Indica estudianteId o padreId en query.' });
  } catch (e: unknown) {
    console.error('Error en GET /vinculaciones:', (e as Error).message);
    res.status(500).json({ message: 'Error al listar vinculaciones.' });
  }
});

// POST /api/users/vinculaciones
router.post('/vinculaciones', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdminColegio(req);
    if (!check.ok) return res.status(check.status).json({ message: check.message });
    const { padreId, estudianteId } = req.body;
    const colegioId = check.user.institution_id;
    if (!padreId || !estudianteId) return res.status(400).json({ message: 'Faltan padreId y estudianteId.' });

    const padre = await findUserById(padreId);
    const estudiante = await findUserById(estudianteId);
    if (!padre || padre.role !== 'padre') return res.status(404).json({ message: 'Padre no encontrado.' });
    if (!estudiante || estudiante.role !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (padre.institution_id !== colegioId || estudiante.institution_id !== colegioId) {
      return res.status(403).json({ message: 'Padre y estudiante deben ser del mismo colegio.' });
    }
    const existente = await findGuardianStudent(padreId, estudianteId);
    if (existente) return res.status(400).json({ message: 'Esta vinculación ya existe.' });

    const v = await createGuardianStudent(padreId, estudianteId, colegioId);
    await logAdminAction({
      userId: req.user!.id!,
      role: check.user.role,
      action: 'vinculacion',
      entityType: 'vinculacion',
      entityId: v.guardian_id + v.student_id,
      colegioId,
      requestData: { padreId, estudianteId },
    });
    try {
      await createNotification({
        institution_id: colegioId,
        user_id: padreId,
        title: 'Vinculación creada',
        body: 'Se ha creado una vinculación entre usted y un estudiante. La cuenta se activará cuando el administrador confirme y active las cuentas.',
      });
      await createNotification({
        institution_id: colegioId,
        user_id: estudianteId,
        title: 'Vinculación con padre',
        body: 'Se ha vinculado su cuenta con un padre/tutor. La activación se completará cuando el administrador confirme.',
      });
    } catch (err: unknown) {
      console.error('Error al crear notificaciones de vinculación:', (err as Error).message);
    }
    res.status(201).json({ message: 'Vinculación creada.', vinculacion: v });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === '23505') return res.status(400).json({ message: 'Esta vinculación ya existe.' });
    console.error('Error en POST /vinculaciones:', (e as Error).message);
    res.status(500).json({ message: 'Error al crear vinculación.' });
  }
});

// POST /api/users/confirmar-vinculacion
router.post('/confirmar-vinculacion', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdminColegio(req);
    if (!check.ok) return res.status(check.status).json({ message: check.message });
    const { estudianteId } = req.body;
    const colegioId = check.user.institution_id;
    if (!estudianteId) return res.status(400).json({ message: 'Falta estudianteId.' });

    const links = await findGuardianStudentsByStudent(estudianteId);
    if (links.length === 0) {
      return res.status(400).json({ message: 'El estudiante debe tener al menos un padre vinculado antes de confirmar.' });
    }
    const estudiante = await findUserById(estudianteId);
    if (!estudiante || estudiante.role !== 'estudiante' || estudiante.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }
    const guardianIds = links.map((l) => l.guardian_id);
    await updateUser(estudianteId, { status: 'vinculado' });
    for (const gid of guardianIds) {
      await updateUser(gid, { status: 'vinculado' });
    }
    await logAdminAction({
      userId: req.user!.id!,
      role: check.user.role,
      action: 'confirmar_vinculacion',
      entityType: 'user',
      entityId: estudianteId,
      colegioId,
      requestData: { estudianteId, padresActualizados: guardianIds.length },
    });
    try {
      for (const gid of guardianIds) {
        await createNotification({
          institution_id: colegioId,
          user_id: gid,
          title: 'Vinculación confirmada',
          body: 'La vinculación con el estudiante ha sido confirmada. El administrador puede activar las cuentas para que puedan iniciar sesión.',
        });
      }
      await createNotification({
        institution_id: colegioId,
        user_id: estudianteId,
        title: 'Vinculación confirmada',
        body: 'Su vinculación con su(s) padre(s)/tutor(es) ha sido confirmada. Pronto podrá acceder cuando se activen las cuentas.',
      });
    } catch (err: unknown) {
      console.error('Error al crear notificaciones confirmar vinculación:', (err as Error).message);
    }
    res.json({
      message: 'Vinculación confirmada. Estudiante y padres vinculados pasan a estado VINCULADO.',
      estudianteId,
      padresActualizados: guardianIds.length,
    });
  } catch (e: unknown) {
    console.error('Error en POST /confirmar-vinculacion:', (e as Error).message);
    res.status(500).json({ message: 'Error al confirmar vinculación.' });
  }
});

// POST /api/users/activar-cuentas
router.post('/activar-cuentas', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdminColegio(req);
    if (!check.ok) return res.status(check.status).json({ message: check.message });
    const { estudianteId } = req.body;
    const colegioId = check.user.institution_id;
    if (!estudianteId) return res.status(400).json({ message: 'Falta estudianteId.' });

    const links = await findGuardianStudentsByStudent(estudianteId);
    if (links.length === 0) {
      return res.status(400).json({
        message: 'El estudiante debe estar vinculado con al menos un padre. Completa la vinculación y confírmala antes de activar.',
      });
    }
    const estudiante = await findUserById(estudianteId);
    if (!estudiante || estudiante.role !== 'estudiante' || estudiante.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }
    if (estudiante.status !== 'vinculado') {
      return res.status(400).json({
        message: 'Solo se pueden activar cuentas cuando el estudiante está en estado VINCULADO. Confirma la vinculación antes.',
      });
    }
    const guardianIds = links.map((l) => l.guardian_id);
    await updateUser(estudianteId, { status: 'active' });
    for (const gid of guardianIds) {
      await updateUser(gid, { status: 'active' });
    }
    await logAdminAction({
      userId: req.user!.id!,
      role: check.user.role,
      action: 'activar_cuentas',
      entityType: 'user',
      entityId: estudianteId,
      colegioId,
      requestData: { estudianteId, padresActivados: guardianIds.length },
    });
    try {
      for (const gid of guardianIds) {
        await createNotification({
          institution_id: colegioId,
          user_id: gid,
          title: 'Cuentas activadas',
          body: 'Las cuentas han sido activadas. Ya puede iniciar sesión en la plataforma.',
        });
      }
      await createNotification({
        institution_id: colegioId,
        user_id: estudianteId,
        title: 'Cuenta activada',
        body: 'Su cuenta ha sido activada. Ya puede iniciar sesión en la plataforma.',
      });
    } catch (err: unknown) {
      console.error('Error al crear notificaciones activar cuentas:', (err as Error).message);
    }
    res.json({
      message: 'Cuentas activadas. El estudiante y los padres vinculados ya pueden iniciar sesión.',
      estudianteId,
      padresActivados: guardianIds.length,
    });
  } catch (e: unknown) {
    console.error('Error en POST /activar-cuentas:', (e as Error).message);
    res.status(500).json({ message: 'Error al activar cuentas.' });
  }
});

export default router;
