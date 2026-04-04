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
  findAnnouncementMessageById,
  isUserRecipientOfAnnouncement,
  findOrCreateSupportThreadOneToOne,
  findDirectThreadBetweenUsers,
  findOrCreateFamilyEvoThread,
  addAnnouncementRecipients,
  countUnreadByThreadIds,
  markEvoThreadRead,
} from '../repositories/announcementRepository.js';
import { findUserById, findUsersByIds, findUsersByInstitutionAndRoles } from '../repositories/userRepository.js';
import { findGroupById } from '../repositories/groupRepository.js';
import { findAssignmentById } from '../repositories/assignmentRepository.js';
import { notify } from '../repositories/notificationRepository.js';
import {
  findGroupSubjectsByTeacher,
  findGroupSubjectsByTeacherWithDetails,
  findGroupSubjectsByGroupWithDetails,
  findGroupSubjectById,
} from '../repositories/groupSubjectRepository.js';
import { findGroupsByInstitution } from '../repositories/groupRepository.js';
import { findSectionById, findSectionsByInstitution } from '../repositories/sectionRepository.js';
import { findEnrollmentsByStudent } from '../repositories/enrollmentRepository.js';
import { findGuardianStudentsByGuardian } from '../repositories/guardianStudentRepository.js';
import { emitEvoMessageBroadcast } from '../socket.js';
import {
  getEvoSendStudentChatTimezone,
  isWithinStudentEvoSendWriteWindow,
  studentCanWriteEvoSendNow,
} from '../services/evoSendStudentHours.js';
import {
  ensureDirectThreadsForSectionLead,
  ensureStaffGroupsForInstitution,
  evoSendProfesoresHighschoolTitle,
  EVO_SEND_STAFF_GLC_TITLE,
} from '../services/evoSendBootstrap.js';
import {
  canAccessEvoThread,
  DIRECTIVO_FULL_INBOX_ROLES,
  getThreadCategoryByType,
  resolveRecipientsForThread,
} from '../services/evoSendAccess.js';
import {
  getMessageUserFlagsMap,
  setMessageTrashed,
  setMessageStarred,
  listInstitutionalFolderCandidates,
} from '../repositories/evoSendMessageUserStateRepository.js';

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
  'asistente-academica',
  'school_admin',
  'super_admin',
];

/**
 * Verifica si un adulto puede tener hilo directo con un estudiante.
 * Permitido si es su profesor directo, acudiente vinculado, o director de sección del grupo del estudiante.
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

  const isSectionDirector = await queryPg<{ n: number }>(
    `SELECT 1 AS n
     FROM enrollments e
     JOIN groups g ON g.id = e.group_id AND g.institution_id = $3
     JOIN users dir ON dir.id = $2 AND dir.institution_id = $3
     WHERE e.student_id = $1
       AND dir.role = 'directivo'
       AND dir.section_id IS NOT NULL
       AND dir.section_id = g.section_id
     LIMIT 1`,
    [studentId, adultId, institutionId]
  );
  return isSectionDirector.rows.length > 0;
}

/** Acudiente solo con directivo de sección donde cursa algún hijo vinculado. */
async function canPadreMessageDirectivo(
  padreId: string,
  directivoId: string,
  institutionId: string
): Promise<boolean> {
  const dir = await findUserById(directivoId);
  if (!dir || dir.institution_id !== institutionId) return false;
  if (dir.role !== 'directivo' || !dir.section_id) return true;

  const r = await queryPg<{ n: number }>(
    `SELECT 1 AS n
     FROM guardian_students gs
     JOIN enrollments e ON e.student_id = gs.student_id
     JOIN groups g ON g.id = e.group_id AND g.institution_id = gs.institution_id
     WHERE gs.guardian_id = $1 AND gs.institution_id = $2 AND g.section_id = $3
     LIMIT 1`,
    [padreId, institutionId, dir.section_id]
  );
  return r.rows.length > 0;
}

/** Directivo de sección solo con acudiente que tenga hijo en esa sección. */
async function canDirectivoMessagePadre(
  directivoId: string,
  padreId: string,
  institutionId: string
): Promise<boolean> {
  const dir = await findUserById(directivoId);
  if (!dir || dir.institution_id !== institutionId) return false;
  if (dir.role !== 'directivo' || !dir.section_id) return true;

  const r = await queryPg<{ n: number }>(
    `SELECT 1 AS n
     FROM guardian_students gs
     JOIN enrollments e ON e.student_id = gs.student_id
     JOIN groups g ON g.id = e.group_id AND g.institution_id = gs.institution_id
     WHERE gs.guardian_id = $1 AND gs.institution_id = $2 AND g.section_id = $3
     LIMIT 1`,
    [padreId, institutionId, dir.section_id]
  );
  return r.rows.length > 0;
}

/** Indica si el usuario tiene rol estudiante (menor en el modelo de permisos EvoSend). */
async function isMinor(userId: string): Promise<boolean> {
  const r = await queryPg<{ role: string }>(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId]);
  return r.rows[0]?.role === 'estudiante';
}

function truncateText(s: string, max = 240) {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(0, max - 1))}…`;
}

async function getUserEmail(userId: string): Promise<string | undefined> {
  try {
    const r = await queryPg<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
    const email = r.rows[0]?.email;
    return typeof email === 'string' && email.trim() ? email.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Roles de contacto institucional: hilos 1:1 con ellos van a la bandeja Institucional. */
const INSTITUTIONAL_COUNTERPART_ROLES = new Set([
  'directivo',
  'asistente-academica',
  'school_admin',
  'admin-general-colegio',
  'rector',
  'asistente',
]);

async function computeInboxCategory(
  a: Pick<AnnouncementRow, 'id' | 'type'>,
  _viewerUserId: string | undefined
): Promise<'academico' | 'institucional'> {
  if (a.type === 'comunicado_institucional') return 'institucional';
  /** Soporte admin: bandeja Institucional. Chats de staff (Highschool / GLC) van en Académico con el resto de EvoSend docente. */
  if (a.type === 'evo_chat_support') return 'institucional';
  if (a.type === 'evo_chat_direct') {
    const r = await queryPg<{ user_id: string }>(
      'SELECT user_id FROM announcement_recipients WHERE announcement_id = $1',
      [a.id]
    );
    const ids = r.rows.map((x: { user_id: string }) => x.user_id);
    if (ids.length !== 2) return 'academico';
    const users = await findUsersByIds(ids);
    if (users.length !== 2) return 'academico';
    const roles = users.map((u) => u.role);
    /** Colegas profesor ↔ profesor: solo Académico (bandeja Institucional / GLC no aplica). */
    if (roles.every((role) => role === 'profesor')) return 'academico';
    /**
     * Directivo o asistente académica con docente de la sección: coordinación académica
     * (debe verse en pestaña Académico junto a cursos / curso–director).
     */
    const hasProfesor = roles.some((role) => role === 'profesor');
    const hasSectionAcademicLead = roles.some((role) => role === 'directivo' || role === 'asistente-academica');
    if (hasProfesor && hasSectionAcademicLead) return 'academico';
    if (roles.some((role) => role === 'estudiante' || role === 'padre')) return 'institucional';
    if (roles.some((role) => INSTITUTIONAL_COUNTERPART_ROLES.has(role))) return 'institucional';
    return 'academico';
  }
  return getThreadCategoryByType(a.type) === 'institucional' ? 'institucional' : 'academico';
}

async function assertMessageMailboxFlagAllowed(
  messageId: string,
  userId: string,
  colegioId: string,
  rol: string | undefined
): Promise<
  | { ok: true; announcement: AnnouncementRow }
  | { ok: false; status: number; message: string }
> {
  const message = await findAnnouncementMessageById(messageId);
  if (!message) return { ok: false, status: 404, message: 'Mensaje no encontrado.' };
  const a = await findAnnouncementById(message.announcement_id);
  if (!a || a.institution_id !== colegioId) return { ok: false, status: 404, message: 'No encontrado.' };
  if (a.type !== 'evo_chat_direct') return { ok: false, status: 403, message: 'Solo mensajes 1:1 directos.' };
  const rc = await queryPg<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM announcement_recipients WHERE announcement_id = $1`,
    [a.id]
  );
  if (rc.rows[0]?.c !== 2) return { ok: false, status: 403, message: 'Hilo no válido.' };

  const directorReadAll =
    !!rol &&
    DIRECTIVO_FULL_INBOX_ROLES.includes(rol as (typeof DIRECTIVO_FULL_INBOX_ROLES)[number]) &&
    (a.type === 'evo_chat' ||
      a.type === 'evo_chat_staff' ||
      a.type === 'evo_chat_direct' ||
      a.type === 'evo_chat_section_director');

  if (!directorReadAll) {
    const allowed = await isUserRecipientOfAnnouncement(a.id, userId);
    if (!allowed) return { ok: false, status: 403, message: 'Sin acceso a este hilo.' };
  }

  const cat = await computeInboxCategory({ id: a.id, type: a.type }, userId);
  if (cat !== 'institucional') return { ok: false, status: 403, message: 'Solo bandeja institucional (no chat académico entre colegas).' };
  return { ok: true, announcement: a };
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
  const titleForUi =
    a.type === 'evo_chat_section_director'
      ? a.title.replace(/\s*·\s*Director\s*$/i, '').trim() || a.title
      : a.title;
  return {
    _id: a.id,
    asunto: titleForUi,
    displayTitle: titleForUi,
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

async function buildThreadFromAnnouncementForViewer(
  a: AnnouncementRow,
  viewerUserId: string | undefined
): Promise<Awaited<ReturnType<typeof buildThreadFromAnnouncement>> & { inbox_category: 'academico' | 'institucional' }> {
  const base = await buildThreadFromAnnouncement(a);
  const inbox_category = await computeInboxCategory(a, viewerUserId);
  return { ...base, inbox_category };
}

function threadCategoryForUnread(t: unknown): 'academico' | 'institucional' {
  const o = t as { tipo?: string; inbox_category?: 'academico' | 'institucional' };
  if (o.inbox_category) return o.inbox_category;
  return getThreadCategoryByType(o.tipo ?? 'general');
}

async function mergeUnreadIntoThreads<T extends { _id: string }>(
  items: T[],
  userId: string
): Promise<(T & { unreadCount: number })[]> {
  const ids = items.map((x) => x._id);
  const map = await countUnreadByThreadIds(ids, userId);
  return items.map((x) => ({ ...x, unreadCount: map[x._id] ?? 0 }));
}

/** Los chats curso–director creados por bootstrap a veces no tenían filas en announcement_recipients. */
async function ensureEvoChatSectionDirectorRecipients(
  rows: AnnouncementRow[],
  institutionId: string
): Promise<void> {
  for (const a of rows) {
    if (a.type !== 'evo_chat_section_director' || !a.group_id) continue;
    const c = await queryPg<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM announcement_recipients WHERE announcement_id = $1`,
      [a.id]
    );
    if ((c.rows[0]?.n ?? 0) > 0) continue;
    const ids = await resolveRecipientsForThread({
      announcement: {
        id: a.id,
        type: a.type,
        group_id: a.group_id,
        group_subject_id: a.group_subject_id,
        created_by_id: a.created_by_id,
      },
      institutionId,
    });
    if (ids.length) await addAnnouncementRecipients(a.id, ids);
  }
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
  const t = await buildThreadFromAnnouncementForViewer(ann, staffUserId);
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
          const t = await buildThreadFromAnnouncementForViewer(a, userId);
          return { ...t, displayTitle: gs.group_name };
        })
      );
      const staffAnnouncements = await findAnnouncementsByRecipient(userId, ['evo_chat_staff'], colegioId);
      const colegasRaw = await Promise.all(
        staffAnnouncements.map((a) => buildThreadFromAnnouncementForViewer(a, userId))
      );
      const directProfRes = await queryPg<AnnouncementRow>(
        `SELECT a.* FROM announcements a
         INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2
         WHERE a.institution_id = $1 AND a.type = 'evo_chat_direct'
         ORDER BY a.updated_at DESC`,
        [colegioId, userId]
      );
      const directosRaw = await Promise.all(
        directProfRes.rows.map((a: AnnouncementRow) => buildThreadFromAnnouncementForViewer(a, userId))
      );
      const [misCursos, colegas, directos] = await Promise.all([
        mergeUnreadIntoThreads(misCursosRaw, userId),
        mergeUnreadIntoThreads(colegasRaw, userId),
        mergeUnreadIntoThreads(directosRaw, userId),
      ]);
      const support_thread = await buildSupportThreadForStaff(colegioId, userId);
      const allThreads = [...misCursos, ...colegas, ...directos, ...(support_thread ? [support_thread] : [])];
      const unreadByCategory = allThreads.reduce(
        (acc, t) => {
          const cat = threadCategoryForUnread(t);
          acc[cat] += t.unreadCount ?? 0;
          return acc;
        },
        { academico: 0, institucional: 0 }
      );
      return res.json({
        mis_cursos: misCursos,
        colegas,
        directos,
        support_thread,
        unread_by_category: unreadByCategory,
      });
    }

    // Directivo / asistente-academica: alcance por section_id cuando aplica. school_admin: institución completa.
    // Chats directos: solo hilos donde el usuario es participante.
    if (rol && DIRECTIVO_FULL_INBOX_ROLES.includes(rol as (typeof DIRECTIVO_FULL_INBOX_ROLES)[number]) && userId) {
      try {
        await ensureStaffGroupsForInstitution(colegioId);
      } catch (err) {
        console.warn('[evo-send] ensureStaffGroupsForInstitution:', err);
      }
      const viewer = await findUserById(userId);
      const narrowBySection =
        (rol === 'directivo' || rol === 'asistente-academica') && !!viewer?.section_id;
      const sectionId = narrowBySection ? viewer!.section_id! : null;
      const secMeta = sectionId ? await findSectionById(sectionId) : null;
      let staffHighschoolTitle: string | null = null;
      let staffLegacySectionTitle: string | null = null;
      if (sectionId && secMeta) {
        const sectionsCount = (await findSectionsByInstitution(colegioId)).length;
        staffHighschoolTitle = evoSendProfesoresHighschoolTitle(secMeta.name, sectionsCount);
        staffLegacySectionTitle = `Profesores · ${secMeta.name}`;
      }

      const cursoSql = sectionId
        ? `SELECT a.* FROM announcements a
           INNER JOIN groups g ON g.id = a.group_id AND g.institution_id = a.institution_id
           WHERE a.institution_id = $1 AND a.type = 'evo_chat' AND g.section_id = $2
           ORDER BY a.updated_at DESC`
        : `SELECT * FROM announcements a
           WHERE a.institution_id = $1 AND a.type = 'evo_chat'
           ORDER BY a.updated_at DESC`;
      const cursoParams = sectionId ? [colegioId, sectionId] : [colegioId];

      const dirChatSql = sectionId
        ? `SELECT a.* FROM announcements a
           INNER JOIN groups g ON g.id = a.group_id AND g.institution_id = a.institution_id
           WHERE a.institution_id = $1 AND a.type = 'evo_chat_section_director' AND g.section_id = $2
           ORDER BY a.updated_at DESC`
        : `SELECT * FROM announcements a
           WHERE a.institution_id = $1 AND a.type = 'evo_chat_section_director'
           ORDER BY a.updated_at DESC`;
      const dirChatParams = sectionId ? [colegioId, sectionId] : [colegioId];

      const staffSql =
        sectionId && staffHighschoolTitle && staffLegacySectionTitle
          ? `SELECT * FROM announcements a
             WHERE a.institution_id = $1 AND a.type = 'evo_chat_staff'
               AND (a.title = $2 OR a.title = $3 OR a.title = $4)
             ORDER BY a.updated_at DESC`
          : `SELECT * FROM announcements a
             WHERE a.institution_id = $1 AND a.type = 'evo_chat_staff'
             ORDER BY a.updated_at DESC`;
      const staffParams =
        sectionId && staffHighschoolTitle && staffLegacySectionTitle
          ? [colegioId, staffHighschoolTitle, staffLegacySectionTitle, EVO_SEND_STAFF_GLC_TITLE]
          : [colegioId];

      if (narrowBySection && sectionId && (rol === 'directivo' || rol === 'asistente-academica')) {
        try {
          await ensureDirectThreadsForSectionLead(colegioId, userId, sectionId);
        } catch (err) {
          console.warn('[evo-send] ensureDirectThreadsForSectionLead:', err);
        }
      }

      const [cursoRes, cursosDirectorRes, staffRes, directRes] = await Promise.all([
        queryPg<AnnouncementRow>(cursoSql, cursoParams),
        queryPg<AnnouncementRow>(dirChatSql, dirChatParams),
        queryPg<AnnouncementRow>(staffSql, staffParams),
        queryPg<AnnouncementRow>(
          `SELECT a.* FROM announcements a
           INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2
           WHERE a.institution_id = $1 AND a.type = 'evo_chat_direct'
           ORDER BY a.updated_at DESC`,
          [colegioId, userId]
        ),
      ]);
      await ensureEvoChatSectionDirectorRecipients(cursosDirectorRes.rows, colegioId);
      const [misCursosRaw, cursosDirectorRaw, colegasRaw, directosRaw] = await Promise.all([
        Promise.all(cursoRes.rows.map((a: AnnouncementRow) => buildThreadFromAnnouncementForViewer(a, userId))),
        Promise.all(
          cursosDirectorRes.rows.map((a: AnnouncementRow) => buildThreadFromAnnouncementForViewer(a, userId))
        ),
        Promise.all(staffRes.rows.map((a: AnnouncementRow) => buildThreadFromAnnouncementForViewer(a, userId))),
        Promise.all(directRes.rows.map((a: AnnouncementRow) => buildThreadFromAnnouncementForViewer(a, userId))),
      ]);
      const [mis_cursos, cursos_director, colegas, directos] = await Promise.all([
        mergeUnreadIntoThreads(misCursosRaw, userId),
        mergeUnreadIntoThreads(cursosDirectorRaw, userId),
        mergeUnreadIntoThreads(colegasRaw, userId),
        mergeUnreadIntoThreads(directosRaw, userId),
      ]);
      const support_thread = await buildSupportThreadForStaff(colegioId, userId);
      const allThreads = [
        ...mis_cursos,
        ...cursos_director,
        ...colegas,
        ...directos,
        ...(support_thread ? [support_thread] : []),
      ];
      const unreadByCategory = allThreads.reduce(
        (acc, t) => {
          const cat = threadCategoryForUnread(t);
          acc[cat] += t.unreadCount ?? 0;
          return acc;
        },
        { academico: 0, institucional: 0 }
      );
      return res.json({
        mis_cursos,
        cursos_director,
        colegas,
        directos,
        support_thread,
        unread_by_category: unreadByCategory,
      });
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
          const t = await buildThreadFromAnnouncementForViewer(a, userId);
          const subjectLabels = [
            ...new Set(rows.map((r) => (r.subject_name ?? '').trim()).filter((s) => s.length > 0)),
          ];
          /** Título del chat = materia (display_name o nombre de asignatura), no el nombre del profesor. */
          const displayTitle = subjectLabels.length ? subjectLabels.join(', ') : gs.group_name;
          return { ...t, displayTitle };
        })
      );
      let mergedCourse = userId ? await mergeUnreadIntoThreads(threadsRaw, userId) : threadsRaw;
      const famAnn = await findOrCreateFamilyEvoThread(userId);
      if (famAnn) {
        const famT = await buildThreadFromAnnouncementForViewer(famAnn, userId);
        const famWithUnread = await mergeUnreadIntoThreads(
          [{ ...famT, displayTitle: 'Familia (acudientes)' }],
          userId
        );
        mergedCourse = [...famWithUnread, ...mergedCourse];
      }
      const unreadByCategory = mergedCourse.reduce(
        (acc, t) => {
          const cat = threadCategoryForUnread(t);
          acc[cat] += t.unreadCount ?? 0;
          return acc;
        },
        { academico: 0, institucional: 0 }
      );
      return res.json({ threads: mergedCourse, unread_by_category: unreadByCategory });
    }

    // Padre: chats familia con cada hijo vinculado (estudiante + acudientes en el mismo hilo)
    if (rol === 'padre' && userId) {
      const guardianLinks = await findGuardianStudentsByGuardian(userId);
      const studentIds = [...new Set(guardianLinks.map((l) => l.student_id).filter(Boolean))];
      const childUsers = studentIds.length ? await findUsersByIds(studentIds) : [];
      const allowedStudentIds = childUsers
        .filter((u) => u.role === 'estudiante' && u.institution_id === colegioId)
        .map((u) => u.id);
      for (const sid of allowedStudentIds) {
        await findOrCreateFamilyEvoThread(sid);
      }
      const familyAnns = await findAnnouncementsByRecipient(userId, ['evo_chat_family'], colegioId);
      const threadsRaw = await Promise.all(
        familyAnns.map((a) => buildThreadFromAnnouncementForViewer(a, userId))
      );
      const threads = await mergeUnreadIntoThreads(threadsRaw, userId);
      const unreadByCategory = threads.reduce(
        (acc, t) => {
          const cat = threadCategoryForUnread(t);
          acc[cat] += t.unreadCount ?? 0;
          return acc;
        },
        { academico: 0, institucional: 0 }
      );
      return res.json({ threads, unread_by_category: unreadByCategory });
    }

    // Asistente: todos los hilos + Soporte 1-1 con GLC
    if (rol === 'asistente' && userId) {
      const announcements = (await findAnnouncementsByInstitution(colegioId, tipo ? { type: tipo } : undefined)).filter(
        (a) => !(a.type === 'evo_chat' && a.group_subject_id != null)
      );
      const threadsRaw = await Promise.all(
        announcements.map((a) => buildThreadFromAnnouncementForViewer(a, userId))
      );
      const threads = await mergeUnreadIntoThreads(threadsRaw, userId);
      const support_thread = await buildSupportThreadForStaff(colegioId, userId);
      const allThreads = [...threads, ...(support_thread ? [support_thread] : [])];
      const unreadByCategory = allThreads.reduce(
        (acc, t) => {
          const cat = threadCategoryForUnread(t);
          acc[cat] += t.unreadCount ?? 0;
          return acc;
        },
        { academico: 0, institucional: 0 }
      );
      return res.json({ threads, support_thread, unread_by_category: unreadByCategory });
    }

    // Admin GLC: Chats por categoría + Soporte 1-1 (un hilo por profesor/directivo/asistente con mensajes)
    if (rol === 'admin-general-colegio' && userId) {
      const allAnnouncements = await findAnnouncementsByInstitution(colegioId, tipo ? { type: tipo } : undefined);
      type ThreadV = Awaited<ReturnType<typeof buildThreadFromAnnouncementForViewer>>;
      const evoChatRaw: ThreadV[] = [];
      const evoChatStaffRaw: ThreadV[] = [];
      const evoChatDirectRaw: ThreadV[] = [];
      for (const a of allAnnouncements) {
        if (a.type === 'evo_chat_support') continue;
        if (a.type === 'evo_chat' && a.group_subject_id != null) continue;
        const t = await buildThreadFromAnnouncementForViewer(a, userId);
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
      const soporteRaw: ThreadV[] = [];
      for (const a of supportAnnouncements) {
        if (!a.support_staff_id) continue;
        const hasMessage = await getLastAnnouncementMessage(a.id);
        if (!hasMessage) continue;
        const staff = a.support_staff_id ? await findUserById(a.support_staff_id) : null;
        const t = await buildThreadFromAnnouncementForViewer(a, userId);
        soporteRaw.push({
          ...t,
          displayTitle: staff ? `Soporte · ${staff.full_name}` : t.asunto,
        });
      }
      const soporte = await mergeUnreadIntoThreads(soporteRaw, userId);
      const allThreads = [...evoChat, ...evoChatStaff, ...evoChatDirect, ...soporte];
      const unreadByCategory = allThreads.reduce(
        (acc, t) => {
          const cat = threadCategoryForUnread(t);
          acc[cat] += t.unreadCount ?? 0;
          return acc;
        },
        { academico: 0, institucional: 0 }
      );
      return res.json({
        chats_glc: { evo_chat: evoChat, evo_chat_staff: evoChatStaff, evo_chat_direct: evoChatDirect },
        soporte,
        unread_by_category: unreadByCategory,
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

    if (rol === 'padre') {
      return res.status(403).json({
        message: 'El chat del curso no está disponible para acudientes por privacidad del estudiante.',
      });
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
      (a.type === 'evo_chat' ||
        a.type === 'evo_chat_staff' ||
        a.type === 'evo_chat_direct' ||
        a.type === 'evo_chat_section_director');

    if ((a.type === 'evo_chat' || a.type === 'evo_chat_section_director') && !directorReadAll) {
      const allowedIds = await resolveRecipientsForThread({
        announcement: { id: a.id, type: a.type, group_id: a.group_id, group_subject_id: a.group_subject_id, created_by_id: a.created_by_id },
        institutionId: colegioId,
      });
      if (!allowedIds.includes(userId)) return res.json({ thread: null, messages: [] });
    }
    if (
      (a.type === 'evo_chat_staff' || a.type === 'evo_chat_direct' || a.type === 'evo_chat_family') &&
      !directorReadAll
    ) {
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
    const flagsMap = await getMessageUserFlagsMap(
      userId,
      msgRows.map((m) => m.id)
    );
    const revealTrash = String(req.query.revealTrash ?? '') === '1';
    const sourceRows = revealTrash ? msgRows : msgRows.filter((m) => !flagsMap.get(m.id)?.trashed);
    const messages = sourceRows.map((m) => {
      const sender = senderMap.get(m.sender_id);
      const f = flagsMap.get(m.id);
      return {
        _id: m.id,
        contenido: m.content,
        tipo: m.content_type,
        prioridad: m.priority,
        fecha: m.created_at,
        remitenteId: { _id: m.sender_id, nombre: sender?.full_name ?? '', rol: sender?.role },
        rolRemitente: m.sender_role,
        starred: f?.starred ?? false,
        viewerTrashed: f?.trashed ?? false,
      };
    });

    return res.json({ thread, messages });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener hilo.' });
  }
});

router.post('/messages/:messageId/mailbox-flags', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const { trash, star } = req.body as { trash?: boolean; star?: boolean };
    if (typeof trash !== 'boolean' && typeof star !== 'boolean') {
      return res.status(400).json({ message: 'Envía trash o star como booleano.' });
    }

    const gate = await assertMessageMailboxFlagAllowed(messageId, userId, colegioId, rol);
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    if (typeof trash === 'boolean') await setMessageTrashed(userId, messageId, colegioId, trash);
    if (typeof star === 'boolean') await setMessageStarred(userId, messageId, colegioId, star);

    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al actualizar el mensaje.' });
  }
});

router.get('/institutional-mailbox-folder', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const folder = String(req.query.folder ?? '').toLowerCase();
    if (folder !== 'trash' && folder !== 'starred') {
      return res.status(400).json({ message: 'folder debe ser trash o starred.' });
    }

    const rows = await listInstitutionalFolderCandidates(userId, colegioId, folder as 'trash' | 'starred');
    const items: Array<{
      messageId: string;
      threadId: string;
      asunto: string;
      preview: string;
      fecha: string;
      senderName: string;
      contentType: string;
    }> = [];

    for (const row of rows) {
      const cat = await computeInboxCategory({ id: row.announcement_id, type: 'evo_chat_direct' }, userId);
      if (cat !== 'institucional') continue;
      items.push({
        messageId: row.message_id,
        threadId: row.announcement_id,
        asunto: row.asunto,
        preview: truncateText(row.content, 220),
        fecha: row.created_at,
        senderName: row.sender_name,
        contentType: row.content_type,
      });
    }

    return res.json({ items });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al cargar la carpeta.' });
  }
});

router.get('/institutional-mailbox-meta', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const countInst = async (folder: 'trash' | 'starred') => {
      const rows = await listInstitutionalFolderCandidates(userId, colegioId, folder);
      let n = 0;
      for (const row of rows) {
        const cat = await computeInboxCategory({ id: row.announcement_id, type: 'evo_chat_direct' }, userId);
        if (cat === 'institucional') n++;
      }
      return n;
    };

    return res.json({
      trashCount: await countInst('trash'),
      starredCount: await countInst('starred'),
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al cargar resumen.' });
  }
});

router.post('/threads', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
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
    const role = req.user?.rol ?? '';

    const canPublishGeneral = ['directivo', 'admin-general-colegio', 'asistente-academica', 'school_admin'].includes(role);
    const canPublishCurso = ['profesor', 'directivo', 'admin-general-colegio', 'asistente-academica', 'school_admin'].includes(role);

    if (effectiveTipo === 'comunicado_general' && !canPublishGeneral) {
      return res.status(403).json({ message: 'No tienes permisos para enviar comunicados generales.' });
    }
    if (effectiveTipo === 'curso' && !canPublishCurso) {
      return res.status(403).json({ message: 'No tienes permisos para crear hilos por curso.' });
    }

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

      if (effectiveTipo === 'evo_chat_direct') {
        const senderU = await findUserById(userId);
        if (senderU?.role === 'padre' && targetUser.role === 'directivo') {
          const ok = await canPadreMessageDirectivo(userId, targetUserId!, colegioId);
          if (!ok) {
            return res.status(403).json({ message: 'No puedes iniciar este chat con este directivo.' });
          }
        }
        if (senderU?.role === 'directivo' && targetUser.role === 'padre') {
          const ok = await canDirectivoMessagePadre(userId, targetUserId!, colegioId);
          if (!ok) {
            return res.status(403).json({ message: 'No puedes iniciar este chat con este acudiente.' });
          }
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
    const rol = req.user?.rol;
    const directorWriteAll =
      !!rol &&
      DIRECTIVO_FULL_INBOX_ROLES.includes(rol as (typeof DIRECTIVO_FULL_INBOX_ROLES)[number]) &&
      (a.type === 'evo_chat' ||
        a.type === 'evo_chat_staff' ||
        a.type === 'evo_chat_direct' ||
        a.type === 'evo_chat_section_director');

    if (a.type === 'evo_chat' || a.type === 'evo_chat_section_director') {
      const allowedIds = await resolveRecipientsForThread({
        announcement: { id: a.id, type: a.type, group_id: a.group_id, group_subject_id: a.group_subject_id, created_by_id: a.created_by_id },
        institutionId: colegioId,
      });
      if (!directorWriteAll && !allowedIds.includes(userId)) {
        return res.status(403).json({ message: 'No tienes acceso a este hilo.' });
      }
    }
    if (a.type === 'evo_chat_staff' || a.type === 'evo_chat_direct' || a.type === 'evo_chat_family') {
      if (!directorWriteAll) {
        const allowed = await isUserRecipientOfAnnouncement(id, userId);
        if (!allowed) return res.status(403).json({ message: 'No tienes acceso a este hilo.' });
      }
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
    const isStructured = ct === 'evo_drive' || ct === 'assignment_reminder' || ct === 'evo_link';
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
      recipientsWithoutSender.map(async (rid) => {
        const email = await getUserEmail(rid);
        await notify({
          institution_id: colegioId,
          user_id: rid,
          user_email: email,
          type: 'mensaje',
          entity_type: 'evo_send_thread',
          entity_id: id,
          action_url: `/evo-send?thread=${encodeURIComponent(id)}`,
          title: `EvoSend · ${a.title}`,
          body: truncateText(isStructured ? `Adjunto: ${ct}` : (safeText || '(mensaje vacío)')),
        });
      })
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
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    const { id } = req.params;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const can = await canAccessEvoThread({
      announcementId: id,
      userId,
      institutionId: colegioId,
      role: rol,
    });
    if (!can) return res.status(403).json({ message: 'No tienes acceso a este hilo.' });
    await markEvoThreadRead(userId, id);
    const { emitEvoRead } = await import('../socket.js');
    emitEvoRead(id, userId);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al marcar leído.' });
  }
});

router.get('/search', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!q) return res.json([]);

    const candidates = await findAnnouncementsByInstitution(colegioId);
    const results: Array<{ id: string; title: string; type: string; updated_at: string }> = [];

    for (const a of candidates) {
      const can = await canAccessEvoThread({
        announcementId: a.id,
        userId,
        institutionId: colegioId,
        role: rol,
      });
      if (!can) continue;
      if ((a.title ?? '').toLowerCase().includes(q) || (a.body ?? '').toLowerCase().includes(q)) {
        results.push({ id: a.id, title: a.title, type: a.type, updated_at: a.updated_at });
      }
      if (results.length >= 20) break;
    }

    return res.json(results);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al buscar hilos.' });
  }
});

router.get('/attendance-inbox', protect, requireRole('asistente'), async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : undefined;
    const cursoId = typeof req.query.cursoId === 'string' ? req.query.cursoId : undefined;
    const params: unknown[] = [colegioId];
    const filters: string[] = ['a.institution_id = $1'];
    let idx = 2;
    if (fecha) {
      filters.push(`a.date = $${idx}`);
      params.push(fecha);
      idx += 1;
    }
    if (cursoId) {
      filters.push(`a.group_subject_id = $${idx}`);
      params.push(cursoId);
    }
    const sql = `SELECT a.id, a.date AS fecha, a.status AS estado,
      json_build_object('_id',u.id,'nombre',u.full_name) AS "estudianteId",
      json_build_object('_id',g.id,'nombre',COALESCE(gs.display_name,s.name,g.name)) AS "cursoId"
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      JOIN group_subjects gs ON gs.id = a.group_subject_id
      JOIN groups g ON g.id = gs.group_id
      JOIN subjects s ON s.id = gs.subject_id
      WHERE ${filters.join(' AND ')}
      ORDER BY a.date DESC
      LIMIT 200`;
    const out = await queryPg(sql, params);
    return res.json(out.rows);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al cargar asistencia.' });
  }
});

router.get('/people-finder', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    if (!userId || !colegioId || !rol) return res.status(401).json({ message: 'No autorizado.' });
    if (!q) return res.json([]);

    const me = await findUserById(userId);
    if (!me) return res.status(401).json({ message: 'Usuario no encontrado.' });

    const map = new Map<string, { id: string; nombre: string; rol: string; cargo?: string; materia?: string }>();

    if (rol === 'estudiante') {
      const enrollments = await findEnrollmentsByStudent(userId);
      const teacherIds = new Set<string>();
      for (const e of enrollments) {
        const gss = await findGroupSubjectsByGroupWithDetails(e.group_id, colegioId);
        gss.forEach((gs) => teacherIds.add(gs.teacher_id));
      }
      const staff = await findUsersByInstitutionAndRoles(colegioId, [
        'directivo',
        'asistente-academica',
        'school_admin',
        'rector',
        'admin-general-colegio',
      ]);
      const teachers = await findUsersByIds([...teacherIds]);
      [...teachers, ...staff].forEach((u) =>
        map.set(u.id, { id: u.id, nombre: u.full_name, rol: u.role, cargo: u.role })
      );
    } else if (rol === 'padre') {
      const links = await findGuardianStudentsByGuardian(userId);
      const teacherIds = new Set<string>();
      for (const l of links) {
        const enrollments = await findEnrollmentsByStudent(l.student_id);
        for (const e of enrollments) {
          const gss = await findGroupSubjectsByGroupWithDetails(e.group_id, colegioId);
          gss.forEach((gs) => teacherIds.add(gs.teacher_id));
        }
      }
      const staff = await findUsersByInstitutionAndRoles(colegioId, ['directivo', 'asistente-academica', 'school_admin']);
      const teachers = await findUsersByIds([...teacherIds]);
      [...teachers, ...staff].forEach((u) =>
        map.set(u.id, { id: u.id, nombre: u.full_name, rol: u.role, cargo: u.role })
      );
    } else if (rol === 'profesor') {
      const everyone = await queryPg<{ id: string; full_name: string; role: string }>(
        `SELECT id, full_name, role FROM users WHERE institution_id = $1 ORDER BY full_name`,
        [colegioId]
      );
      everyone.rows
        .filter((u) => u.id !== userId)
        .forEach((u) => map.set(u.id, { id: u.id, nombre: u.full_name, rol: u.role, cargo: u.role }));
    } else {
      const everyone = await queryPg<{ id: string; full_name: string; role: string }>(
        `SELECT id, full_name, role FROM users WHERE institution_id = $1 ORDER BY full_name`,
        [colegioId]
      );
      everyone.rows
        .filter((u) => u.id !== userId)
        .forEach((u) => map.set(u.id, { id: u.id, nombre: u.full_name, rol: u.role, cargo: u.role }));
    }

    const result = [...map.values()]
      .filter((x) => x.nombre.toLowerCase().includes(q) || x.rol.toLowerCase().includes(q))
      .slice(0, 30);
    return res.json(result);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error en people finder.' });
  }
});

/** Bandeja entrada/salida: hilos 1:1 (dos participantes) para cualquier rol con Evo Send. */
router.get('/director-mailbox', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const box = String(req.query.box ?? 'in').toLowerCase();
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const r = await queryPg<
      AnnouncementRow & {
        last_sender_id: string | null;
      }
    >(
      `SELECT a.*,
        (SELECT mm.sender_id FROM announcement_messages mm
         WHERE mm.announcement_id = a.id ORDER BY mm.created_at DESC LIMIT 1) AS last_sender_id
       FROM announcements a
       INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $1
       WHERE a.institution_id = $2 AND a.type = 'evo_chat_direct'
         AND (SELECT COUNT(*)::int FROM announcement_recipients arx WHERE arx.announcement_id = a.id) = 2
       ORDER BY a.updated_at DESC`,
      [userId, colegioId]
    );

    const filtered = r.rows.filter((row: AnnouncementRow & { last_sender_id: string | null }) => {
      const last = row.last_sender_id;
      if (box === 'in') {
        if (!last) return row.created_by_id !== userId;
        return last !== userId;
      }
      if (box === 'out') {
        if (!last) return row.created_by_id === userId;
        return last === userId;
      }
      return true;
    });

    /** Solo hilos 1:1 institucionales (GLC, padres, estudiantes, staff clave); no profesor↔profesor. */
    const filteredInstitutional: (AnnouncementRow & { last_sender_id: string | null })[] = [];
    for (const row of filtered) {
      const { last_sender_id: _ls, ...ann } = row;
      const cat = await computeInboxCategory({ id: ann.id, type: ann.type }, userId);
      if (cat === 'institucional') filteredInstitutional.push(row);
    }

    const threadsRaw = await Promise.all(
      filteredInstitutional.map((row: AnnouncementRow & { last_sender_id: string | null }) => {
        const { last_sender_id: __ls, ...ann } = row;
        return buildThreadFromAnnouncementForViewer(ann, userId);
      })
    );
    const threads = await mergeUnreadIntoThreads(threadsRaw, userId);
    return res.json({ threads });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al cargar bandeja.' });
  }
});

router.get('/courses', protect, requireRole('profesor', 'directivo', 'admin-general-colegio', 'asistente-academica'), async (req: AuthRequest, res) => {
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
