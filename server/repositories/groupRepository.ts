import { queryPg } from '../config/db-pg.js';

export interface GroupRow {
  id: string;
  institution_id: string;
  section_id: string;
  name: string;
  description: string | null;
  academic_period_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function findGroupById(id: string): Promise<GroupRow | null> {
  const r = await queryPg<GroupRow>(
    'SELECT * FROM groups WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findGroupsByInstitution(institutionId: string): Promise<GroupRow[]> {
  const r = await queryPg<GroupRow>(
    'SELECT * FROM groups WHERE institution_id = $1 ORDER BY name',
    [institutionId]
  );
  return r.rows;
}

/** Count only grade groups (name starts with a digit), e.g. 9H, 10C, not "Física 11H". */
export async function countGradeGroupsByInstitution(institutionId: string): Promise<number> {
  const r = await queryPg<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM groups WHERE institution_id = $1 AND name ~ '^[0-9]'",
    [institutionId]
  );
  return r.rows[0]?.c ?? 0;
}

export async function findGroupsBySection(sectionId: string): Promise<GroupRow[]> {
  const r = await queryPg<GroupRow>(
    'SELECT * FROM groups WHERE section_id = $1 ORDER BY name',
    [sectionId]
  );
  return r.rows;
}

export async function findGroupByNameAndInstitution(institutionId: string, name: string): Promise<GroupRow | null> {
  // Default to case-insensitive, trimmed lookup so that minor
  // formatting differences in group names do not break lookups.
  return findGroupByNameAndInstitutionCaseInsensitive(institutionId, name);
}

export async function updateGroupSection(groupId: string, institutionId: string, sectionId: string): Promise<GroupRow | null> {
  const r = await queryPg<GroupRow>(
    'UPDATE groups SET section_id = $1, updated_at = now() WHERE id = $2 AND institution_id = $3 RETURNING *',
    [sectionId, groupId, institutionId]
  );
  return r.rows[0] ?? null;
}

export async function createGroup(row: {
  institution_id: string;
  section_id: string;
  name: string;
  description?: string | null;
  academic_period_id?: string | null;
}): Promise<GroupRow> {
  const r = await queryPg<GroupRow>(
    'INSERT INTO groups (institution_id, section_id, name, description, academic_period_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [
      row.institution_id,
      row.section_id,
      row.name,
      row.description ?? null,
      row.academic_period_id ?? null,
    ]
  );
  return r.rows[0];
}

export async function findGroupByNameAndInstitutionCaseInsensitive(institutionId: string, name: string): Promise<GroupRow | null> {
  const r = await queryPg<GroupRow>(
    'SELECT * FROM groups WHERE institution_id = $1 AND UPPER(TRIM(name)) = UPPER(TRIM($2))',
    [institutionId, name]
  );
  return r.rows[0] ?? null;
}
