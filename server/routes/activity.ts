import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { findUserById } from '../repositories/userRepository.js';
import { findAssignmentById } from '../repositories/assignmentRepository.js';
import { findGroupSubjectById, findGroupSubjectsByGroupWithDetails } from '../repositories/groupSubjectRepository.js';
import { findAnnouncementById } from '../repositories/announcementRepository.js';
import {
  insertStudentActivity,
  getAssignmentActivityAggregates,
  getDownloadsByStudentForAssignment,
  listStudentActivityFeed,
  getStudentsWhoOpenedThread,
  countStudentsInGroupForThread,
} from '../repositories/studentActivityRepository.js';
import { ensureStudentActivityTable } from '../db/pgSchemaPatches.js';

const router = express.Router();

const TRACK_ACTIONS = new Set(['view_open', 'view_close', 'download', 'start_writing', 'message_open']);

function getUserId(req: AuthRequest): string {
  return (req.user?.id ?? req.userId ?? '') as string;
}

function institutionId(req: AuthRequest): string {
  return (req.user?.colegioId ?? req.user?.institution_id ?? '') as string;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

router.post('/track', protect, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const instId = institutionId(req);
    const user = await findUserById(userId);
    if (!user || user.role !== 'estudiante') {
      return res.status(403).json({ message: 'Solo estudiantes pueden registrar actividad.' });
    }
    if (!instId || user.institution_id !== instId) {
      return res.status(403).json({ message: 'Institución no válida.' });
    }

    await ensureStudentActivityTable();

    const body = req.body as {
      entity_type?: string;
      entity_id?: string;
      action?: string;
      duration_seconds?: number;
      metadata?: Record<string, unknown>;
    };
    const entityType = typeof body.entity_type === 'string' ? body.entity_type.trim() : '';
    const entityId = typeof body.entity_id === 'string' ? body.entity_id.trim() : '';
    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (!entityType || !entityId || !action || !isUuid(entityId)) {
      return res.status(400).json({ message: 'entity_type, entity_id (uuid) y action son obligatorios.' });
    }
    if (!TRACK_ACTIONS.has(action)) {
      return res.status(400).json({ message: 'Acción no válida.' });
    }

    if (entityType === 'assignment') {
      if (!['view_open', 'view_close', 'download', 'start_writing'].includes(action)) {
        return res.status(400).json({ message: 'Acción no válida para tareas.' });
      }
    } else if (entityType === 'evo_message') {
      if (action !== 'message_open') {
        return res.status(400).json({ message: 'Acción no válida para mensajes.' });
      }
    } else {
      return res.status(400).json({ message: 'entity_type no válido.' });
    }

    const duration =
      typeof body.duration_seconds === 'number' && Number.isFinite(body.duration_seconds)
        ? Math.max(0, Math.floor(body.duration_seconds))
        : null;

    await insertStudentActivity({
      institution_id: instId,
      student_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : null,
      duration_seconds: duration,
    });

    return res.status(204).send();
  } catch (e: unknown) {
    console.error('[activity/track]', e);
    return res.status(500).json({ message: 'Error al registrar actividad.' });
  }
});

async function assertAssignmentActivityAccess(
  req: AuthRequest,
  assignmentId: string
): Promise<{ ok: true; institutionId: string } | { ok: false; status: number; message: string }> {
  const userId = getUserId(req);
  const instId = institutionId(req);
  const user = await findUserById(userId);
  if (!user || !instId) return { ok: false, status: 401, message: 'No autorizado.' };

  const assignment = await findAssignmentById(assignmentId);
  if (!assignment) return { ok: false, status: 404, message: 'Tarea no encontrada.' };

  const gs = await findGroupSubjectById(assignment.group_subject_id);
  if (!gs || gs.institution_id !== instId) {
    return { ok: false, status: 403, message: 'Sin acceso a esta tarea.' };
  }

  const r = user.role;
  if (r === 'directivo' || r === 'admin-general-colegio' || r === 'school_admin') {
    return { ok: true, institutionId: instId };
  }
  /** Alinear con GET /api/assignments/:id (creador) y con la titularidad de la materia. */
  if (
    r === 'profesor' &&
    (gs.teacher_id === userId || assignment.created_by === userId)
  ) {
    return { ok: true, institutionId: instId };
  }
  return { ok: false, status: 403, message: 'Sin permiso para ver actividad de esta tarea.' };
}

router.get(
  '/assignment/:assignmentId',
  protect,
  requireRole('profesor', 'directivo', 'admin-general-colegio', 'school_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { assignmentId } = req.params;
      if (!assignmentId || !isUuid(assignmentId)) {
        return res.status(400).json({ message: 'assignmentId inválido.' });
      }

      const access = await assertAssignmentActivityAccess(req, assignmentId);
      if (!access.ok) return res.status(access.status).json({ message: access.message });

      await ensureStudentActivityTable();

      const rows = await getAssignmentActivityAggregates(access.institutionId, assignmentId);
      const downloads = await getDownloadsByStudentForAssignment(access.institutionId, assignmentId);

      const enriched = rows.map((row) => {
        const files = downloads.get(row.student_id) ?? [];
        const never = row.times_opened === 0 && !row.first_opened;
        return {
          student_id: row.student_id,
          full_name: row.full_name,
          first_opened: row.first_opened,
          last_opened: row.last_opened,
          total_time_seconds: row.total_time_seconds,
          times_opened: row.times_opened,
          started_writing: row.started_writing,
          downloaded_files: files,
          never_opened: never,
        };
      });

      enriched.sort((a, b) => {
        if (a.never_opened !== b.never_opened) return a.never_opened ? -1 : 1;
        const ta = a.first_opened ? new Date(a.first_opened).getTime() : 0;
        const tb = b.first_opened ? new Date(b.first_opened).getTime() : 0;
        return tb - ta;
      });

      return res.json({ students: enriched });
    } catch (e: unknown) {
      console.error('[activity/assignment]', e);
      return res.status(500).json({ message: 'Error al obtener actividad.' });
    }
  }
);

router.get(
  '/student/:studentId',
  protect,
  requireRole('directivo', 'admin-general-colegio', 'school_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { studentId } = req.params;
      if (!studentId || !isUuid(studentId)) {
        return res.status(400).json({ message: 'studentId inválido.' });
      }

      const instId = institutionId(req);
      const viewer = await findUserById(getUserId(req));
      const student = await findUserById(studentId);
      if (!viewer || !instId || !student) {
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }
      if (student.institution_id !== instId || student.role !== 'estudiante') {
        return res.status(403).json({ message: 'Sin acceso a este estudiante.' });
      }

      await ensureStudentActivityTable();

      const limitRaw = req.query.limit;
      const limit =
        typeof limitRaw === 'string' && /^\d+$/.test(limitRaw) ? parseInt(limitRaw, 10) : 20;

      const items = await listStudentActivityFeed(instId, studentId, limit);
      return res.json({ items });
    } catch (e: unknown) {
      console.error('[activity/student]', e);
      return res.status(500).json({ message: 'Error al listar actividad.' });
    }
  }
);

async function assertThreadReadsAccess(
  req: AuthRequest,
  threadId: string
): Promise<
  | { ok: true; institutionId: string; groupId: string | null }
  | { ok: false; status: number; message: string }
> {
  const userId = getUserId(req);
  const instId = institutionId(req);
  const user = await findUserById(userId);
  if (!user || !instId) return { ok: false, status: 401, message: 'No autorizado.' };

  const ann = await findAnnouncementById(threadId);
  if (!ann || ann.institution_id !== instId) {
    return { ok: false, status: 404, message: 'Hilo no encontrado.' };
  }

  const r = user.role;
  if (r === 'directivo' || r === 'admin-general-colegio' || r === 'school_admin') {
    return { ok: true, institutionId: instId, groupId: ann.group_id };
  }
  if (r === 'profesor' && ann.group_id) {
    const list = await findGroupSubjectsByGroupWithDetails(ann.group_id, instId);
    if (list.some((gs) => gs.teacher_id === userId)) {
      return { ok: true, institutionId: instId, groupId: ann.group_id };
    }
  }
  return { ok: false, status: 403, message: 'Sin acceso a lecturas de este hilo.' };
}

router.get(
  '/thread/:threadId/reads',
  protect,
  requireRole('profesor', 'directivo', 'admin-general-colegio', 'school_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { threadId } = req.params;
      if (!threadId || !isUuid(threadId)) {
        return res.status(400).json({ message: 'threadId inválido.' });
      }

      const access = await assertThreadReadsAccess(req, threadId);
      if (!access.ok) return res.status(access.status).json({ message: access.message });

      await ensureStudentActivityTable();

      const opened = await getStudentsWhoOpenedThread(access.institutionId, threadId);
      let totalStudents = 0;
      if (access.groupId) {
        totalStudents = await countStudentsInGroupForThread(access.institutionId, access.groupId);
      }

      return res.json({
        total_students: totalStudents,
        opened_count: opened.length,
        students: opened.map((s) => ({
          student_id: s.student_id,
          full_name: s.full_name,
          opened_at: s.opened_at,
        })),
      });
    } catch (e: unknown) {
      console.error('[activity/thread/reads]', e);
      return res.status(500).json({ message: 'Error al obtener lecturas.' });
    }
  }
);

export default router;
