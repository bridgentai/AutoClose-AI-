import { queryPg } from '../config/db-pg.js';

export interface GradingCategoryRow {
  id: string;
  grading_schema_id: string;
  institution_id: string;
  grading_outcome_id: string | null;
  name: string;
  weight: number;
  sort_order: number;
  evaluation_type: string;
  risk_impact_multiplier: number;
  created_at: string;
  updated_at: string;
}

export async function findGradingCategoriesBySchema(gradingSchemaId: string): Promise<GradingCategoryRow[]> {
  const r = await queryPg<GradingCategoryRow>(
    `SELECT gc.* FROM grading_categories gc
     LEFT JOIN grading_outcomes go ON go.id = gc.grading_outcome_id
     WHERE gc.grading_schema_id = $1
     ORDER BY COALESCE(go.sort_order, 2147483647), gc.sort_order`,
    [gradingSchemaId]
  );
  return r.rows;
}

export async function findGradingCategoryById(id: string): Promise<GradingCategoryRow | null> {
  const r = await queryPg<GradingCategoryRow>(
    'SELECT * FROM grading_categories WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}
