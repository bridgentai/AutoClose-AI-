import { queryPg } from '../config/db-pg.js';

export interface SectionRow {
  id: string;
  institution_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export async function findSectionById(id: string): Promise<SectionRow | null> {
  const r = await queryPg<SectionRow>(
    'SELECT * FROM sections WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findSectionsByInstitution(institutionId: string): Promise<SectionRow[]> {
  const r = await queryPg<SectionRow>(
    'SELECT * FROM sections WHERE institution_id = $1 ORDER BY name',
    [institutionId]
  );
  return r.rows;
}

export async function createSection(institutionId: string, name: string): Promise<SectionRow> {
  const r = await queryPg<SectionRow>(
    'INSERT INTO sections (institution_id, name) VALUES ($1, $2) RETURNING *',
    [institutionId, name]
  );
  return r.rows[0];
}

export async function updateSectionName(id: string, institutionId: string, name: string): Promise<SectionRow | null> {
  const r = await queryPg<SectionRow>(
    'UPDATE sections SET name = $1, updated_at = now() WHERE id = $2 AND institution_id = $3 RETURNING *',
    [name, id, institutionId]
  );
  return r.rows[0] ?? null;
}

export async function findSectionByInstitutionAndName(institutionId: string, name: string): Promise<SectionRow | null> {
  const r = await queryPg<SectionRow>(
    'SELECT * FROM sections WHERE institution_id = $1 AND name = $2',
    [institutionId, name]
  );
  return r.rows[0] ?? null;
}
