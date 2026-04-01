/**
 * rolePermissions.ts
 * Matriz central de permisos por rol, recurso y acción.
 *
 * Uso:
 *   import { can, ROLES } from '../config/rolePermissions.js';
 *   if (!can(req.user.rol, 'grades', 'read')) return res.status(403)...
 */

export const ROLES = {
  ESTUDIANTE: 'estudiante',
  PROFESOR: 'profesor',
  DIRECTIVO: 'directivo',
  PADRE: 'padre',
  ADMIN_GENERAL: 'administrador-general',
  ADMIN_COLEGIO: 'admin-general-colegio',
  SCHOOL_ADMIN: 'school_admin',
  TRANSPORTE: 'transporte',
  TESORERIA: 'tesoreria',
  NUTRICION: 'nutricion',
  CAFETERIA: 'cafeteria',
  ASISTENTE: 'asistente',
  ASISTENTE_ACADEMICA: 'asistente-academica',
  SUPER_ADMIN: 'super_admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export type Resource =
  | 'users'
  | 'groups'
  | 'assignments'
  | 'grades'
  | 'submissions'
  | 'comunicados'
  | 'evo_send'
  | 'materials'
  | 'reports'
  | 'institution'
  | 'audit_logs'
  | 'own_profile';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'read_own' | 'update_own';

type PermissionMatrix = Partial<Record<Resource, Partial<Record<Action, boolean>>>>;

const PERMISSIONS: Record<Role, PermissionMatrix> = {
  estudiante: {
    own_profile: { read_own: true, update_own: true },
    assignments: { read_own: true },
    grades: { read_own: true },
    submissions: { create: true, read_own: true, update_own: true },
    comunicados: { read_own: true },
    evo_send: { read_own: true, create: false },
    materials: { read_own: true },
  },

  padre: {
    own_profile: { read_own: true },
    grades: { read_own: true },
    assignments: { read_own: true },
    comunicados: { read_own: true },
    materials: { read_own: true },
  },

  profesor: {
    own_profile: { read_own: true, update_own: true },
    groups: { read: true },
    assignments: { create: true, read: true, update: true, delete: true },
    grades: { create: true, read: true, update: true },
    submissions: { read: true, update: true },
    comunicados: { create: true, read: true, update: true },
    evo_send: { create: true, read: true },
    materials: { create: true, read: true, update: true, delete: true },
    reports: { read: true },
  },

  directivo: {
    own_profile: { read_own: true, update_own: true },
    users: { read: true },
    groups: { read: true },
    assignments: { read: true },
    grades: { read: true },
    submissions: { read: true },
    comunicados: { create: true, read: true, update: true },
    evo_send: { read: true, create: true },
    materials: { read: true },
    reports: { read: true, create: true },
    audit_logs: { read: true },
  },

  'administrador-general': {
    own_profile: { read_own: true, update_own: true },
    users: { create: true, read: true, update: true, delete: true },
    groups: { create: true, read: true, update: true, delete: true },
    assignments: { read: true },
    grades: { read: true },
    comunicados: { create: true, read: true, update: true, delete: true },
    evo_send: { read: true },
    materials: { read: true },
    reports: { create: true, read: true },
    institution: { read: true, update: true },
    audit_logs: { read: true },
  },

  'admin-general-colegio': {
    own_profile: { read_own: true, update_own: true },
    users: { create: true, read: true, update: true, delete: true },
    groups: { create: true, read: true, update: true, delete: true },
    assignments: { create: true, read: true, update: true, delete: true },
    grades: { create: true, read: true, update: true, delete: true },
    submissions: { read: true, update: true },
    comunicados: { create: true, read: true, update: true, delete: true },
    evo_send: { create: true, read: true, delete: true },
    materials: { create: true, read: true, update: true, delete: true },
    reports: { create: true, read: true },
    institution: { read: true, update: true },
    audit_logs: { read: true },
  },

  school_admin: {
    own_profile: { read_own: true, update_own: true },
    users: { create: true, read: true, update: true, delete: true },
    groups: { create: true, read: true, update: true, delete: true },
    assignments: { create: true, read: true, update: true, delete: true },
    grades: { create: true, read: true, update: true, delete: true },
    submissions: { read: true, update: true },
    comunicados: { create: true, read: true, update: true, delete: true },
    evo_send: { create: true, read: true, delete: true },
    materials: { create: true, read: true, update: true, delete: true },
    reports: { create: true, read: true },
    institution: { read: true, update: true },
    audit_logs: { read: true },
  },

  transporte: {
    own_profile: { read_own: true, update_own: true },
    users: { read: true },
  },

  tesoreria: {
    own_profile: { read_own: true, update_own: true },
    users: { read: true },
    reports: { read: true, create: true },
  },

  nutricion: {
    own_profile: { read_own: true, update_own: true },
    users: { read: true },
  },

  cafeteria: {
    own_profile: { read_own: true, update_own: true },
    users: { read: true },
  },

  asistente: {
    own_profile: { read_own: true, update_own: true },
    users: { read: true },
    groups: { read: true },
    reports: { read: true },
    audit_logs: { read: true },
  },

  'asistente-academica': {
    own_profile: { read_own: true, update_own: true },
    users: { read: true },
    groups: { read: true },
    assignments: { read: true },
    grades: { read: true },
    submissions: { read: true },
    comunicados: { create: true, read: true, update: true },
    evo_send: { read: true, create: true },
    materials: { read: true },
    reports: { read: true, create: true },
    audit_logs: { read: true },
  },

  super_admin: {
    users: { create: true, read: true, update: true, delete: true },
    groups: { create: true, read: true, update: true, delete: true },
    assignments: { create: true, read: true, update: true, delete: true },
    grades: { create: true, read: true, update: true, delete: true },
    submissions: { create: true, read: true, update: true, delete: true },
    comunicados: { create: true, read: true, update: true, delete: true },
    evo_send: { create: true, read: true, update: true, delete: true },
    materials: { create: true, read: true, update: true, delete: true },
    reports: { create: true, read: true, update: true, delete: true },
    institution: { create: true, read: true, update: true, delete: true },
    audit_logs: { read: true },
    own_profile: { read_own: true, update_own: true },
  },
};

export function can(role: string, resource: Resource, action: Action): boolean {
  const matrix = PERMISSIONS[role as Role];
  if (!matrix) return false;
  return matrix[resource]?.[action] === true;
}

function inRoleList(role: string, list: readonly Role[]): boolean {
  return list.includes(role as Role);
}

export function isAdmin(role: string): boolean {
  return inRoleList(role, [
    ROLES.ADMIN_COLEGIO,
    ROLES.SCHOOL_ADMIN,
    ROLES.ADMIN_GENERAL,
    ROLES.SUPER_ADMIN,
  ]);
}

export function canViewInstitution(role: string): boolean {
  return inRoleList(role, [
    ROLES.DIRECTIVO,
    ROLES.ADMIN_COLEGIO,
    ROLES.SCHOOL_ADMIN,
    ROLES.ADMIN_GENERAL,
    ROLES.SUPER_ADMIN,
    ROLES.ASISTENTE,
    ROLES.ASISTENTE_ACADEMICA,
  ]);
}

export function canViewAllGrades(role: string): boolean {
  return inRoleList(role, [
    ROLES.DIRECTIVO,
    ROLES.ADMIN_COLEGIO,
    ROLES.SCHOOL_ADMIN,
    ROLES.ADMIN_GENERAL,
    ROLES.SUPER_ADMIN,
    ROLES.ASISTENTE_ACADEMICA,
  ]);
}

export function canCreateChatGroup(role: string): boolean {
  return inRoleList(role, [
    ROLES.PROFESOR,
    ROLES.DIRECTIVO,
    ROLES.ADMIN_COLEGIO,
    ROLES.SCHOOL_ADMIN,
    ROLES.SUPER_ADMIN,
    ROLES.ASISTENTE_ACADEMICA,
  ]);
}
