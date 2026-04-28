import { queryPg } from '../config/db-pg.js';
import type { AnnouncementRow } from '../repositories/announcementRepository.js';
import { findAnnouncementById, isUserRecipientOfAnnouncement } from '../repositories/announcementRepository.js';
import { findParentUserIdsForGroupSubject } from '../repositories/comunicacionRepository.js';
import { findUsersByIds } from '../repositories/userRepository.js';

export const DIRECTIVO_FULL_INBOX_ROLES = ['directivo', 'asistente-academica', 'school_admin'] as const;

interface AnnouncementAccessShape {
  id: string;
  type: string;
  group_id: string | null;
  group_subject_id: string | null;
  created_by_id: string;
}

export async function resolveRecipientsForThread(args: {
  announcement: AnnouncementAccessShape;
  institutionId: string;
}): Promise<string[]> {
  const a = args.announcement;

  if (
    a.type === 'evo_chat_staff' ||
    a.type === 'evo_chat_direct' ||
    a.type === 'evo_chat_family' ||
    a.type === 'evo_chat_support'
  ) {
    const r = await queryPg<{ user_id: string }>(
      'SELECT user_id FROM announcement_recipients WHERE announcement_id = $1',
      [a.id]
    );
    return r.rows.map((x: { user_id: string }) => x.user_id);
  }

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

  if (a.type === 'evo_chat_section_director' && a.group_id) {
    const students = await queryPg<{ student_id: string }>(
      'SELECT student_id FROM enrollments WHERE group_id = $1',
      [a.group_id]
    );
    const directors = await queryPg<{ id: string }>(
      `SELECT u.id FROM users u
       INNER JOIN groups g ON g.id = $1 AND g.institution_id = $2
       WHERE u.institution_id = $2
         AND u.role = 'directivo'
         AND u.section_id IS NOT NULL
         AND u.section_id = g.section_id`,
      [a.group_id, args.institutionId]
    );
    const recipientMap: Record<string, true> = {};
    for (const x of students.rows) recipientMap[x.student_id] = true;
    for (const x of directors.rows) recipientMap[x.id] = true;
    return Object.keys(recipientMap);
  }

  if (a.type === 'evo_chat_parent_subject' && a.group_subject_id) {
    const t = await queryPg<{ teacher_id: string }>(
      'SELECT teacher_id FROM group_subjects WHERE id = $1 AND institution_id = $2 LIMIT 1',
      [a.group_subject_id, args.institutionId]
    );
    const teacherId = t.rows[0]?.teacher_id;
    const parents = await findParentUserIdsForGroupSubject(a.group_subject_id, args.institutionId);
    const recipientMap: Record<string, true> = {};
    if (teacherId) recipientMap[teacherId] = true;
    for (const pid of parents) recipientMap[pid] = true;
    return Object.keys(recipientMap);
  }

  return [];
}

export function getThreadCategoryByType(type: string): 'academico' | 'institucional' {
  if (type === 'comunicado_institucional') return 'institucional';
  return 'academico';
}

/** Roles de contacto institucional: hilos 1:1 con ellos van a la bandeja Institucional (misma regla que evoSend). */
const INSTITUTIONAL_COUNTERPART_ROLES = new Set([
  'directivo',
  'asistente-academica',
  'school_admin',
  'admin-general-colegio',
  'rector',
  'asistente',
]);

/**
 * Categoría de bandeja (Académico vs Institucional) para un anuncio/hilo Evo Send.
 * Exportado para reutilizar en Evo Drive (carpeta Circulares del padre).
 */
export async function computeInboxCategory(
  a: Pick<AnnouncementRow, 'id' | 'type'>,
  _viewerUserId: string | undefined
): Promise<'academico' | 'institucional'> {
  if (a.type === 'comunicado_institucional') return 'institucional';
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
    if (roles.every((role) => role === 'profesor')) return 'academico';
    const hasProfesor = roles.some((role) => role === 'profesor');
    const hasSectionAcademicLead = roles.some((role) => role === 'directivo' || role === 'asistente-academica');
    if (hasProfesor && hasSectionAcademicLead) return 'academico';
    if (roles.some((role) => role === 'estudiante' || role === 'padre')) return 'institucional';
    if (roles.some((role) => INSTITUTIONAL_COUNTERPART_ROLES.has(role))) return 'institucional';
    return 'academico';
  }
  return getThreadCategoryByType(a.type) === 'institucional' ? 'institucional' : 'academico';
}

export async function canAccessEvoThread(args: {
  announcementId: string;
  userId: string;
  institutionId: string;
  role?: string;
}): Promise<boolean> {
  const { announcementId, userId, institutionId, role } = args;
  const a = await findAnnouncementById(announcementId);
  if (!a || a.institution_id !== institutionId) return false;

  const directorReadAll =
    !!role &&
    DIRECTIVO_FULL_INBOX_ROLES.includes(role as (typeof DIRECTIVO_FULL_INBOX_ROLES)[number]) &&
    (a.type === 'evo_chat' ||
      a.type === 'evo_chat_staff' ||
      a.type === 'evo_chat_direct' ||
      a.type === 'evo_chat_section_director');

  if (directorReadAll) return true;

  if (a.type === 'evo_chat_parent_subject' && a.group_subject_id) {
    const allowedIds = await resolveRecipientsForThread({
      announcement: {
        id: a.id,
        type: a.type,
        group_id: a.group_id,
        group_subject_id: a.group_subject_id,
        created_by_id: a.created_by_id,
      },
      institutionId,
    });
    return allowedIds.includes(userId);
  }

  if (a.type === 'evo_chat' || a.type === 'evo_chat_section_director') {
    const allowedIds = await resolveRecipientsForThread({
      announcement: {
        id: a.id,
        type: a.type,
        group_id: a.group_id,
        group_subject_id: a.group_subject_id,
        created_by_id: a.created_by_id,
      },
      institutionId,
    });
    return allowedIds.includes(userId);
  }

  if (
    a.type === 'evo_chat_staff' ||
    a.type === 'evo_chat_direct' ||
    a.type === 'evo_chat_family' ||
    a.type === 'evo_chat_support'
  ) {
    return isUserRecipientOfAnnouncement(announcementId, userId);
  }

  return true;
}
