import express, { Response, NextFunction } from 'express';
import { protect, AuthRequest, checkAdminColegioOnly } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { logAdminAction } from '../services/auditLogger.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupById, findGroupByNameAndInstitution, findGroupsByInstitution } from '../repositories/groupRepository.js';
import { resolveGroupId, resolveGroupSubjectId } from '../utils/resolveLegacyCourse.js';
import { getFirstGroupNameForStudent, getFirstGroupForStudent, getAllCourseGroupsForStudent } from '../repositories/enrollmentRepository.js';
import {
  findSubjectById,
  findSubjectsByInstitution,
  findSubjectByNameAndInstitution,
  createSubject,
  updateSubject,
} from '../repositories/subjectRepository.js';

type ComunicadoAttachmentNormalized = {
  name: string;
  url?: string;
  fileId?: string;
  source?: string;
};

function normalizeComunicadoAttachments(raw: unknown): ComunicadoAttachmentNormalized[] {
  if (!Array.isArray(raw)) return [];
  const out: ComunicadoAttachmentNormalized[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 200) : '';
    if (!name) continue;
    const url =
      typeof o.url === 'string' && o.url.trim().length > 0 ? o.url.trim().slice(0, 2000) : undefined;
    const fileId =
      typeof o.fileId === 'string' && o.fileId.trim().length > 0
        ? o.fileId.trim().slice(0, 200)
        : undefined;
    const source =
      typeof o.source === 'string' && o.source.trim().length > 0
        ? o.source.trim().slice(0, 50)
        : undefined;
    out.push({ name, url, fileId, source });
    if (out.length >= 10) break;
  }
  return out;
}
import {
  findGroupSubjectsByGroup,
  findGroupSubjectsByGroupWithDetails,
  findGroupSubjectsBySubjectIdWithDetails,
  findGroupSubjectsByTeacher,
  findGroupSubjectsByTeacherWithDetails,
  findGroupSubjectById,
  createGroupSubject,
} from '../repositories/groupSubjectRepository.js';
import {
  findAcademicFeedWithDetails,
  createAnnouncement,
  createAnnouncementMessage,
  isUserRecipientOfAnnouncement,
  addAnnouncementRecipients,
} from '../repositories/announcementRepository.js';
import {
  findParentUserIdsForGroupSubject,
  countParentsForGroupSubject,
  listParentRecipientsForGroupSubject,
  createComunicacionAnnouncement,
  cancelComunicadoPending,
  findComunicadoById,
  markAnnouncementCorrected,
  copyRecipientsToAnnouncement,
  listComunicadosPadresForStaff,
  listComunicadosPadresForPadre,
  listUnreadComunicadosPadresForPadre,
  statsComunicadosPadresByGroupSubject,
  countUnreadParentMessagesByGroupSubjectForUser,
  markComunicadosPadresThreadsReadForGroupSubject,
  countPendingParentRepliesForTeacher,
  countUnreadComunicadosPadresForPadre,
  countUnreadInstitucionalForUser,
  countInstitucionalThisMonth,
  lastInstitucionalTitle,
  markComunicadoRead,
  findLastSentComunicadoPadresHighlightForPadre,
  countDistinctPadresComunicadoGroupSubjectsForPadre,
  findLastParentReplyHighlightForStaff,
  findLastInstitucionalHighlightForViewer,
  getReadDetailForComunicado,
  type ComunicadoResumenHighlight,
} from '../repositories/comunicacionRepository.js';
import { findEnrollmentsByGroup } from '../repositories/enrollmentRepository.js';
import { findGuardianStudentsByGuardian } from '../repositories/guardianStudentRepository.js';
import { findUsersByIds } from '../repositories/userRepository.js';
import { findGradingSchemaByGroupSubject } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
import { queryPg } from '../config/db-pg.js';
import { generateAcademicInsightsSummary, type AcademicInsightsContext, type AcademicInsightRole } from '../services/openai.js';

const router = express.Router();

const checkIsDirectivo = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.rol === 'directivo') next();
  else res.status(403).json({ message: 'Acceso denegado. Solo Directivos pueden realizar esta acción.' });
};

const checkIsDirectivoOrAdminColegio = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && (req.user.rol === 'directivo' || req.user.rol === 'admin-general-colegio' || req.user.rol === 'asistente-academica' || req.user.rol === 'school_admin')) next();
  else res.status(403).json({ message: 'Acceso denegado. Solo Directivos o Administradores del Colegio pueden realizar esta acción.' });
};

function toCourseResponse(gs: { id: string; subject_id: string; group_id: string; teacher_id: string; institution_id: string; created_at: string; icon?: string | null }, subject: { id: string; name: string; description: string | null } | null, teacher: { id: string; full_name: string; email: string } | null, groupName?: string) {
  const nombre = groupName ? `${subject?.name ?? ''} ${groupName}`.trim() || (subject?.name ?? '') : (subject?.name ?? '');
  return {
    _id: gs.id,
    id: gs.id,
    nombre,
    descripcion: subject?.description ?? '',
    colorAcento: '',
    icono: gs.icon ?? '',
    cursos: groupName ? [groupName] : [],
    profesorIds: teacher ? [{ _id: teacher.id, nombre: teacher.full_name, email: teacher.email }] : [],
    colegioId: gs.institution_id,
    groupId: gs.group_id,
  };
}

// Rutas con path fijo primero (antes de /:id)
// GET /api/courses/for-group/:grupo — :grupo puede ser UUID del grupo o nombre (ej. 11H)
router.get('/for-group/:grupo', protect, async (req: AuthRequest, res) => {
  try {
    const { grupo } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.institutionId ?? req.user?.colegioId;
    const userRole = req.user?.rol;

    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });

    const allowedRoles = ['profesor', 'directivo', 'admin-general-colegio', 'asistente-academica', 'school_admin', 'super_admin', 'padre'];
    if (!allowedRoles.includes(userRole ?? '')) {
      return res.status(403).json({ message: 'Sin acceso' });
    }

    const resolved = await resolveGroupId(grupo.trim(), colegioId);
    if (!resolved) return res.json([]);

    const list = await findGroupSubjectsByGroupWithDetails(resolved.id, colegioId);

    // Profesor: solo sus materias. Otros roles: todas las materias del grupo
    const filtered = userRole === 'profesor'
      ? list.filter((gs) => gs.teacher_id === userId)
      : list;

    const courses = filtered.map((gs) =>
      toCourseResponse(
        gs,
        { id: gs.subject_id, name: gs.subject_name, description: gs.subject_description },
        { id: gs.teacher_id, full_name: gs.teacher_name, email: gs.teacher_email },
        gs.group_name
      )
    );

    return res.json(courses);
  } catch (error: unknown) {
    console.error('Error al obtener materias para grupo:', (error as Error).message);
    return res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// GET /api/courses/by-name
router.get('/by-name', protect, async (req: AuthRequest, res) => {
  const name = (req.query.name || req.query.nombre) as string;
  if (!name || typeof name !== 'string') return res.status(400).json({ message: 'El parámetro de nombre es obligatorio.' });
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado' });
    const subject = await findSubjectByNameAndInstitution(colegioId, name);
    if (!subject) return res.status(404).json({ message: 'Materia no encontrada con ese nombre en este colegio.' });
    res.json({ _id: subject.id, nombre: subject.name, id: subject.id });
  } catch (error: unknown) {
    console.error('Error al buscar materia por nombre:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/courses/academic-feed — notificaciones académicas (nuevas tareas, notas)
router.get('/academic-feed', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByGroupWithDetails>>[number];
    let gsList: GsDetails[] = [];
    if (user.role === 'estudiante') {
      let curso = (user.config as { curso?: string })?.curso;
      if (!curso) curso = await getFirstGroupNameForStudent(userId) ?? undefined;
      const group = curso ? await findGroupByNameAndInstitution(colegioId, curso.toUpperCase().trim()) : null;
      const groupFallback = group ?? await getFirstGroupForStudent(userId, colegioId);
      if (groupFallback) gsList = await findGroupSubjectsByGroupWithDetails(groupFallback.id, colegioId);
    } else if (user.role === 'profesor') {
      gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) gsList.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    const groupSubjectIds = gsList.length ? gsList.map((gs) => gs.id) : undefined;
    const feed = await findAcademicFeedWithDetails(colegioId, { groupSubjectIds });
    res.json(feed.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      assignment_id: row.assignment_id,
      group_subject_id: row.group_subject_id,
      created_at: row.created_at,
      subject_name: row.subject_name,
      group_name: row.group_name,
    })));
  } catch (error: unknown) {
    console.error('Error al obtener feed académico:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// GET /api/courses/communication-summary — resumen para tarjetas del Centro de Comunicación (datos reales por group_subject_id)
router.get('/communication-summary', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByGroupWithDetails>>[number];
    let gsList: GsDetails[] = [];
    if (user.role === 'estudiante') {
      let curso = (user.config as { curso?: string })?.curso;
      if (!curso) curso = await getFirstGroupNameForStudent(userId) ?? undefined;
      const group = curso ? await findGroupByNameAndInstitution(colegioId, curso.toUpperCase().trim()) : null;
      const groupFallback = group ?? await getFirstGroupForStudent(userId, colegioId);
      if (groupFallback) gsList = await findGroupSubjectsByGroupWithDetails(groupFallback.id, colegioId);
    } else if (user.role === 'profesor') {
      gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) gsList.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    const groupSubjectIds = gsList.length ? gsList.map((gs) => gs.id) : undefined;
    const feed = await findAcademicFeedWithDetails(colegioId, { groupSubjectIds });

    const total = feed.length;
    let materiasDiferentes = new Set(feed.map((r) => r.group_subject_id).filter(Boolean)).size;

    let urgente: ComunicadoResumenHighlight | null = null;
    if (user.role === 'padre') {
      materiasDiferentes = await countDistinctPadresComunicadoGroupSubjectsForPadre(colegioId, userId);
      urgente = await findLastSentComunicadoPadresHighlightForPadre(colegioId, userId);
    } else if (
      groupSubjectIds?.length &&
      ['profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica', 'school_admin'].includes(user.role)
    ) {
      urgente = await findLastParentReplyHighlightForStaff(colegioId, userId, user.role, groupSubjectIds);
    }
    if (!urgente && user.role !== 'padre' && feed.length > 0) {
      const ult = feed[0];
      const extracto = (ult.title || ult.body || '').trim().slice(0, 280);
      urgente = {
        remitente:
          [ult.subject_name, ult.group_name].filter(Boolean).join(' - ') || 'Comunicación académica',
        extracto: extracto || '(Sin texto)',
      };
    }

    let pendingPadres = 0;
    let incomingUnreadPadres = 0;
    let respuestasPendientes = 0;
    if (
      groupSubjectIds?.length &&
      ['profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica', 'school_admin'].includes(user.role)
    ) {
      const st = await statsComunicadosPadresByGroupSubject(colegioId, groupSubjectIds);
      for (const v of Object.values(st)) {
        pendingPadres += v.pending;
      }
      const unreadByGs = await countUnreadParentMessagesByGroupSubjectForUser(colegioId, userId, groupSubjectIds);
      incomingUnreadPadres = Object.values(unreadByGs).reduce((sum, n) => sum + n, 0);
      if (user.role === 'profesor') {
        respuestasPendientes = await countPendingParentRepliesForTeacher(colegioId, userId, groupSubjectIds);
      }
    }

    let mensajesSinLeerPadres = incomingUnreadPadres;
    if (user.role === 'padre') {
      mensajesSinLeerPadres = await countUnreadComunicadosPadresForPadre(colegioId, userId);
    }

    const comMes = await countInstitucionalThisMonth(colegioId);
    const ultimoInst = await lastInstitucionalTitle(colegioId);
    let instSinLeer = 0;
    if (['padre', 'profesor', 'estudiante', 'asistente', 'school_admin'].includes(user.role)) {
      instSinLeer = await countUnreadInstitucionalForUser(colegioId, userId);
    }

    let urgenteInstitucional: ComunicadoResumenHighlight | null =
      await findLastInstitucionalHighlightForViewer(colegioId, userId);
    if (!urgenteInstitucional && ultimoInst) {
      urgenteInstitucional = { remitente: 'Comunicados institucionales', extracto: ultimoInst };
    }

    return res.json({
      academico: {
        mensajesNuevos: total + pendingPadres,
        mensajesSinLeer: mensajesSinLeerPadres,
        respuestasPendientes,
        materiasDiferentes,
        urgente,
      },
      institucional: {
        mensajesNuevos: comMes,
        mensajesSinLeer: instSinLeer,
        comunicadosMes: comMes,
        ultimoPublicado: ultimoInst,
        gruposDiferentes: 0,
        urgente: urgenteInstitucional,
      },
    });
  } catch (error: unknown) {
    console.error('Error al obtener resumen de comunicación:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// --- Comunicados a padres (curso/materia) ---
const COMUNICADO_PADRES_PUBLISH = ['profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica'] as const;

// POST /api/courses/comunicado-padres
router.post('/comunicado-padres', protect, requireRole(...COMUNICADO_PADRES_PUBLISH), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const body = req.body as {
      group_subject_id?: string;
      title?: string;
      body?: string;
      priority?: string;
      attachments?: unknown;
      recipient_parent_ids?: unknown;
    };
    const groupSubjectId = body.group_subject_id;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const priority = typeof body.priority === 'string' ? body.priority.trim() : 'normal';
    const attachments = normalizeComunicadoAttachments(body.attachments);
    if (!title) return res.status(400).json({ message: 'El título es obligatorio.' });
    if (!groupSubjectId) return res.status(400).json({ message: 'group_subject_id es obligatorio.' });
    const gs = await findGroupSubjectById(groupSubjectId);
    if (!gs || gs.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const user = await findUserById(userId);
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });
    if (user.role === 'profesor') {
      const myGs = await findGroupSubjectsByTeacher(userId, colegioId);
      if (!myGs.some((x) => x.id === groupSubjectId)) {
        return res.status(403).json({ message: 'Solo puede enviar a sus propios cursos.' });
      }
    }
    let parentIds = await findParentUserIdsForGroupSubject(groupSubjectId, colegioId);
    if (Array.isArray(body.recipient_parent_ids)) {
      const requested = body.recipient_parent_ids.filter(
        (x): x is string => typeof x === 'string' && x.trim().length > 0
      );
      if (requested.length === 0) {
        return res.status(400).json({ message: 'Indica al menos un destinatario (padre).' });
      }
      const allowed = new Set(parentIds);
      const uniqueRequested = Array.from(new Set(requested.map((id) => id.trim())));
      parentIds = uniqueRequested.filter((id) => allowed.has(id));
      if (parentIds.length === 0) {
        return res
          .status(400)
          .json({ message: 'Los destinatarios deben ser padres vinculados a este curso.' });
      }
    }
    const scheduled = new Date(Date.now() + 30_000).toISOString();
    const created = await createComunicacionAnnouncement({
      institution_id: colegioId,
      title,
      body: text || null,
      type: 'comunicado_padres',
      group_id: gs.group_id,
      group_subject_id: groupSubjectId,
      created_by_id: userId,
      status: 'pending',
      scheduled_send_at: scheduled,
      sent_at: null,
      audience: 'parents',
      category: 'general',
      priority,
      attachments_json: JSON.stringify(attachments),
    });
    await addAnnouncementRecipients(created.id, parentIds);
    return res.status(201).json({ id: created.id, scheduled_send_at: scheduled });
  } catch (e: unknown) {
    console.error('comunicado-padres:', (e as Error).message);
    return res.status(500).json({ message: 'Error al crear comunicado.' });
  }
});

// GET /api/courses/comunicados-padres-stats
router.get('/comunicados-padres-stats', protect, requireRole('profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica', 'school_admin'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByGroupWithDetails>>[number];
    let gsList: GsDetails[] = [];
    if (user.role === 'profesor') {
      gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) gsList.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    const ids = gsList.map((g) => g.id);
    const stats = await statsComunicadosPadresByGroupSubject(colegioId, ids);
    const unreadIncoming = await countUnreadParentMessagesByGroupSubjectForUser(colegioId, userId, ids);
    return res.json(
      ids.map((id) => ({
        group_subject_id: id,
        pending: stats[id]?.pending ?? 0,
        awaiting_read: stats[id]?.awaiting_read ?? 0,
        badge: unreadIncoming[id] ?? 0,
      }))
    );
  } catch (e: unknown) {
    console.error('comunicados-padres-stats:', (e as Error).message);
    return res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// GET /api/courses/comunicados-padres — padre: todos sus comunicados
router.get('/comunicados-padres', protect, requireRole('padre'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const list = await listComunicadosPadresForPadre(colegioId, userId);
    return res.json(list);
  } catch (e: unknown) {
    console.error('comunicados-padres (padre):', (e as Error).message);
    return res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// GET /api/courses/comunicados-padres-unread — padre: vista dashboard (top no leídos + total)
router.get('/comunicados-padres-unread', protect, requireRole('padre'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const limit = Math.min(10, Math.max(1, parseInt(String(req.query.limit ?? '3'), 10) || 3));
    const items = await listUnreadComunicadosPadresForPadre(colegioId, userId, limit);
    const count = await countUnreadComunicadosPadresForPadre(colegioId, userId);
    return res.json({ items, count });
  } catch (e: unknown) {
    console.error('comunicados-padres-unread:', (e as Error).message);
    return res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// GET /api/courses/padres-vinculados/:groupSubjectId
router.get('/padres-vinculados/:groupSubjectId', protect, requireRole(...COMUNICADO_PADRES_PUBLISH, 'school_admin'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    const { groupSubjectId } = req.params;
    if (!userId || !colegioId || !groupSubjectId) return res.status(401).json({ message: 'No autorizado' });
    const gs = await findGroupSubjectById(groupSubjectId);
    if (!gs || gs.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado' });
    const staffUser = await findUserById(userId);
    if (staffUser?.role === 'profesor') {
      const myGs = await findGroupSubjectsByTeacher(userId, colegioId);
      if (!myGs.some((x) => x.id === groupSubjectId)) {
        return res.status(403).json({ message: 'Solo puedes ver padres de tus cursos.' });
      }
    }
    const n = await countParentsForGroupSubject(groupSubjectId, colegioId);
    const group = await findGroupById(gs.group_id);
    const subject = await findSubjectById(gs.subject_id);
    const subjectName = (gs.display_name?.trim() || subject?.name || '').trim() || null;
    const withList =
      String(req.query.list ?? '') === '1' || String(req.query.list ?? '').toLowerCase() === 'true';
    const payload: {
      count: number;
      group_id: string;
      group_name: string | null;
      subject_name: string | null;
      parents?: { id: string; full_name: string }[];
    } = {
      count: n,
      group_id: gs.group_id,
      group_name: group?.name ?? null,
      subject_name: subjectName,
    };
    if (withList) {
      payload.parents = await listParentRecipientsForGroupSubject(groupSubjectId, colegioId);
    }
    return res.json(payload);
  } catch (e: unknown) {
    console.error('padres-vinculados:', (e as Error).message);
    return res.status(500).json({ message: 'Error' });
  }
});

// GET /api/courses/comunicados-padres/:groupSubjectId — staff
router.get('/comunicados-padres/:groupSubjectId', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const { groupSubjectId } = req.params;
    if (!userId || !colegioId || !groupSubjectId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    const gs = await findGroupSubjectById(groupSubjectId);
    if (!gs || gs.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado' });
    if (user.role === 'profesor') {
      if (gs.teacher_id !== userId) return res.status(403).json({ message: 'No tienes acceso a este curso.' });
    } else if (!['directivo', 'admin-general-colegio', 'asistente', 'asistente-academica', 'school_admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Sin acceso' });
    }
    const list = await listComunicadosPadresForStaff(colegioId, groupSubjectId);
    return res.json(list);
  } catch (e: unknown) {
    console.error('comunicados-padres/:gs:', (e as Error).message);
    return res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// POST /api/courses/comunicados-padres/:groupSubjectId/mark-threads-viewed — docente/staff: marca hilos como leídos (badge solo entrantes)
router.post(
  '/comunicados-padres/:groupSubjectId/mark-threads-viewed',
  protect,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      const colegioId = req.user?.colegioId;
      const { groupSubjectId } = req.params;
      if (!userId || !colegioId || !groupSubjectId) return res.status(401).json({ message: 'No autorizado' });
      const user = await findUserById(userId);
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
      const gs = await findGroupSubjectById(groupSubjectId);
      if (!gs || gs.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado' });
      if (user.role === 'profesor') {
        if (gs.teacher_id !== userId) return res.status(403).json({ message: 'No tienes acceso a este curso.' });
      } else if (!['directivo', 'admin-general-colegio', 'asistente', 'asistente-academica', 'school_admin', 'super_admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Sin acceso' });
      }
      await markComunicadosPadresThreadsReadForGroupSubject(colegioId, userId, groupSubjectId);
      return res.json({ ok: true });
    } catch (e: unknown) {
      console.error('mark-threads-viewed:', (e as Error).message);
      return res.status(500).json({ message: 'Error en el servidor.' });
    }
  }
);

// DELETE /api/courses/comunicado/:id/cancel
router.delete('/comunicado/:id/cancel', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    const { id } = req.params;
    if (!userId || !colegioId || !id) return res.status(401).json({ message: 'No autorizado' });
    const row = await findComunicadoById(id, colegioId);
    if (!row || row.type !== 'comunicado_padres') return res.status(404).json({ message: 'No encontrado' });
    const result = await cancelComunicadoPending(id, userId, colegioId);
    if (!result.ok) return res.status(400).json({ message: result.message });
    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error('comunicado cancel:', (e as Error).message);
    return res.status(500).json({ message: 'Error' });
  }
});

// POST /api/courses/comunicado/:id/correccion
router.post('/comunicado/:id/correccion', protect, requireRole(...COMUNICADO_PADRES_PUBLISH), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    const { id } = req.params;
    if (!userId || !colegioId || !id) return res.status(401).json({ message: 'No autorizado' });
    const original = await findComunicadoById(id, colegioId);
    if (!original || original.type !== 'comunicado_padres') return res.status(404).json({ message: 'No encontrado' });
    if (original.created_by_id !== userId) return res.status(403).json({ message: 'Solo el autor puede corregir.' });
    if (!original.sent_at) return res.status(400).json({ message: 'Aún no enviado.' });
    if (Date.now() - new Date(original.sent_at).getTime() > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ message: 'Pasaron más de 24 horas.' });
    }
    const dup = await queryPg<{ x: string }>(`SELECT id::text AS x FROM announcements WHERE correction_of = $1 LIMIT 1`, [id]);
    if (dup.rows.length) return res.status(400).json({ message: 'Ya existe corrección.' });
    const body = req.body as { title?: string; body?: string; attachments?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const attachments = normalizeComunicadoAttachments(body.attachments);
    if (!title) return res.status(400).json({ message: 'Título obligatorio.' });
    if (!original.group_subject_id || !original.group_id) return res.status(400).json({ message: 'Datos incompletos.' });
    const created = await createComunicacionAnnouncement({
      institution_id: colegioId,
      title,
      body: text || null,
      type: 'comunicado_padres',
      group_id: original.group_id,
      group_subject_id: original.group_subject_id,
      created_by_id: userId,
      status: 'sent',
      sent_at: new Date().toISOString(),
      audience: 'parents',
      category: 'general',
      priority: original.priority ?? 'normal',
      correction_of: id,
      attachments_json: JSON.stringify(attachments),
    });
    await copyRecipientsToAnnouncement(id, created.id);
    await markAnnouncementCorrected(id, colegioId);
    return res.status(201).json({ id: created.id, sent_at: created.sent_at });
  } catch (e: unknown) {
    console.error('comunicado correccion:', (e as Error).message);
    return res.status(500).json({ message: 'Error' });
  }
});

// POST /api/courses/comunicado/:id/read
router.post('/comunicado/:id/read', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    const { id } = req.params;
    if (!userId || !colegioId || !id) return res.status(401).json({ message: 'No autorizado' });
    const row = await findComunicadoById(id, colegioId);
    if (!row || row.type !== 'comunicado_padres') return res.status(404).json({ message: 'No encontrado' });
    const ok = await isUserRecipientOfAnnouncement(id, userId);
    if (!ok) return res.status(403).json({ message: 'No eres destinatario.' });
    await markComunicadoRead(id, userId);
    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error('comunicado read:', (e as Error).message);
    return res.status(500).json({ message: 'Error' });
  }
});

// GET /api/courses/comunicado/:id/read-detail — detalle de lectura para comunicados académicos
router.get(
  '/comunicado/:id/read-detail',
  protect,
  requireRole('profesor', 'directivo', 'admin-general-colegio', 'asistente', 'asistente-academica', 'school_admin', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      const colegioId = req.user?.colegioId ?? req.user?.institution_id;
      const { id } = req.params;
      if (!userId || !colegioId || !id) return res.status(401).json({ message: 'No autorizado' });
      const row = await findComunicadoById(id, colegioId);
      if (!row || row.type !== 'comunicado_padres') return res.status(404).json({ message: 'No encontrado' });
      const detail = await getReadDetailForComunicado(id, colegioId);
      return res.json({ recipients: detail });
    } catch (e: unknown) {
      console.error('comunicado read-detail:', (e as Error).message);
      return res.status(500).json({ message: 'Error' });
    }
  }
);

// POST /api/courses/comunicado/:id/mark-read — padre: alias UX-friendly (best-effort)
router.post('/comunicado/:id/mark-read', protect, requireRole('padre'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    const { id } = req.params;
    if (!userId || !colegioId || !id) return res.status(400).json({ message: 'Faltan parámetros.' });
    const row = await findComunicadoById(id, colegioId);
    if (!row || row.type !== 'comunicado_padres') return res.status(404).json({ message: 'No encontrado' });
    const ok = await isUserRecipientOfAnnouncement(id, userId);
    if (!ok) return res.status(403).json({ message: 'No eres destinatario.' });
    await markComunicadoRead(id, userId);
    return res.json({ ok: true });
  } catch {
    // Best-effort: no romper UX del padre
    return res.json({ ok: true });
  }
});

// POST /api/courses/comunicado/:id/reply — solo padres
router.post('/comunicado/:id/reply', protect, requireRole('padre'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    const { id } = req.params;
    if (!userId || !colegioId || !id) return res.status(401).json({ message: 'No autorizado' });
    const row = await findComunicadoById(id, colegioId);
    if (!row || row.type !== 'comunicado_padres') return res.status(404).json({ message: 'No encontrado' });
    const ok = await isUserRecipientOfAnnouncement(id, userId);
    if (!ok) return res.status(403).json({ message: 'No eres destinatario.' });
    const body = req.body as { content?: string };
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return res.status(400).json({ message: 'Escribe un mensaje.' });
    const msg = await createAnnouncementMessage({
      announcement_id: id,
      sender_id: userId,
      sender_role: 'padre',
      content: content.slice(0, 4000),
    });
    return res.status(201).json({ id: msg.id, created_at: msg.created_at });
  } catch (e: unknown) {
    console.error('comunicado reply:', (e as Error).message);
    return res.status(500).json({ message: 'Error' });
  }
});

// GET /api/courses/group-subjects-options — opciones para "Enviar a" (profesor/directivo/asistente)
router.get('/group-subjects-options', protect, requireRole('profesor', 'directivo', 'asistente', 'asistente-academica', 'admin-general-colegio', 'school_admin'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByGroupWithDetails>>[number];
    let gsList: GsDetails[] = [];
    if (user.role === 'profesor') {
      gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) gsList.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    res.json(gsList.map((gs) => ({ id: gs.id, subject_name: gs.subject_name, group_name: gs.group_name })));
  } catch (error: unknown) {
    console.error('Error al obtener opciones de envío:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// PATCH /api/courses/group-subject/:groupSubjectId — actualizar display_name e icon (solo profesor asignado o admin)
router.patch('/group-subject/:groupSubjectId', protect, async (req: AuthRequest, res) => {
  try {
    const { groupSubjectId } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    const role = req.user?.rol;
    if (!userId || !colegioId || !groupSubjectId) return res.status(401).json({ message: 'No autorizado.' });
    const gs = await findGroupSubjectById(groupSubjectId);
    if (!gs || gs.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const isTeacher = gs.teacher_id === userId;
    const isAdmin = ['admin-general-colegio', 'asistente-academica', 'administrador-general', 'directivo', 'school_admin', 'super_admin'].includes(role ?? '');
    if (!isTeacher && !isAdmin) return res.status(403).json({ message: 'Solo el profesor asignado o un administrador pueden editar esta materia.' });
    const body = req.body as { display_name?: string; icon?: string };
    const display_name = body.display_name !== undefined ? (typeof body.display_name === 'string' ? body.display_name.trim() || null : null) : undefined;
    const icon = body.icon !== undefined ? (typeof body.icon === 'string' ? body.icon.trim().slice(0, 32) || null : null) : undefined;
    if (display_name === undefined && icon === undefined) return res.status(400).json({ message: 'Indica display_name y/o icon para actualizar.' });
    const updates: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (display_name !== undefined) { updates.push(`display_name = $${i}`); params.push(display_name); i++; }
    if (icon !== undefined) { updates.push(`icon = $${i}`); params.push(icon); i++; }
    params.push(groupSubjectId);
    await queryPg(`UPDATE group_subjects SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, display_name, icon`, params);
    res.json({ message: 'Materia actualizada.', groupSubjectId });
  } catch (error: unknown) {
    console.error('Error al actualizar materia:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// POST /api/courses/academic-message — enviar mensaje académico a un curso (profesor/directivo/asistente)
router.post('/academic-message', protect, requireRole('profesor', 'directivo', 'asistente', 'asistente-academica', 'admin-general-colegio', 'school_admin'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const body = req.body as { title?: string; body?: string; group_subject_id?: string; groupSubjectId?: string };
    const title = body?.title;
    const groupSubjectId = body?.group_subject_id ?? body?.groupSubjectId;
    if (!title || typeof title !== 'string' || title.trim() === '') return res.status(400).json({ message: 'El título es obligatorio.' });
    if (!groupSubjectId || typeof groupSubjectId !== 'string') return res.status(400).json({ message: 'Debe indicar el curso de destino (group_subject_id).' });
    const gs = await findGroupSubjectById(groupSubjectId);
    if (!gs || gs.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const user = await findUserById(userId);
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });
    if (user.role === 'profesor') {
      const myGs = await findGroupSubjectsByTeacher(userId, colegioId);
      if (!myGs.some((x) => x.id === groupSubjectId)) return res.status(403).json({ message: 'Solo puede enviar mensajes a sus propios cursos.' });
    }
    const created = await createAnnouncement({
      institution_id: colegioId,
      title: title.trim(),
      body: body.body && typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : null,
      type: 'mensaje_academico',
      group_id: gs.group_id,
      group_subject_id: groupSubjectId,
      created_by_id: userId,
    });
    res.status(201).json({ id: created.id, title: created.title, created_at: created.created_at });
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error('Error al enviar mensaje académico:', err.message, err.stack);
    const message = err.code === '23503' ? 'Datos inconsistentes (curso o institución no encontrada).' : (err.message || 'Error en el servidor.');
    res.status(500).json({ message });
  }
});

// GET /api/courses/academic-groups
router.get('/academic-groups', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByGroupWithDetails>>[number];
    let gsList: GsDetails[] = [];
    if (user.role === 'estudiante') {
      let curso = (user.config as { curso?: string })?.curso;
      if (!curso) curso = await getFirstGroupNameForStudent(userId) ?? undefined;
      let group = curso ? await findGroupByNameAndInstitution(colegioId, curso.toUpperCase().trim()) : null;
      if (!group) group = await getFirstGroupForStudent(userId, colegioId);
      if (group) gsList = await findGroupSubjectsByGroupWithDetails(group.id, colegioId);
    } else if (user.role === 'profesor') {
      gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) gsList.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    const bySubject = new Map<string, { materiaId: string; materiaNombre: string; materiaDescripcion: string | null; profesores: { _id: string; nombre: string; email: string }[]; estudiantes: { _id: string; nombre: string; email: string }[]; cursos: string[] }>();
    for (const gs of gsList) {
      const sid = gs.subject_id;
      if (!bySubject.has(sid)) {
        bySubject.set(sid, { materiaId: sid, materiaNombre: gs.subject_name, materiaDescripcion: gs.subject_description, profesores: [], estudiantes: [], cursos: [] });
      }
      const row = bySubject.get(sid)!;
      if (!row.profesores.some((p) => p._id === gs.teacher_id)) row.profesores.push({ _id: gs.teacher_id, nombre: gs.teacher_name, email: gs.teacher_email });
      if (!row.cursos.includes(gs.group_name)) row.cursos.push(gs.group_name);
      const enrollments = await findEnrollmentsByGroup(gs.group_id);
      const studentIds = enrollments.map((e) => e.student_id);
      if (studentIds.length) {
        const users = await findUsersByIds(studentIds);
        users.forEach((u) => { if (!row.estudiantes.some((e) => e._id === u.id)) row.estudiantes.push({ _id: u.id, nombre: u.full_name, email: u.email }); });
      }
    }
    res.json(Array.from(bySubject.values()));
  } catch (error: unknown) {
    console.error('Error al obtener grupos académicos:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al obtener grupos académicos.' });
  }
});

// GET /api/courses - Listar cursos según rol
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByTeacherWithDetails>>[number];
    let list: GsDetails[] = [];
    if (user.role === 'profesor') {
      list = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) list.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    const courses = list.map((gs) =>
      toCourseResponse(gs, { id: gs.subject_id, name: gs.subject_name, description: gs.subject_description }, { id: gs.teacher_id, full_name: gs.teacher_name, email: gs.teacher_email }, gs.group_name)
    );
    res.json(courses);
  } catch (error: unknown) {
    console.error('Error al cargar cursos:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al cargar los cursos.' });
  }
});

// GET /api/courses/:id/details
router.get('/:id/details', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'estudiante' && user.role !== 'padre') {
      return res.status(403).json({ message: 'Solo estudiantes y padres pueden acceder a los detalles de materias desde esta ruta' });
    }

    const gsIdResolved = await resolveGroupSubjectId(id ?? '', colegioId);
    let gs = gsIdResolved ? await findGroupSubjectById(gsIdResolved) : await findGroupSubjectById(id);
    let subject = gs ? await findSubjectById(gs.subject_id) : await findSubjectById(id);
    if (!subject) return res.status(404).json({ message: 'Materia no encontrada' });
    if (subject.institution_id !== colegioId) return res.status(403).json({ message: 'No tienes acceso a esta materia.' });

    let cursoPermitido = false;
    if (user.role === 'estudiante') {
      const courseGroups = await getAllCourseGroupsForStudent(userId, colegioId);
      if (gs) {
        cursoPermitido = courseGroups.some((g) => g.id === gs!.group_id);
      } else {
        const allGs = (await Promise.all(
          courseGroups.map((g) => findGroupSubjectsByGroup(g.id))
        )).flat();
        cursoPermitido = allGs.some((x) => x.subject_id === id);
        // Si el id es subject_id y el estudiante tiene acceso, resolver un group_subject para devolver groupSubjectId
        if (cursoPermitido && !gs && id) {
          const bySubject = await findGroupSubjectsBySubjectIdWithDetails(id, colegioId);
          const firstInStudentGroup = bySubject.find((x) => courseGroups.some((g) => g.id === x.group_id));
          if (firstInStudentGroup) gs = await findGroupSubjectById(firstInStudentGroup.id);
        }
      }
    } else if (user.role === 'padre') {
      const links = await findGuardianStudentsByGuardian(userId);
      for (const link of links) {
        const hijoGroups = await getAllCourseGroupsForStudent(link.student_id, colegioId);
        if (gs) {
          if (hijoGroups.some((g) => g.id === gs!.group_id)) {
            cursoPermitido = true;
            break;
          }
        } else {
          const allGs = (await Promise.all(
            hijoGroups.map((g) => findGroupSubjectsByGroup(g.id))
          )).flat();
          if (allGs.some((x) => x.subject_id === id)) {
            cursoPermitido = true;
            if (!gs && id) {
              const bySubject = await findGroupSubjectsBySubjectIdWithDetails(id, colegioId);
              const firstInHijoGroup = bySubject.find((x) => hijoGroups.some((g) => g.id === x.group_id));
              if (firstInHijoGroup) gs = await findGroupSubjectById(firstInHijoGroup.id);
            }
            break;
          }
        }
      }
    }
    if (!cursoPermitido) return res.status(403).json({ message: 'No tienes acceso a esta materia.' });

    const teacher = gs ? await findUserById(gs.teacher_id) : null;
    const cursoAsignado = user.role === 'estudiante' ? (await getFirstGroupNameForStudent(userId)) ?? undefined : undefined;
    const displayName = (gs?.display_name?.trim() || subject.name);
    res.json({
      _id: subject.id,
      groupSubjectId: gs?.id ?? null,
      nombre: displayName,
      descripcion: subject.description,
      colorAcento: '',
      icono: gs?.icon ?? '',
      cursos: gs ? [(await findGroupById(gs.group_id))?.name].filter(Boolean) : [],
      cursoAsignado,
      profesor: teacher ? { _id: teacher.id, nombre: teacher.full_name, email: teacher.email } : null,
      profesorIds: teacher ? [{ _id: teacher.id, nombre: teacher.full_name, email: teacher.email }] : [],
    });
  } catch (error: unknown) {
    console.error('Error al obtener materia:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al obtener la materia.' });
  }
});

// GET /api/courses/:id/grading-schema
router.get('/:id/grading-schema', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id ?? '';
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const gsId = await resolveGroupSubjectId(courseId, colegioId);
    if (!gsId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const schema = await findGradingSchemaByGroupSubject(gsId, colegioId);
    if (!schema) return res.json({ schema: null, categories: [] });
    const categories = await findGradingCategoriesBySchema(schema.id);
    return res.json({
      schema: { _id: schema.id, ...schema },
      categories: categories.map((c) => ({ _id: c.id, ...c })),
    });
  } catch (e: unknown) {
    console.error('Error GET grading-schema:', e);
    return res.status(500).json({ message: 'Error al obtener esquema de calificación.' });
  }
});

// --- Analytics helper: shared data for snapshots, forecast, risk, insights, analytics-summary, intelligence
interface AnalyticsGradeRow {
  score: number;
  grading_category_id: string;
  assignment_id: string;
  recorded_at: string;
}
interface AnalyticsAllGradeRow {
  user_id: string;
  score: number;
  grading_category_id: string;
}
interface AnalyticsAttendanceRow {
  status: string;
  punctuality: string | null;
}
interface AnalyticsSubmissionRow {
  status: string;
  assignment_id: string;
}

async function getAnalyticsData(
  groupSubjectId: string,
  studentId: string,
  institutionId: string
): Promise<{
  gs: Awaited<ReturnType<typeof findGroupSubjectById>>;
  schema: Awaited<ReturnType<typeof findGradingSchemaByGroupSubject>>;
  categories: Awaited<ReturnType<typeof findGradingCategoriesBySchema>>;
  studentGrades: AnalyticsGradeRow[];
  allGrades: AnalyticsAllGradeRow[];
  attendanceData: AnalyticsAttendanceRow[];
  submissionsData: AnalyticsSubmissionRow[];
} | null> {
  const gs = await findGroupSubjectById(groupSubjectId);
  if (!gs || gs.institution_id !== institutionId) return null;

  const schema = await findGradingSchemaByGroupSubject(groupSubjectId, institutionId);
  if (!schema) return null;

  const categories = await findGradingCategoriesBySchema(schema.id);

  const studentGradesResult = await queryPg<AnalyticsGradeRow>(
    `SELECT g.score, g.grading_category_id, g.assignment_id, g.recorded_at
     FROM grades g
     JOIN assignments a ON g.assignment_id = a.id
     WHERE g.user_id = $1 AND g.group_id = $2 AND a.group_subject_id = $3
     ORDER BY g.recorded_at ASC`,
    [studentId, gs.group_id, groupSubjectId]
  );

  const allGradesResult = await queryPg<AnalyticsAllGradeRow>(
    `SELECT g.user_id, g.score, g.grading_category_id
     FROM grades g
     JOIN assignments a ON g.assignment_id = a.id
     WHERE a.group_subject_id = $1`,
    [groupSubjectId]
  );

  const attendanceResult = await queryPg<AnalyticsAttendanceRow>(
    `SELECT status, punctuality FROM attendance
     WHERE user_id = $1 AND group_subject_id = $2`,
    [studentId, groupSubjectId]
  );

  const submissionsResult = await queryPg<AnalyticsSubmissionRow>(
    `SELECT s.status, s.assignment_id
     FROM submissions s
     JOIN assignments a ON s.assignment_id = a.id
     WHERE s.student_id = $1 AND a.group_subject_id = $2`,
    [studentId, groupSubjectId]
  );

  return {
    gs,
    schema,
    categories,
    studentGrades: studentGradesResult.rows,
    allGrades: allGradesResult.rows,
    attendanceData: attendanceResult.rows,
    submissionsData: submissionsResult.rows,
  };
}

/** Promedio 0–100: solo categorías con al menos una nota; pesos renormalizados (N/A no cuenta como 0). */
function normalizedWeightedGradeAverage(
  categories: { id: string; weight: unknown }[],
  studentGrades: { grading_category_id: string; score: unknown }[]
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const cat of categories) {
    const catGrades = studentGrades.filter((g) => g.grading_category_id === cat.id);
    if (catGrades.length === 0) continue;
    const w = Number(cat.weight);
    if (!Number.isFinite(w) || w <= 0) continue;
    const avg = catGrades.reduce((s, g) => s + Number(g.score), 0) / catGrades.length;
    weightedSum += avg * (w / 100);
    totalWeight += w;
  }
  if (totalWeight <= 0) return 0;
  return (weightedSum / totalWeight) * 100;
}

// GET /api/courses/:id/snapshots
router.get('/:id/snapshots', protect, async (req: AuthRequest, res) => {
  const courseId = req.params.id;
  const studentId = req.query.studentId as string;
  const institutionId = req.user?.institutionId ?? req.user?.colegioId;

  if (!studentId) return res.json([]);
  if (req.user?.rol === 'estudiante' && req.user?.id !== studentId) return res.json([]);

  const gsId = await resolveGroupSubjectId(courseId ?? '', institutionId ?? '');
  if (!gsId) return res.json([]);

  const data = await getAnalyticsData(gsId, studentId, institutionId ?? '');
  if (!data) return res.json([]);

  const { categories, studentGrades } = data;

  const categoryAverages: Record<string, number> = {};
  const categoryImpacts: Record<string, number> = {};
  const categoryNames: Record<string, string> = {};
  const categoryWeights: Record<string, number> = {};

  for (const cat of categories) {
    categoryNames[cat.id] = cat.name;
    categoryWeights[cat.id] = Number(cat.weight);
    const catGrades = studentGrades.filter((g) => g.grading_category_id === cat.id);
    if (catGrades.length === 0) continue;
    const avg = catGrades.reduce((s, g) => s + Number(g.score), 0) / catGrades.length;
    categoryAverages[cat.id] = avg;
    const impact = avg * (Number(cat.weight) / 100);
    categoryImpacts[cat.id] = impact;
  }
  const weightedFinalNorm = normalizedWeightedGradeAverage(categories, studentGrades);

  const evolucionLabels: string[] = [];
  const evolucionPromedios: number[] = [];
  const gradesByDate = (studentGrades as AnalyticsGradeRow[])
    .filter((g) => g.recorded_at)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  if (gradesByDate.length > 0) {
    let runningSum = 0;
    let runningCount = 0;
    gradesByDate.forEach((g) => {
      runningSum += Number(g.score);
      runningCount += 1;
      const d = new Date(g.recorded_at);
      evolucionLabels.push(`${d.getDate()}/${d.toLocaleString('es', { month: 'short' })}`);
      evolucionPromedios.push(Math.round((runningSum / runningCount) * 10) / 10);
    });
  }

  const snapshot = {
    _id: `${gsId}-${studentId}`,
    studentId,
    courseId: gsId,
    at: new Date().toISOString(),
    weightedFinalAverage: Math.round(weightedFinalNorm * 10) / 10,
    categoryAverages,
    categoryImpacts,
    categoryNames,
    categoryWeights,
    trendDirection: 'stable' as const,
    evolucion: {
      labels: evolucionLabels,
      promedios: evolucionPromedios,
    },
  };

  return res.json([snapshot]);
});

// GET /api/courses/:id/forecast
router.get('/:id/forecast', protect, async (req: AuthRequest, res) => {
  const courseId = req.params.id;
  const studentId = req.query.studentId as string;
  const institutionId = req.user?.institutionId ?? req.user?.colegioId;

  if (!studentId) return res.json(null);
  if (req.user?.rol === 'estudiante' && req.user?.id !== studentId) return res.json(null);

  const gsId = await resolveGroupSubjectId(courseId ?? '', institutionId ?? '');
  if (!gsId) return res.json(null);

  const data = await getAnalyticsData(gsId, studentId, institutionId ?? '');
  if (!data || data.studentGrades.length === 0) return res.json(null);

  const { categories, studentGrades } = data;

  const current = Math.round(normalizedWeightedGradeAverage(categories, studentGrades) * 10) / 10;

  const scores = studentGrades.map((g) => Number(g.score));
  const last3 = scores.slice(-3);
  const prev3 = scores.slice(-6, -3);
  const avgLast = last3.reduce((s, n) => s + n, 0) / (last3.length || 1);
  const avgPrev = prev3.length ? prev3.reduce((s, n) => s + n, 0) / prev3.length : avgLast;
  const delta = avgLast - avgPrev;

  const projected = Math.min(100, Math.max(0, current + delta));

  return res.json({
    _id: `forecast-${gsId}-${studentId}`,
    projectedFinalGrade: Math.round(projected * 10) / 10,
    confidenceInterval: {
      low: Math.max(0, Math.round((projected - Math.abs(delta) * 2) * 10) / 10),
      high: Math.min(100, Math.round((projected + Math.abs(delta) * 2) * 10) / 10),
    },
    riskProbabilityPercent: delta < -3 ? Math.min(90, Math.round(Math.abs(delta) * 5)) : 10,
    method: 'trend',
  });
});

// GET /api/courses/:id/risk
router.get('/:id/risk', protect, async (req: AuthRequest, res) => {
  const courseId = req.params.id;
  const studentId = req.query.studentId as string;
  const institutionId = req.user?.institutionId ?? req.user?.colegioId;

  if (!studentId) return res.json(null);
  if (req.user?.rol === 'estudiante' && req.user?.id !== studentId) return res.json(null);

  const gsId = await resolveGroupSubjectId(courseId ?? '', institutionId ?? '');
  if (!gsId) return res.json(null);

  const data = await getAnalyticsData(gsId, studentId, institutionId ?? '');
  if (!data) return res.json(null);

  const { categories, studentGrades, attendanceData } = data;

  const current = normalizedWeightedGradeAverage(categories, studentGrades);

  const factors: string[] = [];
  if (current < 60) factors.push('Promedio por debajo del mínimo aprobatorio');
  if (current < 75 && current >= 60) factors.push('Promedio en zona de riesgo');

  const absences = attendanceData.filter((a) => a.status === 'absent').length;
  const totalAtt = attendanceData.length;
  const attRate = totalAtt > 0 ? (totalAtt - absences) / totalAtt : 1;
  if (attRate < 0.8) factors.push(`Asistencia baja: ${Math.round(attRate * 100)}%`);

  const scores = studentGrades.map((g) => Number(g.score));
  const last3 = scores.slice(-3);
  const prev3 = scores.slice(-6, -3);
  const avgLast = last3.reduce((s, n) => s + n, 0) / (last3.length || 1);
  const avgPrev = prev3.length ? prev3.reduce((s, n) => s + n, 0) / prev3.length : avgLast;
  const delta = avgLast - avgPrev;
  if (delta < -5) factors.push('Tendencia descendente en calificaciones recientes');

  const level = current < 60 ? 'high' : current < 75 ? 'medium' : 'low';
  const stabilityIndex = Math.min(1, Math.max(0, current / 100));

  return res.json({
    _id: `risk-${gsId}-${studentId}`,
    level,
    factors,
    academicStabilityIndex: Math.round(stabilityIndex * 100) / 100,
    recoveryPotentialScore: Math.round(Math.min(1, (100 - current) / 40) * 100) / 100,
  });
});

// GET /api/courses/:id/insights
router.get('/:id/insights', protect, async (req: AuthRequest, res) => {
  const courseId = req.params.id;
  const studentId = req.query.studentId as string;
  const institutionId = req.user?.institutionId ?? req.user?.colegioId;

  if (!studentId) return res.json({ insights: [] });
  if (req.user?.rol === 'estudiante' && req.user?.id !== studentId) return res.json({ insights: [] });

  const gsId = await resolveGroupSubjectId(courseId ?? '', institutionId ?? '');
  if (!gsId) return res.json({ insights: [] });

  const data = await getAnalyticsData(gsId, studentId, institutionId ?? '');
  if (!data) return res.json({ insights: [] });

  const { categories, studentGrades, allGrades } = data;
  const insights: string[] = [];

  for (const cat of categories) {
    const catGrades = studentGrades.filter((g) => g.grading_category_id === cat.id);
    if (catGrades.length === 0) continue;
    const avg = catGrades.reduce((s, g) => s + Number(g.score), 0) / catGrades.length;
    const allCatGrades = allGrades.filter((g) => g.grading_category_id === cat.id);
    const groupAvg = allCatGrades.length
      ? allCatGrades.reduce((s, g) => s + Number(g.score), 0) / allCatGrades.length
      : avg;

    if (Number(cat.weight) >= 30 && avg < 75) {
      insights.push(`${cat.name} representa el ${cat.weight}% de la nota — promedio actual: ${Math.round(avg)}`);
    }
    if (avg > groupAvg + 5) {
      insights.push(`Desempeño destacado en ${cat.name}: ${Math.round(avg - groupAvg)} pts sobre el promedio del grupo`);
    }
    if (avg < groupAvg - 5) {
      insights.push(`Área de oportunidad en ${cat.name}: ${Math.round(groupAvg - avg)} pts bajo el promedio del grupo`);
    }
  }

  return res.json({ insights });
});

// GET /api/courses/:id/analytics-summary
router.get('/:id/analytics-summary', protect, async (req: AuthRequest, res) => {
  const courseId = req.params.id;
  const studentId = req.query.studentId as string;
  const institutionId = req.user?.institutionId ?? req.user?.colegioId;

  if (!studentId) return res.json({ weightedAverage: null, byCategory: [], aiSummary: '', insights: [] });
  if (req.user?.rol === 'estudiante' && req.user?.id !== studentId) return res.status(403).json({ weightedAverage: null, byCategory: [], aiSummary: '', insights: [] });

  const gsId = await resolveGroupSubjectId(courseId ?? '', institutionId ?? '');
  if (!gsId) return res.json({ weightedAverage: null, byCategory: [], aiSummary: '', insights: [] });

  const data = await getAnalyticsData(gsId, studentId, institutionId ?? '');
  if (!data) return res.json({ weightedAverage: null, byCategory: [], aiSummary: '', insights: [] });

  const { categories, studentGrades } = data;

  const byCategory: Array<{ categoryName: string; percentage: number; average: number; count: number }> = [];

  for (const cat of categories) {
    const catGrades = studentGrades.filter((g) => g.grading_category_id === cat.id);
    const avg = catGrades.length
      ? catGrades.reduce((s, g) => s + Number(g.score), 0) / catGrades.length
      : 0;
    byCategory.push({
      categoryName: cat.name,
      percentage: Number(cat.weight),
      average: Math.round(avg * 10) / 10,
      count: catGrades.length,
    });
  }

  const weightedAverage = Math.round(normalizedWeightedGradeAverage(categories, studentGrades) * 10) / 10;
  const estado = weightedAverage >= 85 ? 'excelente' : weightedAverage >= 75 ? 'bueno' : weightedAverage >= 60 ? 'en riesgo' : 'crítico';

  let aiSummary = `Promedio ponderado: ${weightedAverage}/100. Estado: ${estado}.`;

  try {
    const student = await findUserById(studentId);
    const subject = data.gs ? await findSubjectById(data.gs.subject_id) : null;
    const courseDisplayName = (data.gs?.display_name?.trim() || subject?.name) ?? 'Materia';
    const context: AcademicInsightsContext = {
      studentName: student?.full_name ?? 'Estudiante',
      courseName: courseDisplayName,
      weightedAverage,
      byCategory,
      role: (req.user?.rol as AcademicInsightRole) ?? 'profesor',
    };
    const generated = await generateAcademicInsightsSummary(context);
    if (generated && !generated.includes('OPENAI_API_KEY') && !generated.includes('Error al generar')) {
      aiSummary = generated;
    }
  } catch (e) {
    console.error('Error generando aiSummary con IA (vista analítica):', e);
  }

  return res.json({
    weightedAverage,
    byCategory,
    snapshot: null,
    forecast: null,
    risk: null,
    aiSummary,
    insights: byCategory
      .filter((c) => c.average < 75 && c.percentage >= 20)
      .map((c) => `${c.categoryName} (${c.percentage}%): promedio ${c.average}`),
  });
});

// GET /api/courses/:id/intelligence
router.get('/:id/intelligence', protect, async (req: AuthRequest, res) => {
  const courseId = req.params.id;
  const studentId = req.query.studentId as string;
  const institutionId = req.user?.institutionId ?? req.user?.colegioId;

  if (!studentId) return res.json(null);
  if (req.user?.rol === 'estudiante' && req.user?.id !== studentId) return res.json(null);

  const gsId = await resolveGroupSubjectId(courseId ?? '', institutionId ?? '');
  if (!gsId) return res.json(null);

  const data = await getAnalyticsData(gsId, studentId, institutionId ?? '');
  if (!data) return res.json(null);

  const { categories, studentGrades, allGrades, attendanceData, submissionsData } = data;

  let studentWeighted = 0;
  for (const cat of categories) {
    const catGrades = studentGrades.filter((g) => g.grading_category_id === cat.id);
    if (!catGrades.length) continue;
    const avg = catGrades.reduce((s, g) => s + Number(g.score), 0) / catGrades.length;
    studentWeighted += avg * (Number(cat.weight) / 100);
  }

  const studentIds = Array.from(new Set(allGrades.map((g) => g.user_id)));
  const studentAverages: number[] = [];

  for (const sid of studentIds) {
    const sGrades = allGrades.filter((g) => g.user_id === sid);
    let sw = 0;
    for (const cat of categories) {
      const cg = sGrades.filter((g) => g.grading_category_id === cat.id);
      if (!cg.length) continue;
      const avg = cg.reduce((s, g) => s + Number(g.score), 0) / cg.length;
      sw += avg * (Number(cat.weight) / 100);
    }
    studentAverages.push(sw);
  }

  studentAverages.sort((a, b) => a - b);
  const rankIndex = studentAverages.filter((a) => a <= studentWeighted).length;
  const total = studentAverages.length || 1;
  const percentile = Math.round((rankIndex / total) * 100);
  const groupAverage = studentAverages.reduce((s, n) => s + n, 0) / (studentAverages.length || 1);

  const totalAtt = attendanceData.length;
  const presents = attendanceData.filter((a) => a.status === 'present').length;
  const onTime = attendanceData.filter((a) => a.punctuality === 'on_time').length;
  const attRate = totalAtt > 0 ? presents / totalAtt : null;
  const punctRate = totalAtt > 0 ? onTime / totalAtt : null;

  const totalAssignmentsResult = await queryPg<{ count: string }>(
    'SELECT COUNT(*) as count FROM assignments WHERE group_subject_id = $1',
    [gsId]
  );
  const totalCount = parseInt(totalAssignmentsResult.rows[0]?.count ?? '0', 10);
  const completedCount = submissionsData.filter((s) => s.status === 'submitted').length;
  const tasksRate = totalCount > 0 ? completedCount / totalCount : null;

  const rates = [attRate, tasksRate].filter((v): v is number => v !== null);
  const commitmentIndex = rates.length > 0 ? rates.reduce((s, v) => s + v, 0) / rates.length : null;

  return res.json({
    snapshot: null,
    forecast: null,
    risk: null,
    groupComparison: {
      groupAverage: Math.round(groupAverage * 10) / 10,
      groupStdDev: null,
      percentile,
      rank: total - rankIndex + 1,
      totalStudents: total,
    },
    commitment: {
      attendanceRate: attRate !== null ? Math.round(attRate * 100) / 100 : null,
      punctualityRate: punctRate !== null ? Math.round(punctRate * 100) / 100 : null,
      onTimeRate: punctRate !== null ? Math.round(punctRate * 100) / 100 : null,
      tasksCompletionRate: tasksRate !== null ? Math.round(tasksRate * 100) / 100 : null,
      commitmentIndex: commitmentIndex !== null ? Math.round(commitmentIndex * 100) / 100 : null,
    },
  });
});

// POST /api/courses - Crear curso (subject + group_subjects)
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'profesor' && user.role !== 'directivo') {
      return res.status(403).json({ message: 'Solo profesores y directivos pueden crear cursos' });
    }
    const { nombre, descripcion, cursos, colorAcento, icono } = req.body;
    const name = String(nombre || '').trim();
    if (!name) return res.status(400).json({ message: 'Falta el nombre del curso.' });
    let subject = await findSubjectByNameAndInstitution(colegioId, name);
    if (!subject) subject = await createSubject({ institution_id: colegioId, name, description: descripcion || `Materia ${name}` });
    const groupNames = Array.isArray(cursos) ? cursos.map((c: string) => String(c).toUpperCase().trim()) : [];
    const teacherId = user.role === 'profesor' ? userId : userId;
    for (const gName of groupNames) {
      const group = await findGroupByNameAndInstitution(colegioId, gName);
      if (group) {
        try {
          await createGroupSubject({
            institution_id: colegioId,
            group_id: group.id,
            subject_id: subject.id,
            teacher_id: teacherId,
          });
        } catch (_) {}
      }
    }
    if (user.role === 'profesor') {
      const materias = (user.config as { materias?: string[] })?.materias ?? [];
      if (!materias.includes(name)) await import('../repositories/userRepository.js').then(({ updateUser }) => updateUser(userId, { config: { ...user.config, materias: [...materias, name] } }));
    }
    res.status(201).json({
      _id: subject.id,
      nombre: subject.name,
      descripcion: subject.description,
      colorAcento: colorAcento || '',
      icono: icono || '',
      cursos: groupNames,
      colegioId,
    });
  } catch (error: unknown) {
    console.error('Error al crear curso:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al crear el curso.' });
  }
});

// POST /api/courses/assign-professor-to-groups
router.post('/assign-professor-to-groups', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(400).json({ message: 'Colegio no definido.' });
    const { professorId, groupNames } = req.body as { professorId?: string; groupNames?: string[] };
    if (!professorId || !Array.isArray(groupNames) || groupNames.length === 0) {
      return res.status(400).json({ message: 'Se requiere professorId y groupNames (array de nombres de curso/grupo).' });
    }
    const professor = await findUserById(professorId);
    if (!professor || professor.role !== 'profesor') return res.status(404).json({ message: 'Profesor no encontrado o rol incorrecto.' });
    if (professor.institution_id !== colegioId) return res.status(403).json({ message: 'El profesor debe pertenecer a tu colegio.' });
    const materias = (professor.config as { materias?: string[] })?.materias;
    const materiaNombre = Array.isArray(materias) && materias.length > 0 ? String(materias[0]).trim() : '';
    if (!materiaNombre) return res.status(400).json({ message: 'El profesor debe tener al menos una materia asignada.' });
    const normalizedGroups = groupNames.map((g: string) => String(g).toUpperCase().trim()).filter(Boolean);
    let subject = await findSubjectByNameAndInstitution(colegioId, materiaNombre);
    if (!subject) subject = await createSubject({ institution_id: colegioId, name: materiaNombre, description: `Materia ${materiaNombre}` });
    for (const gName of normalizedGroups) {
      const group = await findGroupByNameAndInstitution(colegioId, gName);
      if (!group) return res.status(400).json({ message: `El curso/grupo "${gName}" no existe. Créalo primero.` });
      try {
        await createGroupSubject({ institution_id: colegioId, group_id: group.id, subject_id: subject.id, teacher_id: professorId });
      } catch (_) {}
    }
    await logAdminAction({
      userId: req.user!.id!,
      role: req.user?.rol ?? 'admin-general-colegio',
      action: 'assign_professor_to_groups',
      entityType: 'course',
      entityId: subject.id,
      colegioId,
      requestData: { professorId, groupNames: normalizedGroups, materiaNombre },
    }).catch(() => {});
    return res.status(200).json({
      message: `Profesor asignado a los cursos ${normalizedGroups.join(', ')} para la materia ${materiaNombre}.`,
      course: { _id: subject.id, nombre: subject.name, cursos: normalizedGroups },
    });
  } catch (error: unknown) {
    console.error('Error en assign-professor-to-groups:', error);
    res.status(500).json({ message: 'Error al asignar profesor a los cursos.' });
  }
});

// PUT /api/courses/assign-professor
router.put('/assign-professor', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
  try {
    const { courseId, professorId } = req.body;
    const colegioId = req.user?.colegioId;
    if (!courseId || !professorId) return res.status(400).json({ message: 'Se requiere el ID del curso y el ID del profesor.' });
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const gsId = await resolveGroupSubjectId(String(courseId).trim(), colegioId);
    if (!gsId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const gs = await findGroupSubjectById(gsId);
    if (!gs) return res.status(404).json({ message: 'Curso no encontrado.' });
    const professor = await findUserById(professorId);
    if (!professor || professor.role !== 'profesor') return res.status(404).json({ message: 'Profesor no encontrado o rol incorrecto.' });
    const { queryPg } = await import('../config/db-pg.js');
    await queryPg('UPDATE group_subjects SET teacher_id = $1 WHERE id = $2 RETURNING 1', [professorId, gsId]);
    const subject = await findSubjectById(gs.subject_id);
    const courseDisplayName = (gs.display_name?.trim() || subject?.name) ?? '';
    await logAdminAction({
      userId: req.user!.id!,
      role: req.user?.rol ?? 'admin-general-colegio',
      action: 'assign_professor',
      entityType: 'course',
      entityId: gsId,
      colegioId: gs.institution_id,
      requestData: { courseId: gsId, professorId, courseName: courseDisplayName },
    }).catch(() => {});
    res.status(200).json({ message: `Profesor asignado correctamente al curso ${courseDisplayName}.`, course: { _id: gs.id }, professor: { _id: professor.id, nombre: professor.full_name } });
  } catch (error: unknown) {
    console.error('Error al asignar profesor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/courses/enroll-students - En PG la inscripción es por grupo (enrollments), no por "curso" Mongo
router.put('/enroll-students', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
  try {
    const { courseId, studentIds } = req.body;
    const colegioId = req.user?.colegioId;
    if (!courseId || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Se requiere el ID del curso y una lista de IDs de estudiantes.' });
    }
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const gsId = await resolveGroupSubjectId(String(courseId).trim(), colegioId);
    if (!gsId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const gs = await findGroupSubjectById(gsId);
    if (!gs) return res.status(404).json({ message: 'Curso no encontrado.' });
    const { createEnrollment } = await import('../repositories/enrollmentRepository.js');
    const { findActiveAcademicPeriodForInstitution } = await import('../repositories/academicPeriodRepository.js');
    const period = await findActiveAcademicPeriodForInstitution(gs.institution_id);
    const group = await findGroupById(gs.group_id);
    for (const sid of studentIds) {
      try {
        await createEnrollment({ student_id: sid, group_id: gs.group_id, academic_period_id: period?.id ?? null });
      } catch (_) {}
    }
    await logAdminAction({
      userId: req.user!.id!,
      role: req.user?.rol ?? 'admin-general-colegio',
      action: 'enroll_students',
      entityType: 'course',
      entityId: gsId,
      colegioId: gs.institution_id,
      requestData: { courseId: gsId, studentIds },
    }).catch(() => {});
    res.status(200).json({
      message: `Estudiantes inscritos en el curso ${group?.name ?? gsId}.`,
      course: { _id: gs.id },
      studentIds,
    });
  } catch (error: unknown) {
    console.error('Error al inscribir estudiantes:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/courses/:id
router.put('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado' });
    const subject = await findSubjectById(id);
    if (!subject || subject.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const { nombre, descripcion } = req.body;
    const updated = await updateSubject(id, colegioId, { name: nombre ?? subject.name, description: descripcion ?? subject.description });
    res.json(updated ?? subject);
  } catch (error: unknown) {
    console.error('Error al actualizar curso:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/courses/assign - stub
router.post('/assign', protect, checkIsDirectivoOrAdminColegio, async (req: AuthRequest, res) => {
  res.status(200).json({ message: 'Usa POST /assign-professor-to-groups o PUT /assign-professor.' });
});

// DELETE /api/courses/:id - No borramos subject si hay group_subjects; solo para compatibilidad
router.delete('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado' });
    const subject = await findSubjectById(id);
    if (!subject || subject.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const { queryPg } = await import('../config/db-pg.js');
    await queryPg('DELETE FROM group_subjects WHERE subject_id = $1 AND institution_id = $2', [id, colegioId]);
    res.json({ message: 'Curso eliminado.', _id: id });
  } catch (error: unknown) {
    console.error('Error al eliminar curso:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
