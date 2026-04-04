import { queryPg } from '../config/db-pg.js';

export interface SectionCourseInsightRow {
  groupId: string;
  groupName: string;
  estudiantes: number;
  promedioGeneral: number | null;
  enRiesgo: number;
  enAlerta: number;
  alDia: number;
}

/**
 * Por cada curso (grupo): promedio jerárquico 0–100 (misma lógica que el KPI de sección)
 * y conteos de estudiantes según el promedio holístico del curso (media de sus medias por materia).
 */
export async function fetchSectionCourseInsightCards(
  groupIds: string[]
): Promise<SectionCourseInsightRow[]> {
  if (groupIds.length === 0) return [];

  const r = await queryPg<{
    group_id: string;
    group_name: string;
    estudiantes: number;
    promedio_general: string | null;
    en_riesgo: number;
    en_alerta: number;
    al_dia: number;
  }>(
    `WITH per_grade AS (
       SELECT
         gr.user_id AS student_id,
         gs.group_id,
         a.group_subject_id,
         CASE
           WHEN gr.max_score > 0 THEN
             COALESCE(
               gr.normalized_score,
               (gr.score::numeric / NULLIF(gr.max_score, 0)) * 5
             )
           ELSE NULL
         END AS val
       FROM grades gr
       JOIN assignments a ON a.id = gr.assignment_id
       JOIN group_subjects gs ON gs.id = a.group_subject_id AND gs.group_id = gr.group_id
       WHERE gs.group_id = ANY($1::uuid[])
     ),
     stu_subj AS (
       SELECT student_id, group_id, group_subject_id, AVG(val) AS avg_subj
       FROM per_grade
       WHERE val IS NOT NULL
       GROUP BY student_id, group_id, group_subject_id
     ),
     subj_mean AS (
       SELECT s.group_id, s.group_subject_id, AVG(s.avg_subj) AS subject_avg
       FROM stu_subj s
       INNER JOIN enrollments e ON e.student_id = s.student_id AND e.group_id = s.group_id
       GROUP BY s.group_id, s.group_subject_id
     ),
     course_mean AS (
       SELECT group_id, AVG(subject_avg) AS course_avg_0_5
       FROM subj_mean
       GROUP BY group_id
     ),
     stu_course_avg AS (
       SELECT s.student_id, s.group_id, AVG(s.avg_subj) AS student_avg_0_5
       FROM stu_subj s
       INNER JOIN enrollments e ON e.student_id = s.student_id AND e.group_id = s.group_id
       GROUP BY s.student_id, s.group_id
     ),
     risk_counts AS (
       SELECT
         group_id,
         COUNT(*) FILTER (WHERE student_avg_0_5 * 20 < 65)::int AS en_riesgo,
         COUNT(*) FILTER (WHERE student_avg_0_5 * 20 >= 65 AND student_avg_0_5 * 20 < 75)::int AS en_alerta,
         COUNT(*) FILTER (WHERE student_avg_0_5 * 20 >= 75)::int AS al_dia
       FROM stu_course_avg
       GROUP BY group_id
     ),
     enrolled AS (
       SELECT g.id AS group_id, g.name AS group_name, COUNT(DISTINCT e.student_id)::int AS estudiantes
       FROM groups g
       LEFT JOIN enrollments e ON e.group_id = g.id
       WHERE g.id = ANY($1::uuid[])
       GROUP BY g.id, g.name
     )
     SELECT
       e.group_id,
       e.group_name,
       e.estudiantes,
       ROUND((cm.course_avg_0_5 * 20)::numeric, 1) AS promedio_general,
       COALESCE(rc.en_riesgo, 0) AS en_riesgo,
       COALESCE(rc.en_alerta, 0) AS en_alerta,
       COALESCE(rc.al_dia, 0) AS al_dia
     FROM enrolled e
     LEFT JOIN course_mean cm ON cm.group_id = e.group_id
     LEFT JOIN risk_counts rc ON rc.group_id = e.group_id
     ORDER BY e.group_name`,
    [groupIds]
  );

  return r.rows.map((row) => ({
    groupId: row.group_id,
    groupName: row.group_name,
    estudiantes: row.estudiantes,
    promedioGeneral:
      row.promedio_general != null && row.promedio_general !== ''
        ? Number(row.promedio_general)
        : null,
    enRiesgo: row.en_riesgo,
    enAlerta: row.en_alerta,
    alDia: row.al_dia,
  }));
}
