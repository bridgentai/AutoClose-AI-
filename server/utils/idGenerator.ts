import { Types } from 'mongoose';

export enum UserIdPrefix {
  STUDENT = 'STU-',
  PROFESSOR = 'PROF-',
  PARENT = 'PARENT-',
  ADMIN = 'ADMIN-',
}

export interface CategorizedUserId {
  prefix: UserIdPrefix;
  internalId: string; // ObjectId interno de MongoDB
  fullId: string; // Prefijo + ObjectId (ej: "PROF-507f1f77bcf86cd799439011")
}

/**
 * Obtiene el prefijo correspondiente a un rol
 */
export function getPrefixForRole(role: string): UserIdPrefix {
  switch (role) {
    case 'estudiante':
      return UserIdPrefix.STUDENT;
    case 'profesor':
      return UserIdPrefix.PROFESSOR;
    case 'padre':
      return UserIdPrefix.PARENT;
    case 'directivo':
    case 'administrador-general':
    case 'admin-general-colegio':
    case 'transporte':
    case 'tesoreria':
    case 'nutricion':
    case 'cafeteria':
    case 'asistente':
    case 'school_admin':
    case 'super_admin':
    case 'administrador':
      return UserIdPrefix.ADMIN;
    default:
      throw new Error(`Rol no reconocido: ${role}`);
  }
}

/**
 * Genera un ID categorizado para un usuario basado en su rol
 */
export function generateUserId(role: string, internalId?: Types.ObjectId | string): CategorizedUserId {
  const objectIdString =
    internalId !== undefined
      ? typeof internalId === 'string'
        ? internalId
        : internalId.toString()
      : new Types.ObjectId().toString();
  const prefix = getPrefixForRole(role);
  
  return {
    prefix,
    internalId: objectIdString,
    fullId: `${prefix}${objectIdString}`,
  };
}

/**
 * Extrae el ObjectId interno de un ID categorizado
 */
export function extractInternalId(categorizedId: string): string {
  const prefixes = Object.values(UserIdPrefix);
  for (const prefix of prefixes) {
    if (categorizedId.startsWith(prefix)) {
      return categorizedId.replace(prefix, '');
    }
  }
  // Si no tiene prefijo, asumir que es un ObjectId directo (compatibilidad)
  return categorizedId;
}

/**
 * Valida que un ID categorizado corresponde al rol del usuario
 */
export function validateIdForRole(categorizedId: string, userRole: string): boolean {
  const prefixes = Object.values(UserIdPrefix);
  const prefix = prefixes.find(p => categorizedId.startsWith(p));
  
  if (!prefix) {
    // Si no tiene prefijo, permitir acceso (compatibilidad con IDs antiguos)
    // Esto permite que el sistema funcione durante la migración
    return true;
  }
  
  try {
    const expectedPrefix = getPrefixForRole(userRole);
    return prefix === expectedPrefix;
  } catch (error) {
    // Si el rol no es reconocido, rechazar
    return false;
  }
}

/**
 * Valida el formato de un ID categorizado
 */
export function isValidCategorizedId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  
  const prefixes = Object.values(UserIdPrefix);
  const hasPrefix = prefixes.some(p => id.startsWith(p));
  
  if (!hasPrefix) {
    // Permitir ObjectIds sin prefijo para compatibilidad (24 caracteres hexadecimales)
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
  
  const internalId = extractInternalId(id);
  return /^[0-9a-fA-F]{24}$/.test(internalId);
}

/**
 * Normaliza un ID (categorizado o no) para búsqueda en BD
 * Retorna el ObjectId interno siempre
 */
export function normalizeIdForQuery(id: string): string {
  return extractInternalId(id);
}

/**
 * Obtiene el prefijo de un ID categorizado, o null si no tiene prefijo
 */
export function getPrefixFromId(id: string): UserIdPrefix | null {
  const prefixes = Object.values(UserIdPrefix);
  for (const prefix of prefixes) {
    if (id.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
}

