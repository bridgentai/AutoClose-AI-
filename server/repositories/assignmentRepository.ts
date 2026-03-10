import { queryPg } from '../config/db-pg.js';

export interface AssignmentRow {
  id: string;
  group_subject_id: string;
  title: string;
  description: string | null;
  content_document: string | null;
  due_date: string;
  max_score: number;
  assignment_category_id: string | null;
  created_by: string;
  type: string;
  is_gradable: boolean;
  created_at: string;
}

export async function findAssignmentById(id: string): Promise<AssignmentRow | null> {
  const r = await queryPg<AssignmentRow>(
    'SELECT * FROM assignments WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findAssignmentsByGroupSubject(groupSubjectId: string): Promise<AssignmentRow[]> {
  const r = await queryPg<AssignmentRow>(
    'SELECT * FROM assignments WHERE group_subject_id = $1 ORDER BY due_date',
    [groupSubjectId]
  );
  return r.rows;
}

export async function findAssignmentsByGroupSubjectAndDue(
  groupSubjectId: string,
  fromDate?: string,
  toDate?: string
): Promise<AssignmentRow[]> {
  if (!fromDate && !toDate) {
    return findAssignmentsByGroupSubject(groupSubjectId);
  }
  let q = 'SELECT * FROM assignments WHERE group_subject_id = $1';
  const params: unknown[] = [groupSubjectId];
  if (fromDate) {
    params.push(fromDate);
    q += ` AND due_date >= $${params.length}`;
  }
  if (toDate) {
    params.push(toDate);
    q += ` AND due_date <= $${params.length}`;
  }
  q += ' ORDER BY due_date';
  const r = await queryPg<AssignmentRow>(q, params);
  return r.rows;
}

export async function createAssignment(row: {
  group_subject_id: string;
  title: string;
  description?: string | null;
  content_document?: string | null;
  due_date: string;
  max_score?: number;
  assignment_category_id?: string | null;
  created_by: string;
  type?: string;
  is_gradable?: boolean;
}): Promise<AssignmentRow> {
  const r = await queryPg<AssignmentRow>(
    `INSERT INTO assignments (group_subject_id, title, description, content_document, due_date, max_score, assignment_category_id, created_by, "type", is_gradable)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      row.group_subject_id,
      row.title,
      row.description ?? null,
      row.content_document ?? null,
      row.due_date,
      row.max_score ?? 100,
      row.assignment_category_id ?? null,
      row.created_by,
      row.type ?? 'assignment',
      row.is_gradable ?? true,
    ]
  );
  return r.rows[0];
}

export async function updateAssignment(id: string, updates: {
  title?: string;
  description?: string | null;
  content_document?: string | null;
  due_date?: string;
  max_score?: number;
  type?: string;
  is_gradable?: boolean;
}): Promise<AssignmentRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (updates.title !== undefined) { sets.push(`title = $${i++}`); values.push(updates.title); }
  if (updates.description !== undefined) { sets.push(`description = $${i++}`); values.push(updates.description); }
  if (updates.content_document !== undefined) { sets.push(`content_document = $${i++}`); values.push(updates.content_document); }
  if (updates.due_date !== undefined) { sets.push(`due_date = $${i++}`); values.push(updates.due_date); }
  if (updates.max_score !== undefined) { sets.push(`max_score = $${i++}`); values.push(updates.max_score); }
  if (updates.type !== undefined) { sets.push(`"type" = $${i++}`); values.push(updates.type); }
  if (updates.is_gradable !== undefined) { sets.push(`is_gradable = $${i++}`); values.push(updates.is_gradable); }
  if (sets.length === 0) return findAssignmentById(id);
  values.push(id);
  const r = await queryPg<AssignmentRow>(`UPDATE assignments SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return r.rows[0] ?? null;
}

export async function deleteAssignment(id: string): Promise<boolean> {
  const r = await queryPg('DELETE FROM assignments WHERE id = $1 RETURNING 1', [id]);
  return (r.rowCount ?? 0) > 0;
}
