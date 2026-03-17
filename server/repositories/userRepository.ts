import { queryPg } from '../config/db-pg.js';

export interface UserRow {
  id: string;
  institution_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  status: string;
  internal_code: string | null;
  phone: string | null;
  date_of_birth: string | null;
  consent_terms: boolean;
  consent_privacy: boolean;
  consent_at: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const r = await queryPg<UserRow>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findUserByEmailAndInstitution(
  email: string,
  institutionId: string
): Promise<UserRow | null> {
  const r = await queryPg<UserRow>(
    'SELECT * FROM users WHERE email = $1 AND institution_id = $2',
    [email.toLowerCase(), institutionId]
  );
  return r.rows[0] ?? null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const r = await queryPg<UserRow>(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email.toLowerCase()]
  );
  return r.rows[0] ?? null;
}

export async function findUsersByInstitution(institutionId: string): Promise<UserRow[]> {
  const r = await queryPg<UserRow>(
    'SELECT * FROM users WHERE institution_id = $1 ORDER BY full_name',
    [institutionId]
  );
  return r.rows;
}

/** Find users by institution and roles (e.g. profesores + directivos for staff groups). */
export async function findUsersByInstitutionAndRoles(
  institutionId: string,
  roles: string[]
): Promise<UserRow[]> {
  if (roles.length === 0) return [];
  const r = await queryPg<UserRow>(
    'SELECT * FROM users WHERE institution_id = $1 AND role = ANY($2::text[]) ORDER BY full_name',
    [institutionId, roles]
  );
  return r.rows;
}

export async function findUsersByIds(ids: string[]): Promise<UserRow[]> {
  if (ids.length === 0) return [];
  const r = await queryPg<UserRow>(
    `SELECT * FROM users WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return r.rows;
}

export async function findUserByInternalCode(institutionId: string, code: string): Promise<UserRow | null> {
  const r = await queryPg<UserRow>(
    'SELECT * FROM users WHERE institution_id = $1 AND internal_code = $2 LIMIT 1',
    [institutionId, code]
  );
  return r.rows[0] ?? null;
}

/** Check if any user has this internal_code (for generating unique codes). */
export async function findUserByInternalCodeAny(code: string): Promise<UserRow | null> {
  const r = await queryPg<UserRow>(
    'SELECT * FROM users WHERE internal_code = $1 LIMIT 1',
    [code]
  );
  return r.rows[0] ?? null;
}

export async function createUser(row: {
  institution_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  status?: string;
  internal_code?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  config?: Record<string, unknown>;
}): Promise<UserRow> {
  const r = await queryPg<UserRow>(
    `INSERT INTO users (institution_id, email, password_hash, full_name, role, status, internal_code, phone, date_of_birth, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      row.institution_id,
      row.email.toLowerCase(),
      row.password_hash,
      row.full_name,
      row.role,
      row.status ?? 'active',
      row.internal_code ?? null,
      row.phone ?? null,
      row.date_of_birth ?? null,
      JSON.stringify(row.config ?? {}),
    ]
  );
  return r.rows[0];
}

export async function updateUser(id: string, updates: {
  full_name?: string;
  email?: string;
  password_hash?: string;
  status?: string;
  internal_code?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  consent_terms?: boolean;
  consent_privacy?: boolean;
  consent_at?: string | null;
  config?: Record<string, unknown>;
}): Promise<UserRow | null> {
  const sets: string[] = ['updated_at = now()'];
  const values: unknown[] = [];
  let i = 1;
  if (updates.full_name !== undefined) { sets.push(`full_name = $${i++}`); values.push(updates.full_name); }
  if (updates.email !== undefined) { sets.push(`email = $${i++}`); values.push(updates.email.toLowerCase()); }
  if (updates.password_hash !== undefined) { sets.push(`password_hash = $${i++}`); values.push(updates.password_hash); }
  if (updates.status !== undefined) { sets.push(`status = $${i++}`); values.push(updates.status); }
  if (updates.internal_code !== undefined) { sets.push(`internal_code = $${i++}`); values.push(updates.internal_code); }
  if (updates.phone !== undefined) { sets.push(`phone = $${i++}`); values.push(updates.phone); }
  if (updates.date_of_birth !== undefined) { sets.push(`date_of_birth = $${i++}`); values.push(updates.date_of_birth); }
  if (updates.consent_terms !== undefined) { sets.push(`consent_terms = $${i++}`); values.push(updates.consent_terms); }
  if (updates.consent_privacy !== undefined) { sets.push(`consent_privacy = $${i++}`); values.push(updates.consent_privacy); }
  if (updates.consent_at !== undefined) { sets.push(`consent_at = $${i++}`); values.push(updates.consent_at); }
  if (updates.config !== undefined) { sets.push(`config = $${i++}`); values.push(JSON.stringify(updates.config)); }
  if (values.length === 1) return findUserById(id);
  values.push(id);
  const r = await queryPg<UserRow>(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return r.rows[0] ?? null;
}

export async function countUsersByInstitutionAndRole(
  institutionId: string,
  role?: string,
  status?: string
): Promise<number> {
  let q = 'SELECT COUNT(*)::int AS c FROM users WHERE institution_id = $1';
  const params: unknown[] = [institutionId];
  let idx = 2;
  if (role) { q += ` AND role = $${idx++}`; params.push(role); }
  if (status) { q += ` AND status = $${idx++}`; params.push(status); }
  const r = await queryPg<{ c: number }>(q, params);
  return r.rows[0]?.c ?? 0;
}
