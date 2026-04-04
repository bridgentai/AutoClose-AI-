import { queryPg } from '../config/db-pg.js';

/**
 * Promedio de sección en escala 0–100 (misma referencia visual que el resto de evoOS).
 * Cálculo interno en 0–5; resultado = media × 20. Jerarquía: por materia → media de
 * promedios por estudiante; por curso → media de materias; por sección → media de cursos.
 */
export async function computeSectionHierarchicalGpa(groupIds: string[]): Promise<number | null> {
  if (groupIds.length === 0) return null;

  const r = await queryPg<{ section_gpa: string | null }>(
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
       SELECT group_id, AVG(subject_avg) AS course_avg
       FROM subj_mean
       GROUP BY group_id
     )
     SELECT (AVG(course_avg))::numeric(5,2) AS section_gpa
     FROM course_mean`,
    [groupIds]
  );

  const v = r.rows[0]?.section_gpa;
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // Misma escala visual que el resto de la plataforma (0–100); el cálculo interno usa 0–5.
  const out = Math.round(n * 20 * 10) / 10;
  return Number.isFinite(out) ? out : null;
}

export async function countSectionDisciplinaryActions(
  institutionId: string,
  groupIds: string[]
): Promise<number> {
  if (groupIds.length === 0) return 0;

  const r = await queryPg<{ c: number }>(
    `SELECT COUNT(da.id)::int AS c
     FROM disciplinary_actions da
     WHERE da.institution_id = $1
       AND EXISTS (
         SELECT 1 FROM enrollments e
         WHERE e.student_id = da.student_id
           AND e.group_id = ANY($2::uuid[])
       )`,
    [institutionId, groupIds]
  );
  return r.rows[0]?.c ?? 0;
}
