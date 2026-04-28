import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { generateUserId } from '../utils/idGenerator';
import {
  findUserById,
  readAuthSessionVersion,
  type UserRow,
} from '../repositories/userRepository.js';
import { getFirstGroupNameForStudent } from '../repositories/enrollmentRepository.js';
import { ENV } from '../config/env.js';

/**
 * Auth canónico para PostgreSQL. Ver también authMiddleware.ts (re-export de este módulo).
 */

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado');
}

export type UserRole = 'estudiante' | 'profesor' | 'directivo' | 'padre' | 'administrador-general' | 'admin-general-colegio' | 'transporte' | 'tesoreria' | 'nutricion' | 'cafeteria' | 'asistente' | 'asistente-academica' | 'school_admin' | 'super_admin' | 'rector';

export interface AuthRequest extends Request {
  userId?: string;
  categorizedUserId?: string;
  user?: {
    id: string;
    categorizedId: string;
    colegioId: string;
    institution_id?: string;
    institutionId?: string;
    rol: UserRole;
    sectionId?: string | null;
    curso?: string;
    materias?: string[];
  };
}

type AccessJwtPayload = { id: string; sv?: number; tokenUse?: string };

const userProtectCache = new Map<string, { entry: UserRow; expiresAt: number }>();
const PROTECT_TTL_MS = 45_000;
const MAX_CACHE_ENTRIES = 10_000;

export function invalidateUserAuthCache(userId: string): void {
  userProtectCache.delete(userId);
}

async function loadUserForProtect(userId: string): Promise<UserRow | null> {
  const now = Date.now();
  const hit = userProtectCache.get(userId);
  if (hit && hit.expiresAt > now) {
    return hit.entry;
  }
  const user = await findUserById(userId);
  if (!user) {
    userProtectCache.delete(userId);
    return null;
  }
  if (userProtectCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = userProtectCache.keys().next().value as string | undefined;
    if (firstKey) userProtectCache.delete(firstKey);
  }
  userProtectCache.set(userId, { entry: user, expiresAt: now + PROTECT_TTL_MS });
  return user;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!ENV.DATABASE_URL) {
      return res.status(503).json({ message: 'Backend configurado solo para PostgreSQL. Configure DATABASE_URL.' });
    }
    let token: string | undefined;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ message: 'No autorizado. Token no proporcionado.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AccessJwtPayload;
    if (decoded.tokenUse === 'refresh') {
      return res.status(401).json({ message: 'Token de acceso inválido. Usa /api/auth/refresh con el refresh token.' });
    }

    req.userId = decoded.id;
    const tokenSv = decoded.sv ?? 0;

    const pgUser = await loadUserForProtect(decoded.id);
    if (!pgUser) {
      return res.status(401).json({ message: 'Usuario no encontrado.' });
    }

    const currentSv = readAuthSessionVersion(pgUser.config);
    if (tokenSv !== currentSv) {
      return res.status(401).json({ message: 'Sesión cerrada o no válida. Inicia sesión de nuevo.' });
    }

    const config = pgUser.config as { userId?: string; curso?: string; materias?: string[] } | undefined;
    let curso = config?.curso;
    if (pgUser.role === 'estudiante' && !curso) {
      curso = await getFirstGroupNameForStudent(pgUser.id) ?? undefined;
    }
    const categorizedId = config?.userId ?? generateUserId(pgUser.role as UserRole, decoded.id).fullId;
    req.categorizedUserId = categorizedId;
    req.user = {
      id: pgUser.id,
      categorizedId,
      colegioId: pgUser.institution_id,
      institution_id: pgUser.institution_id,
      institutionId: pgUser.institution_id,
      rol: pgUser.role as UserRole,
      sectionId: pgUser.section_id ?? null,
      curso,
      materias: config?.materias,
    };
    next();
  } catch (e: unknown) {
    const err = e as { name?: string };
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado. Renueva con /api/auth/refresh o inicia sesión de nuevo.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'No autorizado. Token inválido.' });
    }
    return res.status(401).json({ message: 'No autorizado. Token inválido.' });
  }
};

/** Solo admin general del colegio (y school_admin). Para rutas de escritura de configuración; el directivo no puede. */
export const checkAdminColegioOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  const rol = req.user?.rol;
  if (rol === 'admin-general-colegio' || rol === 'school_admin') {
    return next();
  }
  return res.status(403).json({
    message: 'Acceso denegado. Solo el administrador general del colegio puede realizar esta acción.',
  });
};

/**
 * Verifica que el recurso solicitado pertenece a la misma institución del usuario.
 * Usar en handlers cuando se necesita validar cross-institution.
 */
export function isSameInstitution(req: AuthRequest, resourceInstitutionId: string): boolean {
  if (req.user?.rol === 'super_admin') return true;
  return (
    req.user?.colegioId === resourceInstitutionId || req.user?.institution_id === resourceInstitutionId
  );
}
