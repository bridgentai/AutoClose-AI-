import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireStudentAccess } from '../middleware/studentAccessGuard.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGuardianStudent } from '../repositories/guardianStudentRepository.js';
import { queryPg } from '../config/db-pg.js';
import { getDirectivoGroupIds } from '../utils/sectionFilter.js';

const router = express.Router();

export interface CursoResumenItem {
  _id: string;
  nombre: string;
  promedio: number | null;
  cantidadNotas: number;
}

router.get(
  '/estudiante/:id/resumen',
  protect,
  requireStudentAccess('id', 'own_teacher_only'),
  async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.params.id;
    const userId = req.user?.id ?? req.userId;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const estudiante = await findUserById(estudianteId);
    if (!estudiante || estudiante.institution_id !== colegioId) return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (estudiante.role !== 'estudiante') return res.status(400).json({ message: 'El usuario no es un estudiante.' });

    const canView =
      rol === 'directivo' ||
      rol === 'admin-general-colegio' ||
      rol === 'asistente-academica' ||
      rol === 'school_admin' ||
      rol === 'administrador-general' ||
      rol === 'super_admin' ||
      rol === 'profesor' ||
      userId === estudianteId ||
      (rol === 'padre' && (await findGuardianStudent(userId ?? '', estudianteId)));

    if (!canView) return res.status(403).json({ message: 'No autorizado a ver este resumen.' });

    const now = new Date();
    return res.json({
      estudiante: { _id: estudiante.id, nombre: estudiante.full_name, email: estudiante.email, curso: (estudiante.config as { curso?: string })?.curso },
      asistencia: { porcentaje: 0, total: 0, presentes: 0, mes: now.getMonth() + 1, anio: now.getFullYear() },
      notas: { cantidad: 0, promedioGeneral: null, detalle: [] },
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen del estudiante.' });
  }
});

router.get('/cursos/resumen', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (rol !== 'directivo' && rol !== 'admin-general-colegio' && rol !== 'asistente-academica' && rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo directivos y administradores pueden ver el resumen de cursos.' });
    }
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const groupIds = await getDirectivoGroupIds(req);
    if (groupIds !== null && groupIds.length === 0) return res.json([]);

    let whereClause: string;
    let params: unknown[];

    if (groupIds === null) {
      whereClause = `WHERE g.institution_id = $1 AND g.name ~ '^[0-9]'`;
      params = [colegioId];
    } else {
      const placeholders = groupIds.map((_, i) => `$${i + 2}`).join(', ');
      whereClause = `WHERE g.institution_id = $1 AND g.id IN (${placeholders}) AND g.name ~ '^[0-9]'`;
      params = [colegioId, ...groupIds];
    }

    const r = await queryPg<{ id: string; nombre: string; promedio: number | null; cantidad_notas: string }>(
      `SELECT g.id, g.name AS nombre,
        AVG(CASE WHEN gr.max_score > 0 THEN COALESCE(gr.normalized_score, gr.score::numeric / NULLIF(gr.max_score, 0)) * 5 ELSE NULL END)::numeric(4,2) AS promedio,
        COUNT(gr.id)::text AS cantidad_notas
       FROM groups g
       LEFT JOIN grades gr ON gr.group_id = g.id
       ${whereClause}
       GROUP BY g.id, g.name
       ORDER BY g.name`,
      params
    );
    const cursos: CursoResumenItem[] = r.rows.map((row) => ({
      _id: row.id,
      nombre: row.nombre,
      promedio: row.promedio != null ? Number(row.promedio) : null,
      cantidadNotas: parseInt(row.cantidad_notas, 10) || 0,
    }));
    return res.json(cursos);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen de cursos.' });
  }
});

// ---- Section Analytics Endpoints ----

const allowedAnalyticsRoles = ['directivo', 'admin-general-colegio', 'school_admin', 'super_admin'];

router.get('/section/overview', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId || !rol || !allowedAnalyticsRoles.includes(rol)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const groupIds = await getDirectivoGroupIds(req);
    if (groupIds !== null && groupIds.length === 0) {
      return res.json({ grupos: 0, estudiantes: 0, profesores: 0, asistenciaPromedio: null });
    }

    const groupFilter = groupIds ? `AND g.id = ANY($2::uuid[])` : '';
    const params: unknown[] = groupIds ? [colegioId, groupIds] : [colegioId];

    const result = await queryPg<{ total_grupos: number; total_estudiantes: number; total_profesores: number }>(
      `SELECT
         COUNT(DISTINCT g.id)::int AS total_grupos,
         COUNT(DISTINCT e.student_id)::int AS total_estudiantes,
         COUNT(DISTINCT gs.teacher_id)::int AS total_profesores
       FROM groups g
       LEFT JOIN enrollments e ON e.group_id = g.id
       LEFT JOIN group_subjects gs ON gs.group_id = g.id
       WHERE g.institution_id = $1 ${groupFilter}`,
      params
    );

    const attFilter = groupIds
      ? `AND gs.group_id = ANY($2::uuid[])`
      : '';
    const attParams: unknown[] = groupIds ? [colegioId, groupIds] : [colegioId];
    const att = await queryPg<{ total: number; presentes: number }>(
      `SELECT COUNT(*)::int AS total,
              SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::int AS presentes
       FROM attendance a
       JOIN group_subjects gs ON gs.id = a.group_subject_id
       WHERE a.institution_id = $1
         AND a.date >= date_trunc('month', CURRENT_DATE)
         ${attFilter}`,
      attParams
    );

    const row = result.rows[0];
    const attRow = att.rows[0];
    return res.json({
      grupos: row?.total_grupos ?? 0,
      estudiantes: row?.total_estudiantes ?? 0,
      profesores: row?.total_profesores ?? 0,
      asistenciaPromedio: attRow?.total > 0
        ? Math.round((attRow.presentes / attRow.total) * 100)
        : null,
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener overview de sección.' });
  }
});

router.get('/section/grades-by-group', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId || !rol || !allowedAnalyticsRoles.includes(rol)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const groupIds = await getDirectivoGroupIds(req);
    if (groupIds !== null && groupIds.length === 0) return res.json([]);

    const filter = groupIds ? `AND g.id = ANY($2::uuid[])` : '';
    const params: unknown[] = groupIds ? [colegioId, groupIds] : [colegioId];

    const rows = await queryPg<{ group_id: string; group_name: string; promedio: number | null; total_notas: number; estudiantes: number }>(
      `SELECT
         g.id AS group_id,
         g.name AS group_name,
         ROUND(AVG(CASE WHEN gr.max_score > 0 THEN COALESCE(gr.normalized_score, gr.score::numeric / NULLIF(gr.max_score, 0)) * 5 ELSE NULL END)::numeric, 2) AS promedio,
         COUNT(gr.id)::int AS total_notas,
         COUNT(DISTINCT e.student_id)::int AS estudiantes
       FROM groups g
       LEFT JOIN enrollments e ON e.group_id = g.id
       LEFT JOIN grades gr ON gr.user_id = e.student_id AND gr.group_id = g.id
       WHERE g.institution_id = $1 AND g.name ~ '^[0-9]' ${filter}
       GROUP BY g.id, g.name
       ORDER BY g.name`,
      params
    );

    return res.json(rows.rows.map(r => ({
      grupoId: r.group_id,
      grupo: r.group_name,
      promedio: r.promedio ? Number(r.promedio) : null,
      totalNotas: r.total_notas,
      estudiantes: r.estudiantes,
    })));
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener notas por grupo.' });
  }
});

router.get('/section/at-risk', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId || !rol || !allowedAnalyticsRoles.includes(rol)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const groupIds = await getDirectivoGroupIds(req);
    if (groupIds !== null && groupIds.length === 0) return res.json([]);

    const filter = groupIds ? `AND e.group_id = ANY($2::uuid[])` : '';
    const params: unknown[] = groupIds ? [colegioId, groupIds] : [colegioId];

    const rows = await queryPg<{
      student_id: string; full_name: string; group_name: string;
      promedio: number | null; pct_asistencia: number | null;
    }>(
      `SELECT
         u.id AS student_id,
         u.full_name,
         g.name AS group_name,
         ROUND(AVG(CASE WHEN gr.max_score > 0 THEN COALESCE(gr.normalized_score, gr.score::numeric / NULLIF(gr.max_score, 0)) * 5 ELSE NULL END)::numeric, 2) AS promedio,
         CASE
           WHEN COUNT(att.id) > 0
           THEN ROUND((SUM(CASE WHEN att.status = 'present' THEN 1 ELSE 0 END)::numeric / COUNT(att.id)) * 100, 1)
           ELSE NULL
         END AS pct_asistencia
       FROM users u
       JOIN enrollments e ON e.student_id = u.id
       JOIN groups g ON g.id = e.group_id AND g.name ~ '^[0-9]'
       LEFT JOIN grades gr ON gr.user_id = u.id AND gr.group_id = e.group_id
       LEFT JOIN group_subjects gsub ON gsub.group_id = e.group_id
       LEFT JOIN attendance att ON att.user_id = u.id AND att.group_subject_id = gsub.id
       WHERE u.institution_id = $1 AND u.role = 'estudiante' ${filter}
       GROUP BY u.id, u.full_name, g.id, g.name
       HAVING AVG(CASE WHEN gr.max_score > 0 THEN COALESCE(gr.normalized_score, gr.score::numeric / NULLIF(gr.max_score, 0)) * 5 ELSE NULL END) < 3.0
          OR (COUNT(att.id) > 0 AND (SUM(CASE WHEN att.status = 'present' THEN 1 ELSE 0 END)::numeric / COUNT(att.id)) < 0.70)
       ORDER BY promedio ASC NULLS LAST
       LIMIT 20`,
      params
    );

    return res.json(rows.rows.map(r => {
      const prom = r.promedio ? Number(r.promedio) : null;
      const pct = r.pct_asistencia ? Number(r.pct_asistencia) : null;
      const isLowGrade = prom !== null && prom < 3.0;
      const isLowAtt = pct !== null && pct < 70;
      return {
        estudianteId: r.student_id,
        nombre: r.full_name,
        grupo: r.group_name,
        promedio: prom,
        pctAsistencia: pct,
        riesgo: isLowGrade && isLowAtt ? 'alto' : (isLowGrade || isLowAtt) ? 'medio' : 'bajo',
      };
    }));
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener estudiantes en riesgo.' });
  }
});

export default router;
