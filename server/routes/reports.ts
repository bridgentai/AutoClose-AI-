import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireStudentAccess } from '../middleware/studentAccessGuard.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGuardianStudent } from '../repositories/guardianStudentRepository.js';
import { queryPg } from '../config/db-pg.js';
import { getDirectivoGroupIds } from '../utils/sectionFilter.js';
import { computeSectionHierarchicalGpa } from '../utils/sectionDashboardStats.js';
import { fetchSectionCourseInsightCards } from '../utils/sectionCourseInsightCards.js';
import { findSectionById } from '../repositories/sectionRepository.js';
import { generateDirectivoSectionAnalyticsSummary } from '../services/openai.js';
import { fetchGroupHolisticAnalytics } from '../utils/groupHolisticAnalytics.js';
import { resolveGroupId } from '../utils/resolveLegacyCourse.js';

const router = express.Router();

/** Comparación estable de UUID (PostgreSQL los devuelve en minúsculas; el front puede enviar mayúsculas). */
function uuidStringsEqual(a: string, b: string): boolean {
  const na = a.replace(/-/g, '').toLowerCase();
  const nb = b.replace(/-/g, '').toLowerCase();
  return na.length > 0 && na === nb;
}

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

/** Vista analítica de notas del director de sección: KPI + tarjetas por curso (promedios jerárquicos 0–100). */
router.get('/section/notas-analitica', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId || !rol || !allowedAnalyticsRoles.includes(rol)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const groupIds = await getDirectivoGroupIds(req);
    if (groupIds !== null && groupIds.length === 0) {
      return res.json({
        sectionName: null,
        promedioSeccion: null,
        cursos: [],
        totales: { enRiesgo: 0, enAlerta: 0, alDia: 0, estudiantes: 0 },
      });
    }

    let ids: string[];
    if (groupIds === null) {
      const gr = await queryPg<{ id: string }>(
        'SELECT id FROM groups WHERE institution_id = $1',
        [colegioId]
      );
      ids = gr.rows.map((r) => r.id);
    } else {
      ids = groupIds;
    }

    const sectionRow =
      rol === 'directivo' && req.user?.sectionId
        ? await findSectionById(req.user.sectionId)
        : null;
    const sectionName = sectionRow?.name ?? null;

    const [promedioSeccion, cursos] = await Promise.all([
      ids.length > 0 ? computeSectionHierarchicalGpa(ids) : Promise.resolve(null),
      ids.length > 0 ? fetchSectionCourseInsightCards(ids) : Promise.resolve([]),
    ]);

    const totales = cursos.reduce(
      (acc, c) => ({
        enRiesgo: acc.enRiesgo + c.enRiesgo,
        enAlerta: acc.enAlerta + c.enAlerta,
        alDia: acc.alDia + c.alDia,
        estudiantes: acc.estudiantes + c.estudiantes,
      }),
      { enRiesgo: 0, enAlerta: 0, alDia: 0, estudiantes: 0 }
    );

    return res.json({
      sectionName,
      promedioSeccion,
      cursos: cursos.map((c) => ({
        grupoId: c.groupId,
        grupo: c.groupName,
        promedioGeneral: c.promedioGeneral,
        estudiantes: c.estudiantes,
        enRiesgo: c.enRiesgo,
        enAlerta: c.enAlerta,
        alDia: c.alDia,
      })),
      totales,
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener analítica de notas de sección.' });
  }
});

router.get('/section/notas-analitica/insights', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId || !rol || !allowedAnalyticsRoles.includes(rol)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const groupIds = await getDirectivoGroupIds(req);
    if (groupIds !== null && groupIds.length === 0) {
      return res.json({ summary: 'No hay cursos en tu sección para analizar.' });
    }

    let ids: string[];
    if (groupIds === null) {
      const gr = await queryPg<{ id: string }>(
        'SELECT id FROM groups WHERE institution_id = $1',
        [colegioId]
      );
      ids = gr.rows.map((r) => r.id);
    } else {
      ids = groupIds;
    }

    const sectionRow =
      rol === 'directivo' && req.user?.sectionId
        ? await findSectionById(req.user.sectionId)
        : null;
    const sectionName = sectionRow?.name ?? 'Institución';

    const [promedioSeccion, cursos] = await Promise.all([
      ids.length > 0 ? computeSectionHierarchicalGpa(ids) : Promise.resolve(null),
      ids.length > 0 ? fetchSectionCourseInsightCards(ids) : Promise.resolve([]),
    ]);

    const summary = await generateDirectivoSectionAnalyticsSummary({
      sectionName,
      promedioSeccion,
      cursos: cursos.map((c) => ({
        nombre: c.groupName,
        promedio: c.promedioGeneral,
        estudiantes: c.estudiantes,
        enRiesgo: c.enRiesgo,
        enAlerta: c.enAlerta,
        alDia: c.alDia,
      })),
    });

    return res.json({ summary });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al generar insights de sección.' });
  }
});

/** Resumen holístico de un curso (misma jerarquía que KPI de sección): un round-trip para la vista analítica del directivo. */
router.get('/group/:groupId/holistic-resumen', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId || !rol || !allowedAnalyticsRoles.includes(rol)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const raw = decodeURIComponent(req.params.groupId ?? '');
    const resolved = await resolveGroupId(raw, colegioId);
    if (!resolved) return res.status(404).json({ message: 'Grupo no encontrado.' });

    const groupIds = await getDirectivoGroupIds(req);
    if (groupIds !== null) {
      const allowed = groupIds.some((gid) => uuidStringsEqual(gid, resolved.id));
      if (!allowed) return res.status(403).json({ message: 'No autorizado.' });
    }

    const data = await fetchGroupHolisticAnalytics(colegioId, resolved.id);
    if (!data) return res.status(404).json({ message: 'Grupo no encontrado.' });
    return res.json(data);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen holístico del curso.' });
  }
});

export default router;
