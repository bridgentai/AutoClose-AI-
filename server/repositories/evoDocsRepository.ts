import { queryPg } from '../config/db-pg.js';

export interface EvoDocRow {
  id: string;
  institution_id: string;
  created_by_id: string;
  title: string;
  description: string | null;
  doc_type: string;
  subject_name: string | null;
  subject_id: string | null;
  period: string | null;
  metadata: Record<string, unknown>;
  pdf_path: string;
  status: string;
  created_at: string;
}

export async function insertEvoDoc(row: {
  institution_id: string;
  created_by_id: string;
  title: string;
  description?: string;
  doc_type: string;
  subject_name?: string;
  subject_id?: string;
  period?: string;
  metadata?: Record<string, unknown>;
  pdf_path: string;
}): Promise<EvoDocRow> {
  const r = await queryPg<EvoDocRow>(
    `INSERT INTO evo_docs
       (institution_id, created_by_id, title, description, doc_type,
        subject_name, subject_id, period, metadata, pdf_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      row.institution_id,
      row.created_by_id,
      row.title,
      row.description ?? null,
      row.doc_type,
      row.subject_name ?? null,
      row.subject_id ?? null,
      row.period ?? null,
      JSON.stringify(row.metadata ?? {}),
      row.pdf_path,
    ]
  );
  return r.rows[0];
}

export async function findEvoDocsByUser(
  userId: string,
  institutionId: string,
  limit = 50
): Promise<EvoDocRow[]> {
  const r = await queryPg<EvoDocRow>(
    `SELECT * FROM evo_docs
     WHERE created_by_id = $1 AND institution_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, institutionId, limit]
  );
  return r.rows;
}

export async function findEvoDocById(
  id: string,
  institutionId: string
): Promise<EvoDocRow | null> {
  const r = await queryPg<EvoDocRow>(
    `SELECT * FROM evo_docs WHERE id = $1 AND institution_id = $2 LIMIT 1`,
    [id, institutionId]
  );
  return r.rows[0] ?? null;
}

export async function findEvoDocsByInstitution(
  institutionId: string,
  limit = 100
): Promise<EvoDocRow[]> {
  const r = await queryPg<EvoDocRow>(
    `SELECT * FROM evo_docs
     WHERE institution_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [institutionId, limit]
  );
  return r.rows;
}
