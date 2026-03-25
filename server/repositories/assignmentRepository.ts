import { queryPg } from '../config/db-pg.js';
import {
  ensureAssignmentsRequiresSubmissionColumn,
  ensureAssignmentsCategoryWeightPctColumn,
  ensureAssignmentsAcademicTermColumn,
} from '../db/pgSchemaPatches.js';

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
  requires_submission: boolean;
  created_at: string;
  category_weight_pct?: number | null;
  academic_term?: number;
}

export async function findAssignmentById(id: string): Promise<AssignmentRow | null> {
  await ensureAssignmentsAcademicTermColumn();
  await ensureAssignmentsCategoryWeightPctColumn();
  const r = await queryPg<AssignmentRow & { requires_submission?: boolean }>(
    'SELECT * FROM assignments WHERE id = $1',
    [id]
  );
  const row = r.rows[0];
  if (!row) return null;
  const requires =
    row.type === 'reminder' ? false : row.requires_submission === false ? false : true;
  return { ...row, requires_submission: requires };
}

export async function findAssignmentsByGroupSubject(
  groupSubjectId: string,
  academicTerm?: number | null
): Promise<AssignmentRow[]> {
  await ensureAssignmentsAcademicTermColumn();
  await ensureAssignmentsCategoryWeightPctColumn();
  const filterTerm =
    academicTerm === 1 || academicTerm === 2 || academicTerm === 3 ? academicTerm : null;
  const r = filterTerm != null
    ? await queryPg<AssignmentRow>(
        'SELECT * FROM assignments WHERE group_subject_id = $1 AND academic_term = $2 ORDER BY due_date',
        [groupSubjectId, filterTerm]
      )
    : await queryPg<AssignmentRow>(
        'SELECT * FROM assignments WHERE group_subject_id = $1 ORDER BY due_date',
        [groupSubjectId]
      );
  return r.rows;
}

export async function findAssignmentsByGroupSubjectAndDue(
  groupSubjectId: string,
  fromDate?: string,
  toDate?: string,
  academicTerm?: number | null
): Promise<AssignmentRow[]> {
  if (!fromDate && !toDate) {
    return findAssignmentsByGroupSubject(groupSubjectId, academicTerm);
  }
  await ensureAssignmentsAcademicTermColumn();
  await ensureAssignmentsCategoryWeightPctColumn();
  const filterTerm =
    academicTerm === 1 || academicTerm === 2 || academicTerm === 3 ? academicTerm : null;
  let q = 'SELECT * FROM assignments WHERE group_subject_id = $1';
  const params: unknown[] = [groupSubjectId];
  if (filterTerm != null) {
    params.push(filterTerm);
    q += ` AND academic_term = $${params.length}`;
  }
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
  requires_submission?: boolean;
  category_weight_pct?: number | null;
  academic_term?: number;
}): Promise<AssignmentRow> {
  await ensureAssignmentsAcademicTermColumn();
  await ensureAssignmentsCategoryWeightPctColumn();
  const requiresSubmission = row.requires_submission !== false;
  let term = row.academic_term ?? 1;
  if (term !== 1 && term !== 2 && term !== 3) term = 1;
  const values = [
    row.group_subject_id,
    row.title,
    row.description ?? null,
    row.content_document ?? null,
    row.due_date,
    row.max_score ?? (requiresSubmission ? 100 : 0),
    row.assignment_category_id ?? null,
    row.created_by,
    row.type ?? 'assignment',
    row.is_gradable ?? requiresSubmission,
    requiresSubmission,
    row.category_weight_pct ?? null,
    term,
  ];
  const sql = `INSERT INTO assignments (group_subject_id, title, description, content_document, due_date, max_score, assignment_category_id, created_by, "type", is_gradable, requires_submission, category_weight_pct, academic_term)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`;
  try {
    const r = await queryPg<AssignmentRow>(sql, values);
    return r.rows[0];
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === '42703') {
      const msg = (err.message ?? '').toLowerCase();
      if (msg.includes('requires_submission')) {
        await ensureAssignmentsRequiresSubmissionColumn();
        const r = await queryPg<AssignmentRow>(sql, values);
        return r.rows[0];
      }
      if (msg.includes('category_weight_pct')) {
        await ensureAssignmentsCategoryWeightPctColumn();
        const r = await queryPg<AssignmentRow>(sql, values);
        return r.rows[0];
      }
      if (msg.includes('academic_term')) {
        await ensureAssignmentsAcademicTermColumn();
        const r = await queryPg<AssignmentRow>(sql, values);
        return r.rows[0];
      }
    }
    throw e;
  }
}

export async function updateAssignment(id: string, updates: {
  title?: string;
  description?: string | null;
  content_document?: string | null;
  due_date?: string;
  max_score?: number;
  type?: string;
  is_gradable?: boolean;
  requires_submission?: boolean;
  category_weight_pct?: number | null;
  academic_term?: number;
}): Promise<AssignmentRow | null> {
  await ensureAssignmentsAcademicTermColumn();
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
  if (updates.requires_submission !== undefined) { sets.push(`requires_submission = $${i++}`); values.push(updates.requires_submission); }
  if (updates.category_weight_pct !== undefined) {
    sets.push(`category_weight_pct = $${i++}`);
    values.push(updates.category_weight_pct);
  }
  if (updates.academic_term !== undefined) {
    let t = updates.academic_term;
    if (t !== 1 && t !== 2 && t !== 3) t = 1;
    sets.push(`academic_term = $${i++}`);
    values.push(t);
  }
  if (sets.length === 0) return findAssignmentById(id);
  values.push(id);
  const r = await queryPg<AssignmentRow>(`UPDATE assignments SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return r.rows[0] ?? null;
}

export async function deleteAssignment(id: string): Promise<boolean> {
  const r = await queryPg('DELETE FROM assignments WHERE id = $1 RETURNING 1', [id]);
  return (r.rowCount ?? 0) > 0;
}
