import { queryPg } from '../config/db-pg.js';

export interface GradingSchemaRow {
  id: string;
  group_id: string;
  institution_id: string;
  name: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function findGradingSchemaById(id: string): Promise<GradingSchemaRow | null> {
  const r = await queryPg<GradingSchemaRow>(
    'SELECT * FROM grading_schemas WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findGradingSchemaByGroup(
  groupId: string,
  institutionId?: string
): Promise<GradingSchemaRow | null> {
  if (institutionId) {
    const r = await queryPg<GradingSchemaRow>(
      'SELECT * FROM grading_schemas WHERE group_id = $1 AND institution_id = $2 AND is_active = true ORDER BY version DESC LIMIT 1',
      [groupId, institutionId]
    );
    return r.rows[0] ?? null;
  }
  const r = await queryPg<GradingSchemaRow>(
    'SELECT * FROM grading_schemas WHERE group_id = $1 AND is_active = true ORDER BY version DESC LIMIT 1',
    [groupId]
  );
  return r.rows[0] ?? null;
}
