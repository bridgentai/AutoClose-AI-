import { queryPg } from '../config/db-pg.js';

export interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  score: number | null;
  feedback: string | null;
  status: string;
  late: boolean;
  missing: boolean;
  excused: boolean;
  submitted_at: string | null;
  comment: string | null;
  attachments: unknown;
  created_at: string;
  updated_at: string;
}

export async function findSubmissionById(id: string): Promise<SubmissionRow | null> {
  const r = await queryPg<SubmissionRow>(
    'SELECT * FROM submissions WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findSubmissionsByAssignment(assignmentId: string): Promise<SubmissionRow[]> {
  const r = await queryPg<SubmissionRow>(
    'SELECT * FROM submissions WHERE assignment_id = $1',
    [assignmentId]
  );
  return r.rows;
}

export async function findSubmissionsByStudent(studentId: string): Promise<SubmissionRow[]> {
  const r = await queryPg<SubmissionRow>(
    'SELECT * FROM submissions WHERE student_id = $1 ORDER BY created_at DESC',
    [studentId]
  );
  return r.rows;
}

export async function findSubmissionByAssignmentAndStudent(
  assignmentId: string,
  studentId: string
): Promise<SubmissionRow | null> {
  const r = await queryPg<SubmissionRow>(
    'SELECT * FROM submissions WHERE assignment_id = $1 AND student_id = $2',
    [assignmentId, studentId]
  );
  return r.rows[0] ?? null;
}

export async function createSubmission(row: {
  assignment_id: string;
  student_id: string;
  status?: string;
  score?: number | null;
  feedback?: string | null;
  submitted_at?: string | null;
  comment?: string | null;
  attachments?: unknown;
}): Promise<SubmissionRow> {
  const r = await queryPg<SubmissionRow>(
    `INSERT INTO submissions (assignment_id, student_id, status, score, feedback, submitted_at, comment, attachments)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      row.assignment_id,
      row.student_id,
      row.status ?? 'draft',
      row.score ?? null,
      row.feedback ?? null,
      row.submitted_at ?? null,
      row.comment ?? null,
      row.attachments != null ? JSON.stringify(row.attachments) : '[]',
    ]
  );
  return r.rows[0];
}

export async function updateSubmission(id: string, updates: {
  score?: number | null;
  feedback?: string | null;
  status?: string;
  submitted_at?: string | null;
  late?: boolean;
  missing?: boolean;
  excused?: boolean;
  comment?: string | null;
  attachments?: unknown;
}): Promise<SubmissionRow | null> {
  const sets: string[] = ['updated_at = now()'];
  const values: unknown[] = [];
  let i = 1;
  if (updates.score !== undefined) { sets.push(`score = $${i++}`); values.push(updates.score); }
  if (updates.feedback !== undefined) { sets.push(`feedback = $${i++}`); values.push(updates.feedback); }
  if (updates.status !== undefined) { sets.push(`status = $${i++}`); values.push(updates.status); }
  if (updates.submitted_at !== undefined) { sets.push(`submitted_at = $${i++}`); values.push(updates.submitted_at); }
  if (updates.late !== undefined) { sets.push(`late = $${i++}`); values.push(updates.late); }
  if (updates.missing !== undefined) { sets.push(`missing = $${i++}`); values.push(updates.missing); }
  if (updates.excused !== undefined) { sets.push(`excused = $${i++}`); values.push(updates.excused); }
  if (updates.comment !== undefined) { sets.push(`comment = $${i++}`); values.push(updates.comment); }
  if (updates.attachments !== undefined) { sets.push(`attachments = $${i++}`); values.push(typeof updates.attachments === 'string' ? updates.attachments : JSON.stringify(updates.attachments ?? [])); }
  if (values.length === 1) return findSubmissionById(id);
  values.push(id);
  const r = await queryPg<SubmissionRow>(`UPDATE submissions SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return r.rows[0] ?? null;
}
