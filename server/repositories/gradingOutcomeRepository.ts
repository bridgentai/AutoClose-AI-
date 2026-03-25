import { queryPg } from '../config/db-pg.js';

export interface GradingOutcomeRow {
  id: string;
  grading_schema_id: string;
  institution_id: string;
  description: string;
  weight: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function findGradingOutcomesBySchema(schemaId: string): Promise<GradingOutcomeRow[]> {
  const r = await queryPg<GradingOutcomeRow>(
    'SELECT * FROM grading_outcomes WHERE grading_schema_id = $1 ORDER BY sort_order, created_at',
    [schemaId]
  );
  return r.rows;
}

export async function findGradingOutcomeById(id: string): Promise<GradingOutcomeRow | null> {
  const r = await queryPg<GradingOutcomeRow>('SELECT * FROM grading_outcomes WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}
