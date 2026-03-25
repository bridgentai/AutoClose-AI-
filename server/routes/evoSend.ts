import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { queryPg } from '../config/db-pg.js';
import {
  type AnnouncementRow,
  findAnnouncementsByInstitution,
  findAnnouncementById,
  findAnnouncementMessages,
  createAnnouncement,
  createAnnouncementMessage,
  getLastAnnouncementMessage,
  findOrCreateEvoChatForGroupTeacher,
  findAnnouncementsByRecipient,
  isUserRecipientOfAnnouncement,
  findOrCreateSupportThreadOneToOne,
  findDirectThreadBetweenUsers,
  addAnnouncementRecipients,
  countUnreadByThreadIds,
  markEvoThreadRead,
} from '../repositories/announcementRepository.js';
import { findUserById, findUsersByIds, findUsersByInstitutionAndRoles } from '../repositories/userRepository.js';
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
import { emitEvoMessageBroadcast } from '../socket.js';
import {
  getEvoSendStudentChatTimezone,
  isWithinStudentEvoSendWriteWindow,
  studentCanWriteEvoSendNow,
} from '../services/evoSendStudentHours.js';

const router = express.Router();
// Evo Send accesible para todos los roles autenticados (filtrado por permisos por hilo).
const EVO_SEND_ROLES = [
  'estudiante',
  'profesor',
  'directivo',
  'padre',
  'administrador-general',
  'admin-general-colegio',
  'transporte',
  'tesoreria',
  'nutricion',
  'cafeteria',
  'asistente',
  'school_admin',
  'super_admin',
];

const DIRECTIVO_FULL_INBOX_ROLES = ['directivo', 'school_admin'] as const;

/**
 * Verifica si un adulto puede tener hilo directo con un estudiante.
 * Permitido solo si es su profesor directo o su padre/acudiente vinculado.
 */
async function canAdultMessageStudent(
  adultId: string,
  studentId: string,
  institutionId: string
): Promise<boolean> {
  const isTeacher = await queryPg<{ n: number }>(
    `SELECT 1 AS n
     FROM enrollments e
     JOIN group_subjects gs ON gs.group_id = e.group_id AND gs.institution_id = $3
     WHERE e.student_id = $1 AND gs.teacher_id = $2
     LIMIT 1`,
    [studentId, adultId, institutionId]
  );
  if (isTeacher.rows.length > 0) return true;

  const isParent = await queryPg<{ n: number }>(
    `SELECT 1 AS n FROM guardian_students
     WHERE guardian_id = $1 AND student_id = $2 AND institution_id = $3
     LIMIT 1`,
    [adultId, studentId, institutionId]
  );
  if (isParent.rows.length > 0) return true;

  return false;
}

/** Indica si el usuario tiene rol estudiante (menor en el modelo de permisos EvoSend). */
async function isMinor(userId: string): Promise<boolean> {
  const r = await queryPg<{ role: string }>(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId]);
  return r.rows[0]?.role === 'estudiante';
}

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
    } else {
      recipientMap[a.created_by_id] = true;
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

async function mergeUnreadIntoThreads<T extends { _id: string }>(
  items: T[],
  userId: string
): Promise<(T & { unreadCount: number })[]> {
  const ids = items.map((x) => x._id);
  const map = await countUnreadByThreadIds(ids, userId);
  return items.map((x) => ({ ...x, unreadCount: map[x._id] ?? 0 }));
}

async function buildSupportThreadForStaff(
  colegioId: string,
  staffUserId: string
): Promise<
  | (Awaited<ReturnType<typeof buildThreadFromAnnouncement>> & { is_support: true; displayTitle: string })
  | null
> {
  const admins = await findUsersByInstitutionAndRoles(colegioId, ['admin-general-colegio']);
  if (admins.length === 0) return null;
  const me = await findUserById(staffUserId);
  let ann: Awaited<ReturnType<typeof findOrCreateSupportThreadOneToOne>>;
  try {
    ann = await findOrCreateSupportThreadOneToOne(
      colegioId,
      staffUserId,
      me?.full_name || 'Usuario',
      admins.map((a) => a.id),
      admins[0].id
    );
  } catch {
    return null;
  }
  const t = await buildThreadFromAnnouncement(ann);
  const unc = await countUnreadByThreadIds([ann.id], staffUserId);
  return {
    ...t,
    displayTitle: 'Soporte GLC',
    is_support: true as const,
    unreadCount: unc[ann.id] ?? 0,
  };
}

/** Estado de horario para que estudiantes vean si pueden escribir en chats de grupo (Evo Send). */
router.get('/write-window', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  const rol = req.user?.rol;
  const timezone = getEvoSendStudentChatTimezone();
  if (rol !== 'estudiante') {
    return res.json({ restricted: false, allowed: true, timezone });
  }
  return res.json({
    restricted: true,
    allowed: isWithinStudentEvoSendWriteWindow(),
    timezone,
    windowStart: '07:00',
    windowEnd: '18:59',
  });
});

router.get('/threads', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const tipo = req.query.tipo as string | undefined;

    // Profesor: un chat por curso (grupo), aunque dicte varias materias + colegas + Soporte 1-1
    if (rol === 'profesor' && userId) {
      const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
      const byGroup = new Map<string, (typeof gsList)[0]>();
      for (const gs of gsList) {
        if (!byGroup.has(gs.group_id)) byGroup.set(gs.group_id, gs);
      }
      const misCursosRaw = await Promise.all(
        [...byGroup.values()].map(async (gs) => {
          const a = await findOrCreateEvoChatForGroupTeacher(
            gs.group_id,
            colegioId,
            gs.group_name,
            userId
          );
          const t = await buildThreadFromAnnouncement(a);
          return { ...t, displayTitle: gs.group_name };
        })
      );
      const staffAnnouncements = await findAnnouncementsByRecipient(userId, ['evo_chat_staff'], colegioId);
      const colegasRaw = await Promise.all(staffAnnouncements.map((a) => buildThreadFromAnnouncement(a)));
      const [misCursos, colegas] = await Promise.all([
        mergeUnreadIntoThreads(misCursosRaw, userId),
        mergeUnreadIntoThreads(colegasRaw, userId),
      ]);
      const support_thread = await buildSupportThreadForStaff(colegioId, userId);
      return res.json({ mis_cursos: misCursos, colegas, support_thread });
    }

    // Directivo / school_admin: todos los cursos + staff + directos de la institución; soporte 1-1 solo el propio
    if (rol && DIRECTIVO_FULL_INBOX_ROLES.includes(rol as (typeof DIRECTIVO_FULL_INBOX_ROLES)[number]) && userId) {
      const [cursoRes, staffRes, directRes] = await Promise.all([
        queryPg<AnnouncementRow>(
          `SELECT * FROM announcements a
           WHERE a.institution_id = $1 AND a.type = 'evo_chat'
           ORDER BY a.updated_at DESC`,
          [colegioId]
        ),
        queryPg<AnnouncementRow>(
          `SELECT * FROM announcements a
           WHERE a.institution_id = $1 AND a.type = 'evo_chat_staff'
           ORDER BY a.updated_at DESC`,
          [colegioId]
        ),
        queryPg<AnnouncementRow>(
          `SELECT * FROM announcements a
           WHERE a.institution_id = $1 AND a.type = 'evo_chat_direct'
           ORDER BY a.updated_at DESC`,
          [colegioId]
        ),
      ]);
      const [misCursosRaw, colegasRaw, directosRaw] = await Promise.all([
        Promise.all(cursoRes.rows.map((a: AnnouncementRow) => buildThreadFromAnnouncement(a))),
        Promise.all(staffRes.rows.map((a: AnnouncementRow) => buildThreadFromAnnouncement(a))),
        Promise.all(directRes.rows.map((a: AnnouncementRow) => buildThreadFromAnnouncement(a))),
      ]);
      const [mis_cursos, colegas, directos] = await Promise.all([
        mergeUnreadIntoThreads(misCursosRaw, userId),
        mergeUnreadIntoThreads(colegasRaw, userId),
        mergeUnreadIntoThreads(directosRaw, userId),
      ]);
      const support_thread = await buildSupportThreadForStaff(colegioId, userId);
      return res.json({ mis_cursos, colegas, directos, support_thread });
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
      /** Un hilo Evo Send por (grupo + profesor); varias materias del mismo par comparten hilo — el título muestra las materias, no el nombre del profesor. */
      const byGroupTeacher = new Map<string, typeof allGsWithDetails>();
      for (const gs of allGsWithDetails) {
        const k = `${gs.group_id}:${gs.teacher_id}`;
        if (!byGroupTeacher.has(k)) byGroupTeacher.set(k, []);
        byGroupTeacher.get(k)!.push(gs);
      }
      const threadsRaw = await Promise.all(
        [...byGroupTeacher.values()].map(async (rows) => {
          const gs = rows[0];
          const a = await findOrCreateEvoChatForGroupTeacher(
            gs.group_id,
            colegioId,
            gs.group_name,
            gs.teacher_id
          );
          const t = await buildThreadFromAnnouncement(a);
          const subjectLabels = [
            ...new Set(rows.map((r) => (r.subject_name ?? '').trim()).filter((s) => s.length > 0)),
          ];
          /** Título del chat = materia (display_name o nombre de asignatura), no el nombre del profesor. */
          const displayTitle = subjectLabels.length ? subjectLabels.join(', ') : gs.group_name;
          return { ...t, displayTitle };
        })
      );
      const threads = userId ? await mergeUnreadIntoThreads(threadsRaw, userId) : threadsRaw;
      return res.json(threads);
    }

    // Asistente: todos los hilos + Soporte 1-1 con GLC
    if (rol === 'asistente' && userId) {
      const announcements = (await findAnnouncementsByInstitution(colegioId, tipo ? { type: tipo } : undefined)).filter(
        (a) => !(a.type === 'evo_chat' && a.group_subject_id != null)
      );
      const threadsRaw = await Promise.all(announcements.map((a) => buildThreadFromAnnouncement(a)));
      const threads = await mergeUnreadIntoThreads(threadsRaw, userId);
      const support_thread = await buildSupportThreadForStaff(colegioId, userId);
      return res.json({ threads, support_thread });
    }

    // Admin GLC: Chats por categoría + Soporte 1-1 (un hilo por profesor/directivo/asistente con mensajes)
    if (rol === 'admin-general-colegio' && userId) {
      const allAnnouncements = await findAnnouncementsByInstitution(colegioId, tipo ? { type: tipo } : undefined);
      const evoChatRaw: Awaited<ReturnType<typeof buildThreadFromAnnouncement>>[] = [];
      const evoChatStaffRaw: Awaited<ReturnType<typeof buildThreadFromAnnouncement>>[] = [];
      const evoChatDirectRaw: Awaited<ReturnType<typeof buildThreadFromAnnouncement>>[] = [];
      for (const a of allAnnouncements) {
        if (a.type === 'evo_chat_support') continue;
        if (a.type === 'evo_chat' && a.group_subject_id != null) continue;
        const t = await buildThreadFromAnnouncement(a);
        if (a.type === 'evo_chat') evoChatRaw.push(t);
        else if (a.type === 'evo_chat_staff') evoChatStaffRaw.push(t);
        else if (a.type === 'evo_chat_direct') evoChatDirectRaw.push(t);
      }
      const [evoChat, evoChatStaff, evoChatDirect] = await Promise.all([
        mergeUnreadIntoThreads(evoChatRaw, userId),
        mergeUnreadIntoThreads(evoChatStaffRaw, userId),
        mergeUnreadIntoThreads(evoChatDirectRaw, userId),
      ]);
      const supportAnnouncements = await findAnnouncementsByRecipient(userId, ['evo_chat_support'], colegioId);
      const soporteRaw: Awaited<ReturnType<typeof buildThreadFromAnnouncement>>[] = [];
      for (const a of supportAnnouncements) {
        if (!a.support_staff_id) continue;
        const hasMessage = await getLastAnnouncementMessage(a.id);
        if (!hasMessage) continue;
        const staff = a.support_staff_id ? await findUserById(a.support_staff_id) : null;
        const t = await buildThreadFromAnnouncement(a);
        soporteRaw.push({
          ...t,
          displayTitle: staff ? `Soporte · ${staff.full_name}` : t.asunto,
        });
      }
      const soporte = await mergeUnreadIntoThreads(soporteRaw, userId);
      return res.json({
        chats_glc: { evo_chat: evoChat, evo_chat_staff: evoChatStaff, evo_chat_direct: evoChatDirect },
        soporte,
      });
    }

    // Otros roles autenticados: acceso a Evo Send, pero por defecto sin hilos.
    // (Si en el futuro se define inbox por rol, se puede expandir aquí.)
    return res.json([]);
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
    const a = await findOrCreateEvoChatForGroupTeacher(gs.group_id, colegioId, title, gs.teacher_id);
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

    const rol = req.user?.rol;
    const a = await findAnnouncementById(id);
    if (!a || a.institution_id !== colegioId) {
      return res.json({ thread: null, messages: [] });
    }
    const directorReadAll =
      !!rol &&
      DIRECTIVO_FULL_INBOX_ROLES.includes(rol as (typeof DIRECTIVO_FULL_INBOX_ROLES)[number]) &&
      (a.type === 'evo_chat' || a.type === 'evo_chat_staff' || a.type === 'evo_chat_direct');

    if (a.type === 'evo_chat' && !directorReadAll) {
      const allowedIds = await resolveRecipientsForThread({
        announcement: { id: a.id, type: a.type, group_id: a.group_id, group_subject_id: a.group_subject_id, created_by_id: a.created_by_id },
        institutionId: colegioId,
      });
      if (!allowedIds.includes(userId)) return res.json({ thread: null, messages: [] });
    }
    if ((a.type === 'evo_chat_staff' || a.type === 'evo_chat_direct') && !directorReadAll) {
      const allowed = await isUserRecipientOfAnnouncement(id, userId);
      if (!allowed) return res.json({ thread: null, messages: [] });
    } else if (a.type === 'evo_chat_support') {
      const allowed = await isUserRecipientOfAnnouncement(id, userId);
      if (!allowed) return res.json({ thread: null, messages: [] });
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

router.post('/threads', protect, requireRole('directivo', 'profesor', 'admin-general-colegio', 'school_admin'), async (req: AuthRequest, res) => {
  try {
    const { asunto, contenido, tipo, cursoId, prioridad, targetUserId: bodyTargetId, recipientId } = req.body as {
      asunto?: string;
      contenido?: string;
      tipo?: string;
      cursoId?: string | null;
      prioridad?: string;
      targetUserId?: string;
      recipientId?: string;
    };
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!asunto?.trim() || !contenido?.trim()) {
      return res.status(400).json({ message: 'Faltan asunto o contenido.' });
    }

    const effectiveTipo = (tipo ?? 'general').trim();
    const targetUserId = (bodyTargetId ?? recipientId ?? '').trim() || undefined;

    if (effectiveTipo === 'evo_chat_direct' && !targetUserId) {
      return res.status(400).json({ message: 'Para un chat directo se requiere destinatario (targetUserId o recipientId).' });
    }

    if (targetUserId) {
      if (targetUserId === userId) {
        return res.status(400).json({ message: 'No puedes crear un hilo contigo mismo como único participante.' });
      }
      const targetUser = await findUserById(targetUserId);
      if (!targetUser || targetUser.institution_id !== colegioId) {
        return res.status(404).json({ message: 'Usuario destinatario no encontrado en esta institución.' });
      }

      const targetIsMinor = await isMinor(targetUserId);
      const senderIsMinor = await isMinor(userId);

      if (targetIsMinor && !senderIsMinor) {
        const allowed = await canAdultMessageStudent(userId, targetUserId, colegioId);
        if (!allowed) {
          return res.status(403).json({
            message:
              'No puedes iniciar un chat directo con este estudiante. Solo su profesor directo o acudiente puede hacerlo.',
          });
        }
      }

      if (senderIsMinor && !targetIsMinor) {
        const allowed = await canAdultMessageStudent(targetUserId, userId, colegioId);
        if (!allowed) {
          return res.status(403).json({
            message: 'No puedes iniciar un chat directo con este usuario.',
          });
        }
      }
    }

    if (effectiveTipo === 'evo_chat_direct' && targetUserId) {
      const existing = await findDirectThreadBetweenUsers(userId, targetUserId, colegioId);
      if (existing) {
        return res.status(200).json({ _id: existing.id, message: 'Hilo directo ya existía.', existing: true });
      }
    }

    const a = await createAnnouncement({
      institution_id: colegioId,
      title: asunto.trim(),
      body: contenido.trim(),
      type: effectiveTipo,
      group_id: cursoId ?? null,
      created_by_id: userId,
    });

    if (effectiveTipo === 'evo_chat_direct' && targetUserId) {
      await addAnnouncementRecipients(a.id, [userId, targetUserId]);
    }

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
    const { contenido, prioridad, contentType, meta } = req.body as {
      contenido?: string;
      prioridad?: string;
      contentType?: string;
      meta?: unknown;
    };
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const a = await findAnnouncementById(id);
    if (!a || a.institution_id !== colegioId) return res.status(404).json({ message: 'Hilo no encontrado.' });
    if (a.type === 'evo_chat') {
      const allowedIds = await resolveRecipientsForThread({
        announcement: { id: a.id, type: a.type, group_id: a.group_id, group_subject_id: a.group_subject_id, created_by_id: a.created_by_id },
        institutionId: colegioId,
      });
      if (!allowedIds.includes(userId)) return res.status(403).json({ message: 'No tienes acceso a este hilo.' });
    }
    if (a.type === 'evo_chat_staff' || a.type === 'evo_chat_direct') {
      const allowed = await isUserRecipientOfAnnouncement(id, userId);
      if (!allowed) return res.status(403).json({ message: 'No tienes acceso a este hilo.' });
    } else if (a.type === 'evo_chat_support') {
      const allowed = await isUserRecipientOfAnnouncement(id, userId);
      if (!allowed) return res.status(403).json({ message: 'No tienes acceso a este hilo.' });
    }

    if (!studentCanWriteEvoSendNow(req.user?.rol, a.type)) {
      return res.status(403).json({
        message:
          'En los chats de grupo solo puedes enviar mensajes entre las 7:00 y las 18:59 (hora local del colegio). Fuera de esa ventana no está permitido.',
        code: 'EVO_SEND_STUDENT_HOURS',
      });
    }

    const ct = typeof contentType === 'string' && contentType.trim() ? contentType.trim() : 'texto';
    const isStructured = ct === 'evo_drive' || ct === 'assignment_reminder';
    const safeText = (contenido ?? '').trim();
    const safeContent = isStructured ? JSON.stringify(meta ?? {}) : (safeText || '(mensaje vacío)');

    const msg = await createAnnouncementMessage({
      announcement_id: id,
      sender_id: userId,
      sender_role: req.user?.rol ?? 'estudiante',
      content: safeContent,
      content_type: ct,
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
          body: truncateText(isStructured ? `Adjunto: ${ct}` : (safeText || '(mensaje vacío)')),
        })
      )
    );

    const sender = await findUserById(userId);
    const participantIds = [...new Set([...recipientIds, userId])];
    emitEvoMessageBroadcast(
      id,
      {
        _id: msg.id,
        contenido: msg.content,
        tipo: msg.content_type,
        prioridad: msg.priority,
        fecha: msg.created_at,
        remitenteId: { _id: userId, nombre: sender?.full_name ?? '', rol: sender?.role },
        rolRemitente: msg.sender_role,
      },
      participantIds
    );

    return res.status(201).json({ _id: msg.id });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al enviar mensaje.' });
  }
});

router.patch('/threads/:id/read', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });
    await markEvoThreadRead(userId, id);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al marcar leído.' });
  }
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
