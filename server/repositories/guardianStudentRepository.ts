import { queryPg } from '../config/db-pg.js';

export interface GuardianStudentRow {
  guardian_id: string;
  student_id: string;
  institution_id: string;
  created_at: string;
}

export async function findGuardianStudentsByGuardian(guardianId: string): Promise<GuardianStudentRow[]> {
  const r = await queryPg<GuardianStudentRow>(
    'SELECT * FROM guardian_students WHERE guardian_id = $1 ORDER BY created_at',
    [guardianId]
  );
  return r.rows;
}

export async function findGuardianStudentsByStudent(studentId: string): Promise<GuardianStudentRow[]> {
  const r = await queryPg<GuardianStudentRow>(
    'SELECT * FROM guardian_students WHERE student_id = $1 ORDER BY created_at',
    [studentId]
  );
  return r.rows;
}

export async function findGuardianStudent(
  guardianId: string,
  studentId: string
): Promise<GuardianStudentRow | null> {
  const r = await queryPg<GuardianStudentRow>(
    'SELECT * FROM guardian_students WHERE guardian_id = $1 AND student_id = $2',
    [guardianId, studentId]
  );
  return r.rows[0] ?? null;
}

export async function createGuardianStudent(
  guardianId: string,
  studentId: string,
  institutionId: string
): Promise<GuardianStudentRow> {
  const r = await queryPg<GuardianStudentRow>(
    'INSERT INTO guardian_students (guardian_id, student_id, institution_id) VALUES ($1, $2, $3) ON CONFLICT (guardian_id, student_id) DO NOTHING RETURNING *',
    [guardianId, studentId, institutionId]
  );
  if (r.rows[0]) return r.rows[0];
  const existing = await findGuardianStudent(guardianId, studentId);
  if (existing) return existing;
  throw new Error('Failed to create guardian_student');
}

export async function deleteGuardianStudent(guardianId: string, studentId: string): Promise<boolean> {
  const r = await queryPg(
    'DELETE FROM guardian_students WHERE guardian_id = $1 AND student_id = $2 RETURNING 1',
    [guardianId, studentId]
  );
  return (r.rowCount ?? 0) > 0;
}
