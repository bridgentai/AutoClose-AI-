import { queryPg } from '../config/db-pg.js';

export interface SubjectRow {
  id: string;
  institution_id: string;
  name: string;
  description: string | null;
  area: string | null;
  created_at: string;
  updated_at: string;
}

export async function findSubjectById(id: string): Promise<SubjectRow | null> {
  const r = await queryPg<SubjectRow>(
    'SELECT * FROM subjects WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findSubjectsByInstitution(institutionId: string): Promise<SubjectRow[]> {
  const r = await queryPg<SubjectRow>(
    'SELECT * FROM subjects WHERE institution_id = $1 ORDER BY name',
    [institutionId]
  );
  return r.rows;
}

export async function findSubjectByNameAndInstitution(institutionId: string, name: string): Promise<SubjectRow | null> {
  const r = await queryPg<SubjectRow>(
    'SELECT * FROM subjects WHERE institution_id = $1 AND name = $2 LIMIT 1',
    [institutionId, name]
  );
  return r.rows[0] ?? null;
}

export async function createSubject(row: {
  institution_id: string;
  name: string;
  description?: string | null;
  area?: string | null;
}): Promise<SubjectRow> {
  const r = await queryPg<SubjectRow>(
    'INSERT INTO subjects (institution_id, name, description, area) VALUES ($1, $2, $3, $4) RETURNING *',
    [row.institution_id, row.name, row.description ?? null, row.area ?? null]
  );
  return r.rows[0];
}

export async function updateSubject(id: string, institutionId: string, updates: { name?: string; description?: string | null; area?: string | null }): Promise<SubjectRow | null> {
  const sets: string[] = ['updated_at = now()'];
  const values: unknown[] = [];
  let i = 1;
  if (updates.name !== undefined) { sets.push(`name = $${i++}`); values.push(updates.name); }
  if (updates.description !== undefined) { sets.push(`description = $${i++}`); values.push(updates.description); }
  if (updates.area !== undefined) { sets.push(`area = $${i++}`); values.push(updates.area); }
  if (values.length === 1) return findSubjectById(id);
  values.push(id, institutionId);
  const q = await queryPg<SubjectRow>(`UPDATE subjects SET ${sets.join(', ')} WHERE id = $${i} AND institution_id = $${i + 1} RETURNING *`, values);
  return q.rows[0] ?? null;
}
