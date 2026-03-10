import { queryPg } from '../config/db-pg.js';

export interface GradeEventRow {
  id: string;
  assignment_id: string;
  user_id: string;
  group_id: string;
  grading_category_id: string;
  institution_id: string;
  score: number;
  max_score: number;
  normalized_score: number | null;
  recorded_at: string;
  recorded_by_id: string;
}

export async function findGradeEventById(id: string): Promise<GradeEventRow | null> {
  const r = await queryPg<GradeEventRow>(
    'SELECT * FROM grade_events WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findGradeEventsByStudent(studentId: string): Promise<GradeEventRow[]> {
  const r = await queryPg<GradeEventRow>(
    'SELECT * FROM grade_events WHERE user_id = $1 ORDER BY recorded_at DESC',
    [studentId]
  );
  return r.rows;
}

export async function findGradeEventsByAssignment(assignmentId: string): Promise<GradeEventRow[]> {
  const r = await queryPg<GradeEventRow>(
    'SELECT * FROM grade_events WHERE assignment_id = $1',
    [assignmentId]
  );
  return r.rows;
}
