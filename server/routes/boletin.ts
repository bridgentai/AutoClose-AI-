import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireStudentAccess } from '../middleware/studentAccessGuard.js';
import { queryPg } from '../config/db-pg.js';
import { resolveGroupId } from '../utils/resolveLegacyCourse.js';
import { getBoletinDataForStudent } from '../services/boletinService.js';
import {
  insertAcademicBoletinBatch,
  listAcademicBoletinBatches,
  getAcademicBoletinBatchById,
} from '../repositories/academicBoletinBatchRepository.js';
import { renderAcademicBoletinBatchPrintHtml } from '../services/boletinBatchPrintHtml.js';

const router = express.Router();

const REPORTES_ROLES = [
  'directivo',
  'admin-general-colegio',
  'asistente-academica',
  'school_admin',
] as const;

function canListReportesBoletines(rol: string | undefined): boolean {
  return REPORTES_ROLES.includes(rol as (typeof REPORTES_ROLES)[number]);
}

// ─── GET /api/boletin — Lista lotes de boletines guardados (directivo/admin) ─
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    if (!canListReportesBoletines(rol)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const institutionId =
      req.user?.institutionId ?? req.user?.colegioId ?? '';
    if (!institutionId) {
      return res.status(400).json({ message: 'Institución no disponible.' });
    }
    const rows = await listAcademicBoletinBatches(institutionId);
    return res.json(
      rows.map((r) => ({
        _id: r.id,
        periodo: r.periodo,
        grupoNombre: r.group_name,
        fecha: r.created_at,
        estudiantesCount: r.estudiantes_count,
      }))
    );
  } catch (e) {
    console.error('[boletin] GET /', e);
    return res.status(500).json({ message: 'Error al listar boletines.' });
  }
});

// ─── GET /api/boletin/inteligente/:estudianteId ─────────────────────────────
// Profesor (su materia) o directivo/admin (todas las materias)
router.get(
  '/inteligente/:estudianteId',
  protect,
  requireStudentAccess('estudianteId', 'own_teacher_only'),
  async (req: AuthRequest, res) => {
    try {
      const { estudianteId } = req.params;
      const institutionId =
        req.user?.institutionId ?? req.user?.colegioId ?? '';
      const rol = req.user?.rol;
      const userId = req.user?.id;

      const allowedRoles = [
        'profesor',
        'directivo',
        'admin-general-colegio',
        'asistente-academica',
        'school_admin',
      ];
      if (!allowedRoles.includes(rol ?? '')) {
        return res.status(403).json({ message: 'No autorizado.' });
      }

      // Obtener el grupo del estudiante
      const enrollRes = await queryPg<{ group_id: string }>(
        `SELECT e.group_id FROM enrollments e
       JOIN groups g ON e.group_id = g.id
       WHERE e.student_id = $1 AND g.institution_id = $2
       LIMIT 1`,
        [estudianteId, institutionId]
      );
      if (!enrollRes.rows[0]) {
        return res
          .status(404)
          .json({ message: 'Estudiante no encontrado en ningún grupo.' });
      }
      const groupId = enrollRes.rows[0].group_id;

      const data = await getBoletinDataForStudent(
        estudianteId,
        groupId,
        institutionId
      );
      if (!data)
        return res.status(404).json({ message: 'Estudiante no encontrado.' });
      // Profesor: filtrar solo su materia (usar display_name para coincidir con data.materias.materia)
      if (rol === 'profesor') {
        const teacherDisplayNamesRes = await queryPg<{ subject_name: string }>(
          `SELECT COALESCE(gs.display_name, s.name) AS subject_name
           FROM group_subjects gs
           JOIN subjects s ON s.id = gs.subject_id
           WHERE gs.group_id = $1 AND gs.teacher_id = $2 AND gs.institution_id = $3`,
          [groupId, userId, institutionId]
        );
        const teacherSubjectNames = teacherDisplayNamesRes.rows.map((r: { subject_name: string }) => r.subject_name);
        data.materias = data.materias.filter((m) =>
          teacherSubjectNames.includes(m.materia)
        );
      }

      return res.json(data);
    } catch (e) {
      console.error('[boletin] GET /inteligente/:estudianteId', e);
      return res.status(500).json({ message: 'Error al generar boletín.' });
    }
  }
);

// ─── POST /api/boletin/generar-por-curso ────────────────────────────────────
// Directivo/admin: genera boletines para todos los estudiantes de un grupo
router.post('/generar-por-curso', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const institutionId =
      req.user?.institutionId ?? req.user?.colegioId ?? '';

    if (!canListReportesBoletines(rol)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const { grupoNombre, periodo: periodoBody } = req.body as {
      grupoNombre?: string;
      periodo?: string;
    };
    if (!grupoNombre?.trim()) {
      return res.status(400).json({ message: 'grupoNombre es requerido.' });
    }

    const resolved = await resolveGroupId(grupoNombre.trim(), institutionId);
    if (!resolved) {
      return res.status(404).json({ message: 'Grupo no encontrado.' });
    }

    const periodoStored =
      periodoBody?.trim() ||
      `Sin período · ${new Date().toISOString().slice(0, 10)}`;

    // Obtener todos los estudiantes del grupo
    const studentsRes = await queryPg<{
      student_id: string;
      full_name: string;
    }>(
      `SELECT e.student_id, u.full_name
       FROM enrollments e
       JOIN users u ON e.student_id = u.id
       WHERE e.group_id = $1`,
      [resolved.id]
    );

    // Generar boletín para cada estudiante
    const boletines = [];
    for (const student of studentsRes.rows) {
      const data = await getBoletinDataForStudent(
        student.student_id,
        resolved.id,
        institutionId
      );
      if (data) boletines.push({ ...data, grupo: resolved.name });
    }

    let batchId: string | null = null;
    if (boletines.length > 0) {
      batchId = await insertAcademicBoletinBatch(
        institutionId,
        resolved.id,
        resolved.name,
        periodoStored,
        req.user?.id ?? null,
        boletines
      );
    }

    return res.json({
      grupo: resolved.name,
      totalEstudiantes: boletines.length,
      boletines,
      batchId,
    });
  } catch (e) {
    console.error('[boletin] POST /generar-por-curso', e);
    return res.status(500).json({ message: 'Error al generar boletines.' });
  }
});

// ─── GET /api/boletin/:id/pdf — HTML imprimible del lote guardado ────────────
router.get('/:id/pdf', protect, async (req: AuthRequest, res) => {
  try {
    if (!canListReportesBoletines(req.user?.rol)) {
      return res.status(403).json({ message: 'No autorizado.' });
    }
    const institutionId =
      req.user?.institutionId ?? req.user?.colegioId ?? '';
    if (!institutionId) {
      return res.status(400).json({ message: 'Institución no disponible.' });
    }
    const { id } = req.params;
    const batch = await getAcademicBoletinBatchById(id, institutionId);
    if (!batch) {
      return res.status(404).json({ message: 'Lote de boletines no encontrado.' });
    }
    const html = renderAcademicBoletinBatchPrintHtml({
      groupName: batch.group_name,
      periodo: batch.periodo,
      createdAt: new Date(batch.created_at).toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      boletines: batch.boletines_json,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error('[boletin] GET /:id/pdf', e);
    return res.status(500).json({ message: 'Error al generar vista del boletín.' });
  }
});

export default router;
