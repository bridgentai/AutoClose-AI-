import { queryPg } from '../config/db-pg.js';

export interface GroupHolisticStudentRow {
  studentId: string;
  nombre: string;
  promedioHolistico: number | null;
  materiasConNotas: number;
  materiasTotal: number;
  materiaMasDebil: string | null;
  porMateria: Array<{ nombre: string; promedio: number }>;
}

export interface GroupHolisticAnalyticsResult {
  grupoId: string;
  promedioCurso: number | null;
  materiasTotal: number;
  estudiantes: GroupHolisticStudentRow[];
}

/**
 * Misma jerarquía que `fetchSectionCourseInsightCards` / KPI de sección:
 * notas → promedio por materia por estudiante → promedio del estudiante → promedio del curso.
 */
export async function fetchGroupHolisticAnalytics(
  institutionId: string,
  groupId: string
): Promise<GroupHolisticAnalyticsResult | null> {
  const g = await queryPg<{ id: string }>(
    'SELECT id FROM groups WHERE id = $1 AND institution_id = $2',
    [groupId, institutionId]
  );
  if (!g.rows[0]) return null;

  const materiasCount = await queryPg<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM group_subjects WHERE group_id = $1',
    [groupId]
  );
  const materiasTotal = materiasCount.rows[0]?.n ?? 0;

  type HolisticSqlRow = {
    student_id: string;
    full_name: string;
    promedio_holistico: string | null;
    materias_con_notas: number;
    materia_mas_debil: string | null;
    por_materia: unknown;
    promedio_curso: string | null;
  };

  const rows = await queryPg<HolisticSqlRow>(
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
       WHERE gs.group_id = $1::uuid
     ),
     stu_subj AS (
       SELECT student_id, group_id, group_subject_id, AVG(val) AS avg_subj
       FROM per_grade
       WHERE val IS NOT NULL
       GROUP BY student_id, group_id, group_subject_id
     ),
     stu_named AS (
       SELECT
         s.student_id,
         s.group_id,
         s.avg_subj,
         COALESCE(gs.display_name, sub.name, 'Materia') AS materia_nombre
       FROM stu_subj s
       JOIN group_subjects gs ON gs.id = s.group_subject_id AND gs.group_id = s.group_id
       JOIN subjects sub ON sub.id = gs.subject_id
     ),
     subj_mean AS (
       SELECT s.group_id, s.group_subject_id, AVG(s.avg_subj) AS subject_avg
       FROM stu_subj s
       INNER JOIN enrollments e ON e.student_id = s.student_id AND e.group_id = s.group_id
       GROUP BY s.group_id, s.group_subject_id
     ),
     course_mean AS (
       SELECT AVG(subject_avg) AS course_avg_0_5
       FROM subj_mean
       WHERE group_id = $1::uuid
     ),
     stu_course_avg AS (
       SELECT s.student_id, s.group_id, AVG(s.avg_subj) AS student_avg_0_5
       FROM stu_subj s
       INNER JOIN enrollments e ON e.student_id = s.student_id AND e.group_id = s.group_id
       WHERE s.group_id = $1::uuid
       GROUP BY s.student_id, s.group_id
     ),
     por_materia_json AS (
       SELECT
         sn.student_id,
         jsonb_agg(
           jsonb_build_object(
             'nombre', sn.materia_nombre,
             'promedio', ROUND((sn.avg_subj * 20)::numeric, 1)
           )
           ORDER BY sn.materia_nombre
         ) AS arr
       FROM stu_named sn
       GROUP BY sn.student_id
     ),
     weakest AS (
       SELECT DISTINCT ON (sn.student_id)
         sn.student_id,
         sn.materia_nombre AS materia_mas_debil
       FROM stu_named sn
       ORDER BY sn.student_id, sn.avg_subj ASC, sn.materia_nombre ASC
     )
     SELECT
       e.student_id,
       u.full_name,
       ROUND((sc.student_avg_0_5 * 20)::numeric, 1) AS promedio_holistico,
       COALESCE(subj_counts.n, 0)::int AS materias_con_notas,
       w.materia_mas_debil,
       COALESCE(pm.arr, '[]'::jsonb) AS por_materia,
       ROUND((cm.course_avg_0_5 * 20)::numeric, 1) AS promedio_curso
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id AND u.institution_id = $2 AND u.role = 'estudiante'
     LEFT JOIN stu_course_avg sc ON sc.student_id = e.student_id AND sc.group_id = e.group_id
     LEFT JOIN weakest w ON w.student_id = e.student_id
     LEFT JOIN por_materia_json pm ON pm.student_id = e.student_id
     LEFT JOIN LATERAL (
       SELECT COUNT(DISTINCT s2.group_subject_id)::int AS n
       FROM stu_subj s2
       WHERE s2.student_id = e.student_id AND s2.group_id = $1::uuid
     ) subj_counts ON true
     CROSS JOIN course_mean cm
     WHERE e.group_id = $1::uuid
     ORDER BY u.full_name ASC`,
    [groupId, institutionId]
  );

  const first = rows.rows[0];
  const promedioCurso =
    first?.promedio_curso != null && first.promedio_curso !== ''
      ? Number(first.promedio_curso)
      : null;

  const estudiantes: GroupHolisticStudentRow[] = rows.rows.map((r: HolisticSqlRow) => {
    let porMateria: Array<{ nombre: string; promedio: number }> = [];
    const raw = r.por_materia;
    if (Array.isArray(raw)) {
      porMateria = raw.map((item: unknown) => {
        const o = item as { nombre?: string; promedio?: unknown };
        const p = Number(o.promedio);
        return {
          nombre: String(o.nombre ?? ''),
          promedio: Number.isFinite(p) ? p : 0,
        };
      });
    }
    return {
      studentId: r.student_id,
      nombre: r.full_name,
      promedioHolistico:
        r.promedio_holistico != null && r.promedio_holistico !== ''
          ? Number(r.promedio_holistico)
          : null,
      materiasConNotas: r.materias_con_notas,
      materiasTotal,
      materiaMasDebil: r.materia_mas_debil,
      porMateria,
    };
  });

  return {
    grupoId: groupId,
    promedioCurso,
    materiasTotal,
    estudiantes,
  };
}
