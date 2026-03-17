import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { queryPg } from '../config/db-pg.js';
import {
  findAnnouncementsByInstitution,
  findAnnouncementById,
  findAnnouncementMessages,
  createAnnouncement,
  createAnnouncementMessage,
  getLastAnnouncementMessage,
  findOrCreateEvoChatForGroupSubject,
  findAnnouncementsByRecipient,
  isUserRecipientOfAnnouncement,
  findSupportThreadByInstitution,
  addAnnouncementRecipients,
} from '../repositories/announcementRepository.js';
import { findUserById, findUsersByIds } from '../repositories/userRepository.js';
import { findGroupById } from '../repositories/groupRepository.js';
import { findAssignmentById } from '../repositories/assignmentRepository.js';
import { createNotification } from '../repositories/notificationRepository.js';
import {
  findGroupSubjectsByTeacher,
  findGroupSubjectsByTeacherWithDetails,
  findGroupSubjectsByGroupWithDetails,
  findGroupSubjectById,
} from '../repositories/groupSubjectRepository.js';
import { findGroupsByInstitution } from '../repositories/groupRepository.js';
import { findEnrollmentsByStudent } from '../repositories/enrollmentRepository.js';
import { emitEvoMessage } from '../socket.js';

const router = express.Router();
const EVO_SEND_ROLES = ['directivo', 'profesor', 'estudiante', 'asistente', 'admin-general-colegio'];

async function resolveRecipientsForThread(args: {
  announcement: { id: string; type: string; group_id: string | null; group_subject_id: string | null; created_by_id: string };
  institutionId: string;
}): Promise<string[]> {
  const a = args.announcement;

  // Staff / Direct / Support: recipients table is the source of truth.
  if (a.type === 'evo_chat_staff' || a.type === 'evo_chat_direct' || a.type === 'evo_chat_support') {
    const r = await queryPg<{ user_id: string }>(
      'SELECT user_id FROM announcement_recipients WHERE announcement_id = $1',
      [a.id]
    );
    return r.rows.map((x: { user_id: string }) => x.user_id);
  }

  // Curso (evo_chat): infer recipients from group membership + assigned teacher.
  if (a.type === 'evo_chat' && a.group_id) {
    const r = await queryPg<{ student_id: string }>(
      'SELECT student_id FROM enrollments WHERE group_id = $1',
      [a.group_id]
    );
    const recipientMap: Record<string, true> = {};
    for (const x of r.rows) recipientMap[x.student_id] = true;

    if (a.group_subject_id) {
      const t = await queryPg<{ teacher_id: string }>(
        'SELECT teacher_id FROM group_subjects WHERE id = $1 AND institution_id = $2 LIMIT 1',
        [a.group_subject_id, args.institutionId]
      );
      const teacherId = t.rows[0]?.teacher_id;
      if (teacherId) recipientMap[teacherId] = true;
    }

    return Object.keys(recipientMap);
  }

  return [];
}

function truncateText(s: string, max = 240) {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(0, max - 1))}…`;
}

async function buildThreadFromAnnouncement(a: {
  id: string;
  title: string;
  type: string;
  group_id: string | null;
  assignment_id: string | null;
  created_by_id: string;
  updated_at: string;
}) {
  const creator = await findUserById(a.created_by_id);
  const lastMsg = await getLastAnnouncementMessage(a.id);
  const lastSender = lastMsg ? await findUserById(lastMsg.sender_id) : null;
  let cursoId: { _id: string; nombre: string } | undefined;
  if (a.group_id) {
    const g = await findGroupById(a.group_id);
    if (g) cursoId = { _id: g.id, nombre: g.name };
  }
  let assignmentId: { _id: string; titulo: string; fechaEntrega: string } | undefined;
  if (a.assignment_id) {
    const asn = await findAssignmentById(a.assignment_id);
    if (asn) assignmentId = { _id: asn.id, titulo: asn.title, fechaEntrega: asn.due_date };
  }
  return {
    _id: a.id,
    asunto: a.title,
    displayTitle: a.title,
    tipo: a.type,
    creadoPor: creator ? { _id: creator.id, nombre: creator.full_name, rol: creator.role } : undefined,
    cursoId,
    assignmentId,
    ultimoMensaje: lastMsg
      ? {
          contenido: lastMsg.content,
          fecha: lastMsg.created_at,
          prioridad: lastMsg.priority,
          remitente: lastSender?.full_name ?? (creator?.full_name) ?? '',
        }
      : null,
    unreadCount: 0,
    updatedAt: a.updated_at,
  };
}

router.get('/threads', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const tipo = req.query.tipo as string | undefined;

    // Profesor: mis_cursos + colegas + Soporte GLC al tope
    if (rol === 'profesor' && userId) {
      const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
      const misCursos = await Promise.all(
        gsList.map(async (gs) => {
          const a = await findOrCreateEvoChatForGroupSubject(
            gs.id,
            colegioId,
            gs.group_name,
            gs.teacher_id,
            gs.group_id
          );
          const t = await buildThreadFromAnnouncement(a);
          return { ...t, displayTitle: gs.group_name };
        })
      );
      const staffAnnouncements = await findAnnouncementsByRecipient(userId, ['evo_chat_staff'], colegioId);
      const colegas = await Promise.all(staffAnnouncements.map((a) => buildThreadFromAnnouncement(a)));
      const supportAnn = await findSupportThreadByInstitution(colegioId);
      const support_thread =
        supportAnn != null
          ? { ...(await buildThreadFromAnnouncement(supportAnn)), is_support: true as const }
          : null;
      return res.json({ mis_cursos: misCursos, colegas, support_thread });
    }

    // Directivo: colegas + directos + Soporte GLC al tope
    if (rol === 'directivo' && userId) {
      const staffAnnouncements = await findAnnouncementsByRecipient(userId, ['evo_chat_staff'], colegioId);
      const colegas = await Promise.all(staffAnnouncements.map((a) => buildThreadFromAnnouncement(a)));
      const directAnnouncements = await findAnnouncementsByRecipient(userId, ['evo_chat_direct'], colegioId);
      const directos = await Promise.all(directAnnouncements.map((a) => buildThreadFromAnnouncement(a)));
      const supportAnn = await findSupportThreadByInstitution(colegioId);
      const support_thread =
        supportAnn != null
          ? { ...(await buildThreadFromAnnouncement(supportAnn)), is_support: true as const }
          : null;
      return res.json({ colegas, directos, support_thread });
    }

    if (rol === 'estudiante' && userId) {
      const enrollments = await findEnrollmentsByStudent(userId);
      const allGsWithDetails: Array<{
        id: string;
        group_id: string;
        group_name: string;
        subject_name: string;
        teacher_name: string;
        teacher_id: string;
        institution_id: string;
      }> = [];
      for (const e of enrollments) {
        const list = await findGroupSubjectsByGroupWithDetails(e.group_id, colegioId);
        allGsWithDetails.push(...list);
      }
      const threads = await Promise.all(
        allGsWithDetails.map(async (gs) => {
          const displayTitle = `${gs.subject_name} - ${gs.teacher_name}`;
          const a = await findOrCreateEvoChatForGroupSubject(
            gs.id,
            colegioId,
            displayTitle,
            gs.teacher_id,
            gs.group_id
          );
          const t = await buildThreadFromAnnouncement(a);
          return { ...t, displayTitle };
        })
      );
      return res.json(threads);
    }

    // Asistente: todos los hilos de la institución + Soporte GLC al tope
    if (rol === 'asistente') {
      const announcements = await findAnnouncementsByInstitution(colegioId, tipo ? { type: tipo } : undefined);
      const threads = await Promise.all(announcements.map((a) => buildThreadFromAnnouncement(a)));
      const supportAnn = await findSupportThreadByInstitution(colegioId);
      const support_thread =
        supportAnn != null
          ? { ...(await buildThreadFromAnnouncement(supportAnn)), is_support: true as const }
          : null;
      return res.json({ threads, support_thread });
    }

    // Admin general colegio: Chats GLC (por categoría) + Soporte (solo hilos evo_chat_support que ya tienen mensajes — bandeja limpia al inicio)
    if (rol === 'admin-general-colegio' && userId) {
      const allAnnouncements = await findAnnouncementsByInstitution(colegioId, tipo ? { type: tipo } : undefined);
      const evoChat: Awaited<ReturnType<typeof buildThreadFromAnnouncement>>[] = [];
      const evoChatStaff: Awaited<ReturnType<typeof buildThreadFromAnnouncement>>[] = [];
      const evoChatDirect: Awaited<ReturnType<typeof buildThreadFromAnnouncement>>[] = [];
      for (const a of allAnnouncements) {
        if (a.type === 'evo_chat_support') continue;
        const t = await buildThreadFromAnnouncement(a);
        if (a.type === 'evo_chat') evoChat.push(t);
        else if (a.type === 'evo_chat_staff') evoChatStaff.push(t);
        else if (a.type === 'evo_chat_direct') evoChatDirect.push(t);
      }
      const supportAnnouncements = await findAnnouncementsByRecipient(userId, ['evo_chat_support'], colegioId);
      const soporteWithMessages: Awaited<ReturnType<typeof buildThreadFromAnnouncement>>[] = [];
      for (const a of supportAnnouncements) {
        const hasMessage = await getLastAnnouncementMessage(a.id);
        if (hasMessage) soporteWithMessages.push(await buildThreadFromAnnouncement(a));
      }
      return res.json({
        chats_glc: { evo_chat: evoChat, evo_chat_staff: evoChatStaff, evo_chat_direct: evoChatDirect },
        soporte: soporteWithMessages,
      });
    }

    return res.status(403).json({ message: 'Rol no autorizado para Evo Send.' });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar hilos.' });
  }
});

// GET /api/evo-send/thread-id-by-group-subject/:groupSubjectId — devuelve el threadId del chat Evo Send para ese curso (atajo desde página del curso)
router.get('/thread-id-by-group-subject/:groupSubjectId', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const { groupSubjectId } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    if (!userId || !colegioId || !groupSubjectId) return res.status(401).json({ message: 'No autorizado.' });

    const gs = await findGroupSubjectById(groupSubjectId);
    if (!gs || gs.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Curso no encontrado.' });
    }

    if (rol === 'profesor' && gs.teacher_id !== userId) {
      return res.status(403).json({ message: 'Solo el profesor del curso puede acceder.' });
    }
    if (rol === 'estudiante') {
      const enrollments = await findEnrollmentsByStudent(userId);
      const inGroup = enrollments.some((e) => e.group_id === gs.group_id);
      if (!inGroup) return res.status(403).json({ message: 'No tienes acceso a este curso.' });
    }

    const group = await findGroupById(gs.group_id);
    const title = group?.name ?? gs.group_id;
    const a = await findOrCreateEvoChatForGroupSubject(
      gs.id,
      colegioId,
      title,
      gs.teacher_id,
      gs.group_id
    );
    return res.json({ threadId: a.id });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener el hilo.' });
  }
});

router.get('/threads/:id', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    // En evoSend, cualquier lectura de hilos requiere identidad de usuario estable.
    // No se debe "saltar" validaciones por un userId faltante.
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const a = await findAnnouncementById(id);
    if (!a || a.institution_id !== colegioId) {
      return res.json({ thread: null, messages: [] });
    }
    if (a.type === 'evo_chat_staff' || a.type === 'evo_chat_direct') {
      const allowed = await isUserRecipientOfAnnouncement(id, userId);
      if (!allowed) return res.json({ thread: null, messages: [] });
    } else if (a.type === 'evo_chat_support') {
      const userRol = req.user?.rol ?? '';
      const canOpenSupport = ['profesor', 'directivo', 'asistente', 'admin-general-colegio'].includes(userRol);
      if (!canOpenSupport) {
        const isRecipient = await isUserRecipientOfAnnouncement(id, userId);
        if (!isRecipient) return res.json({ thread: null, messages: [] });
      }
    }

    const creator = await findUserById(a.created_by_id);
    let cursoId: { _id: string; nombre: string } | undefined;
    if (a.group_id) {
      const g = await findGroupById(a.group_id);
      if (g) cursoId = { _id: g.id, nombre: g.name };
    }
    let assignmentId: { _id: string; titulo: string; descripcion?: string; fechaEntrega: string } | undefined;
    if (a.assignment_id) {
      const asn = await findAssignmentById(a.assignment_id);
      if (asn) assignmentId = { _id: asn.id, titulo: asn.title, descripcion: asn.description ?? undefined, fechaEntrega: asn.due_date };
    }

    const thread = {
      _id: a.id,
      asunto: a.title,
      tipo: a.type,
      creadoPor: creator ? { _id: creator.id, nombre: creator.full_name, rol: creator.role } : undefined,
      cursoId,
      assignmentId,
      updatedAt: a.updated_at,
    };

    const msgRows = await findAnnouncementMessages(id);
    const senderIdMap: Record<string, true> = {};
    for (const m of msgRows) senderIdMap[m.sender_id] = true;
    const senderIds = Object.keys(senderIdMap);
    const senders = await findUsersByIds(senderIds);
    const senderMap = new Map(senders.map((u) => [u.id, u]));
    const messages = msgRows.map((m) => {
      const sender = senderMap.get(m.sender_id);
      return {
        _id: m.id,
        contenido: m.content,
        tipo: m.content_type,
        prioridad: m.priority,
        fecha: m.created_at,
        remitenteId: { _id: m.sender_id, nombre: sender?.full_name ?? '', rol: sender?.role },
        rolRemitente: m.sender_role,
      };
    });

    return res.json({ thread, messages });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener hilo.' });
  }
});

router.post('/threads', protect, requireRole('directivo', 'profesor', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const { asunto, contenido, tipo, cursoId, prioridad } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!asunto?.trim() || !contenido?.trim()) {
      return res.status(400).json({ message: 'Faltan asunto o contenido.' });
    }

    const a = await createAnnouncement({
      institution_id: colegioId,
      title: asunto.trim(),
      body: contenido.trim(),
      type: tipo ?? 'general',
      group_id: cursoId ?? null,
      created_by_id: userId,
    });

    await createAnnouncementMessage({
      announcement_id: a.id,
      sender_id: userId,
      sender_role: req.user?.rol ?? 'profesor',
      content: contenido.trim(),
      priority: prioridad ?? 'normal',
    });

    return res.status(201).json({ _id: a.id, message: 'Hilo creado.' });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear hilo.' });
  }
});

router.post('/threads/:id/messages', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { contenido, prioridad } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const a = await findAnnouncementById(id);
    if (!a || a.institution_id !== colegioId) return res.status(404).json({ message: 'Hilo no encontrado.' });
    if (a.type === 'evo_chat_staff' || a.type === 'evo_chat_direct') {
      const allowed = await isUserRecipientOfAnnouncement(id, userId);
      if (!allowed) return res.status(403).json({ message: 'No tienes acceso a este hilo.' });
    } else if (a.type === 'evo_chat_support') {
      const rol = req.user?.rol ?? '';
      const canWrite = ['profesor', 'directivo', 'asistente', 'admin-general-colegio'].includes(rol);
      if (!canWrite) return res.status(403).json({ message: 'No tienes acceso a este hilo.' });
      const isRecipient = await isUserRecipientOfAnnouncement(id, userId);
      if (!isRecipient) await addAnnouncementRecipients(id, [userId]);
    }

    const msg = await createAnnouncementMessage({
      announcement_id: id,
      sender_id: userId,
      sender_role: req.user?.rol ?? 'estudiante',
      content: (contenido ?? '').trim() || '(mensaje vacío)',
      priority: prioridad ?? 'normal',
    });

    // Notificaciones: cualquier mensaje entrante de EvoSend se refleja en la campana.
    // (unifica "tarea/comunicado/etc." cuando esas features creen filas en `notifications`)
    const recipientIds = await resolveRecipientsForThread({
      announcement: { id: a.id, type: a.type, group_id: a.group_id, group_subject_id: a.group_subject_id, created_by_id: a.created_by_id },
      institutionId: colegioId,
    });
    const recipientsWithoutSender = recipientIds.filter((rid) => rid !== userId);
    await Promise.all(
      recipientsWithoutSender.map((rid) =>
        createNotification({
          institution_id: colegioId,
          user_id: rid,
          title: `EvoSend · ${a.title}`,
          body: truncateText((contenido ?? '').trim() || '(mensaje vacío)'),
        })
      )
    );

    const sender = await findUserById(userId);
    emitEvoMessage(id, {
      threadId: id,
      _id: msg.id,
      contenido: msg.content,
      prioridad: msg.priority,
      fecha: msg.created_at,
      remitenteId: { _id: userId, nombre: sender?.full_name ?? '', rol: sender?.role },
      rolRemitente: msg.sender_role,
    });

    return res.status(201).json({ _id: msg.id });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al enviar mensaje.' });
  }
});

router.patch('/threads/:id/read', protect, requireRole(...EVO_SEND_ROLES), async (_req: AuthRequest, res) => {
  return res.json({ success: true });
});

router.get('/search', protect, requireRole(...EVO_SEND_ROLES), async (_req: AuthRequest, res) => {
  return res.json([]);
});

router.get('/attendance-inbox', protect, requireRole('asistente'), async (_req: AuthRequest, res) => {
  return res.json([]);
});

router.get('/courses', protect, requireRole('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const user = await findUserById(userId);
    if (!user) return res.json([]);

    const groups = await findGroupsByInstitution(colegioId);
    if (user.role === 'profesor') {
      const gsList = await findGroupSubjectsByTeacher(userId);
      const groupIds = new Set(gsList.map((gs) => gs.group_id));
      const courses = groups.filter((g) => groupIds.has(g.id)).map((g) => ({ _id: g.id, nombre: g.name }));
      return res.json(courses);
    }
    return res.json(groups.map((g) => ({ _id: g.id, nombre: g.name })));
  } catch (e: unknown) {
    console.error(e);
    return res.json([]);
  }
});

export default router;
