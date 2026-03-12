import { queryPg } from '../config/db-pg.js';

export interface EvoCategoryRow {
  id: string;
  group_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export async function getCategoriesByGroup(groupId: string): Promise<EvoCategoryRow[]> {
  const r = await queryPg<EvoCategoryRow>(
    `SELECT * FROM evo_categories WHERE group_id = $1 ORDER BY sort_order ASC, name ASC`,
    [groupId]
  );
  return r.rows;
}

export async function createCategory(data: {
  group_id: string;
  name: string;
  sort_order?: number;
}): Promise<EvoCategoryRow> {
  const r = await queryPg<EvoCategoryRow>(
    `INSERT INTO evo_categories (group_id, name, sort_order)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.group_id, data.name.trim(), data.sort_order ?? 0]
  );
  return r.rows[0];
}

export async function getCategoryById(id: string, groupId: string): Promise<EvoCategoryRow | null> {
  const r = await queryPg<EvoCategoryRow>(
    `SELECT * FROM evo_categories WHERE id = $1 AND group_id = $2`,
    [id, groupId]
  );
  return r.rows[0] ?? null;
}
