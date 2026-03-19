import { queryPg } from '../config/db-pg.js';

export interface GradeRow {
  id: string;
  assignment_id: string;
  user_id: string;
  group_id: string;
  grading_category_id: string;
  score: number;
  max_score: number;
  normalized_score: number | null;
  recorded_at: string;
  recorded_by_id: string;
}

export async function findGradeByAssignmentAndUser(assignmentId: string, userId: string): Promise<GradeRow | null> {
  const r = await queryPg<GradeRow>(
    'SELECT * FROM grades WHERE assignment_id = $1 AND user_id = $2',
    [assignmentId, userId]
  );
  return r.rows[0] ?? null;
}

export async function findGradesByAssignment(assignmentId: string): Promise<GradeRow[]> {
  const r = await queryPg<GradeRow>(
    'SELECT * FROM grades WHERE assignment_id = $1',
    [assignmentId]
  );
  return r.rows;
}

export async function findGradesByUserAndGroup(userId: string, groupId: string): Promise<GradeRow[]> {
  const r = await queryPg<GradeRow>(
    'SELECT * FROM grades WHERE user_id = $1 AND group_id = $2 ORDER BY recorded_at DESC',
    [userId, groupId]
  );
  return r.rows;
}

export async function findGradesByGroup(groupId: string): Promise<GradeRow[]> {
  const r = await queryPg<GradeRow>(
    'SELECT * FROM grades WHERE group_id = $1',
    [groupId]
  );
  return r.rows;
}

export async function upsertGrade(row: {
  assignment_id: string;
  user_id: string;
  group_id: string;
  grading_category_id: string;
  score: number;
  max_score: number;
  normalized_score?: number | null;
  recorded_by_id: string;
}): Promise<GradeRow> {
  const r = await queryPg<GradeRow>(
    `INSERT INTO grades (assignment_id, user_id, group_id, grading_category_id, score, max_score, normalized_score, recorded_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (assignment_id, user_id) DO UPDATE SET
       grading_category_id = EXCLUDED.grading_category_id,
       score = EXCLUDED.score,
       max_score = EXCLUDED.max_score,
       normalized_score = EXCLUDED.normalized_score,
       recorded_at = now()
     RETURNING *`,
    [
      row.assignment_id,
      row.user_id,
      row.group_id,
      row.grading_category_id,
      row.score,
      row.max_score,
      row.normalized_score ?? null,
      row.recorded_by_id,
    ]
  );
  return r.rows[0];
}

export async function deleteGradeByAssignmentAndUser(assignmentId: string, userId: string): Promise<boolean> {
  const r = await queryPg('DELETE FROM grades WHERE assignment_id = $1 AND user_id = $2', [
    assignmentId,
    userId,
  ]);
  return (r.rowCount ?? 0) > 0;
}
