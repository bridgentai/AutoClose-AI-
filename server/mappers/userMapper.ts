import type { UserRow } from '../repositories/userRepository.js';

/** Map PG user row to API response shape (Mongo-like for frontend compatibility). */
export function toAuthResponse(row: UserRow): Record<string, unknown> {
  return {
    _id: row.id,
    id: row.id,
    nombre: row.full_name,
    correo: row.email,
    email: row.email,
    rol: row.role,
    colegioId: row.institution_id,
    sectionId: row.section_id ?? null,
    estado: row.status,
    createdAt: row.created_at,
    configuraciones: row.config ?? {},
    codigoInterno: row.internal_code ?? undefined,
    consentimientoTerminos: row.consent_terms,
    consentimientoPrivacidad: row.consent_privacy,
  };
}

export function toUserResponse(row: UserRow): Record<string, unknown> {
  return {
    _id: row.id,
    id: row.id,
    nombre: row.full_name,
    correo: row.email,
    email: row.email,
    rol: row.role,
    colegioId: row.institution_id,
    sectionId: row.section_id ?? null,
    estado: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    configuraciones: row.config ?? {},
    codigoInterno: row.internal_code ?? undefined,
    telefono: row.phone ?? undefined,
    fechaNacimiento: row.date_of_birth ?? undefined,
  };
}
