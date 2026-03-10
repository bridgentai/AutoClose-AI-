import { queryPg } from '../config/db-pg.js';

export interface LearningResourceRow {
  id: string;
  institution_id: string;
  subject_id: string | null;
  group_id: string | null;
  title: string;
  description: string | null;
  type: string;
  url: string | null;
  content: string | null;
  uploaded_by_id: string | null;
  created_at: string;
}

export async function findLearningResourcesByInstitution(
  institutionId: string,
  opts?: { subjectId?: string; groupId?: string }
): Promise<LearningResourceRow[]> {
  let q = 'SELECT * FROM learning_resources WHERE institution_id = $1';
  const params: unknown[] = [institutionId];
  let i = 2;
  if (opts?.subjectId) {
    q += ` AND subject_id = $${i}`;
    params.push(opts.subjectId);
    i++;
  }
  if (opts?.groupId) {
    q += ` AND (group_id = $${i} OR group_id IS NULL)`;
    params.push(opts.groupId);
    i++;
  }
  q += ' ORDER BY created_at DESC';
  const r = await queryPg<LearningResourceRow>(q, params);
  return r.rows;
}

export async function findLearningResourceById(id: string): Promise<LearningResourceRow | null> {
  const r = await queryPg<LearningResourceRow>(
    'SELECT * FROM learning_resources WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function createLearningResource(row: {
  institution_id: string;
  subject_id?: string | null;
  group_id?: string | null;
  title: string;
  description?: string | null;
  type?: string;
  url?: string | null;
  content?: string | null;
  uploaded_by_id?: string | null;
}): Promise<LearningResourceRow> {
  const allowedTypes = ['pdf', 'link', 'video', 'document', 'other'];
  const type = allowedTypes.includes(row.type ?? '') ? row.type : 'other';
  const r = await queryPg<LearningResourceRow>(
    `INSERT INTO learning_resources (institution_id, subject_id, group_id, title, description, type, url, content, uploaded_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      row.institution_id,
      row.subject_id ?? null,
      row.group_id ?? null,
      row.title,
      row.description ?? null,
      type,
      row.url ?? null,
      row.content ?? null,
      row.uploaded_by_id ?? null,
    ]
  );
  return r.rows[0];
}

export async function deleteLearningResource(id: string): Promise<boolean> {
  const r = await queryPg('DELETE FROM learning_resources WHERE id = $1 RETURNING id', [id]);
  return (r.rowCount ?? 0) > 0;
}
