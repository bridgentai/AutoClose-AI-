import { queryPg } from '../config/db-pg.js';

export interface StudentActivityInsert {
  institution_id: string;
  student_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  duration_seconds?: number | null;
}

export async function insertStudentActivity(row: StudentActivityInsert): Promise<void> {
  await queryPg(
    `INSERT INTO student_activity (institution_id, student_id, entity_type, entity_id, action, metadata, duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      row.institution_id,
      row.student_id,
      row.entity_type,
      row.entity_id,
      row.action,
      row.metadata != null ? JSON.stringify(row.metadata) : null,
      row.duration_seconds ?? null,
    ]
  );
}

export interface AssignmentActivityRow {
  student_id: string;
  full_name: string;
  first_opened: string | null;
  last_opened: string | null;
  total_time_seconds: number;
  times_opened: number;
  started_writing: boolean;
}

export async function getDownloadsByStudentForAssignment(
  institutionId: string,
  assignmentId: string
): Promise<Map<string, string[]>> {
  const r = await queryPg<{ student_id: string; files: string[] | null }>(
    `SELECT sa.student_id,
            COALESCE(
              ARRAY_AGG(DISTINCT (sa.metadata->>'file_name'))
                FILTER (WHERE sa.metadata->>'file_name' IS NOT NULL AND TRIM(sa.metadata->>'file_name') <> ''),
              ARRAY[]::text[]
            ) AS files
     FROM student_activity sa
     WHERE sa.institution_id = $1::uuid
       AND sa.entity_type = 'assignment'
       AND sa.entity_id = $2::uuid
       AND sa.action = 'download'
     GROUP BY sa.student_id`,
    [institutionId, assignmentId]
  );
  const map = new Map<string, string[]>();
  for (const row of r.rows) {
    map.set(row.student_id, row.files ?? []);
  }
  return map;
}

type AssignmentAggDbRow = {
  student_id: string;
  full_name: string;
  first_opened: string | null;
  last_opened: string | null;
  total_time_seconds: string;
  times_opened: string;
  started_writing: boolean | null;
};

export async function getAssignmentActivityAggregates(
  institutionId: string,
  assignmentId: string
): Promise<AssignmentActivityRow[]> {
  const r = await queryPg<AssignmentAggDbRow>(
    `SELECT
       s.id AS student_id,
       s.full_name,
       MIN(sa.created_at) FILTER (WHERE sa.action = 'view_open') AS first_opened,
       MAX(sa.created_at) FILTER (WHERE sa.action = 'view_open') AS last_opened,
       COALESCE(SUM(sa.duration_seconds) FILTER (WHERE sa.action = 'view_close'), 0)::text AS total_time_seconds,
       COUNT(*) FILTER (WHERE sa.action = 'view_open')::text AS times_opened,
       BOOL_OR(sa.action = 'start_writing') AS started_writing
     FROM (
       SELECT DISTINCT u.id, u.full_name
       FROM users u
       INNER JOIN enrollments e ON e.student_id = u.id
       INNER JOIN assignments a ON a.id = $2::uuid
       INNER JOIN group_subjects gs ON gs.id = a.group_subject_id AND e.group_id = gs.group_id
       WHERE u.institution_id = $1::uuid AND u.role = 'estudiante'
     ) s
     LEFT JOIN student_activity sa
       ON sa.student_id = s.id
       AND sa.institution_id = $1::uuid
       AND sa.entity_type = 'assignment'
       AND sa.entity_id = $2::uuid
     GROUP BY s.id, s.full_name`,
    [institutionId, assignmentId]
  );

  return r.rows.map((row: AssignmentAggDbRow) => ({
    student_id: row.student_id,
    full_name: row.full_name,
    first_opened: row.first_opened,
    last_opened: row.last_opened,
    total_time_seconds: parseInt(row.total_time_seconds, 10) || 0,
    times_opened: parseInt(row.times_opened, 10) || 0,
    started_writing: !!row.started_writing,
  }));
}

export interface StudentActivityFeedRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  duration_seconds: number | null;
  created_at: string;
  entity_title: string | null;
  materia_label: string | null;
}

export async function listStudentActivityFeed(
  institutionId: string,
  studentId: string,
  limit: number
): Promise<StudentActivityFeedRow[]> {
  const lim = Math.min(Math.max(limit, 1), 100);
  const r = await queryPg<StudentActivityFeedRow>(
    `SELECT
       sa.id,
       sa.entity_type,
       sa.entity_id::text,
       sa.action,
       sa.metadata,
       sa.duration_seconds,
       sa.created_at,
       CASE
         WHEN sa.entity_type = 'assignment' THEN a.title
         WHEN sa.entity_type = 'evo_message' THEN ann.title
         WHEN sa.entity_type = 'evo_file' THEN ef.nombre
         ELSE NULL
       END AS entity_title,
       CASE
         WHEN sa.entity_type = 'assignment' THEN COALESCE(gs.display_name, subj.name)
         WHEN sa.entity_type = 'evo_message' AND ann.group_subject_id IS NOT NULL THEN COALESCE(gs2.display_name, subj2.name)
         WHEN sa.entity_type = 'evo_message' THEN ann.title
         WHEN sa.entity_type = 'evo_file' THEN COALESCE(gs3.display_name, subj3.name)
         ELSE NULL
       END AS materia_label
     FROM student_activity sa
     LEFT JOIN assignments a ON sa.entity_type = 'assignment' AND a.id = sa.entity_id
     LEFT JOIN group_subjects gs ON gs.id = a.group_subject_id
     LEFT JOIN subjects subj ON subj.id = gs.subject_id
     LEFT JOIN announcements ann ON sa.entity_type = 'evo_message' AND ann.id = sa.entity_id
     LEFT JOIN group_subjects gs2 ON gs2.id = ann.group_subject_id
     LEFT JOIN subjects subj2 ON subj2.id = gs2.subject_id
     LEFT JOIN evo_files ef ON sa.entity_type = 'evo_file' AND ef.id = sa.entity_id
     LEFT JOIN group_subjects gs3 ON gs3.id = ef.group_subject_id
     LEFT JOIN subjects subj3 ON subj3.id = gs3.subject_id
     WHERE sa.institution_id = $1::uuid AND sa.student_id = $2::uuid
     ORDER BY sa.created_at DESC
     LIMIT $3`,
    [institutionId, studentId, lim]
  );
  return r.rows;
}

export interface ThreadReadRow {
  student_id: string;
  full_name: string;
  opened_at: string;
}

/** Estudiantes con al menos un message_open para el hilo (announcement id). */
export async function getStudentsWhoOpenedThread(
  institutionId: string,
  threadId: string
): Promise<ThreadReadRow[]> {
  const r = await queryPg<ThreadReadRow>(
    `SELECT DISTINCT ON (sa.student_id)
       sa.student_id,
       u.full_name,
       sa.created_at AS opened_at
     FROM student_activity sa
     INNER JOIN users u ON u.id = sa.student_id AND u.role = 'estudiante'
     WHERE sa.institution_id = $1::uuid
       AND sa.entity_type = 'evo_message'
       AND sa.entity_id = $2::uuid
       AND sa.action = 'message_open'
     ORDER BY sa.student_id, sa.created_at ASC`,
    [institutionId, threadId]
  );
  return r.rows;
}

export async function countStudentsInGroupForThread(
  institutionId: string,
  groupId: string
): Promise<number> {
  const r = await queryPg<{ c: string }>(
    `SELECT COUNT(DISTINCT e.student_id)::text AS c
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id AND u.role = 'estudiante'
     WHERE e.group_id = $1::uuid AND u.institution_id = $2::uuid`,
    [groupId, institutionId]
  );
  return parseInt(r.rows[0]?.c ?? '0', 10) || 0;
}
