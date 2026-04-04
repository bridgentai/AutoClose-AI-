/**
 * Evo Send bootstrap: staff por sección, GLC global, chats curso–director, directivos↔docentes de sección, soporte 1-1.
 */

import { queryPg } from '../config/db-pg.js';
import { ensureEvoSendSupportAndReads } from '../db/pgSchemaPatches.js';
import { findAllInstitutions } from '../repositories/institutionRepository.js';
import { findUserById, findUsersByInstitutionAndRoles } from '../repositories/userRepository.js';
import { findSectionsByInstitution } from '../repositories/sectionRepository.js';
import { findGroupsByInstitution } from '../repositories/groupRepository.js';
import {
  findAnnouncementByInstitutionTitleAndType,
  findDirectThreadBetweenUsers,
  findOrCreateSupportThreadOneToOne,
  findOrCreateSectionDirectorGroupChat,
  createAnnouncement,
  addAnnouncementRecipients,
} from '../repositories/announcementRepository.js';

/** Hilo grupal institucional: todos los docentes + directores de sección (directivo con section_id). */
export const EVO_SEND_STAFF_GLC_TITLE = 'Profesores GLC';

const EVO_SEND_STAFF_HS_BASE = 'Profesores Highschool';
const STAFF_ROLES = ['profesor', 'directivo'] as const;
const SUPPORT_STAFF_ROLES = ['profesor', 'directivo', 'asistente'];

/** Título del chat grupal por sección: docentes que imparten ahí + directivo(s) de la sección. */
export function evoSendProfesoresHighschoolTitle(sectionName: string, sectionCount: number): string {
  return sectionCount <= 1 ? EVO_SEND_STAFF_HS_BASE : `${EVO_SEND_STAFF_HS_BASE} · ${sectionName}`;
}

function legacySectionStaffTitle(sectionName: string): string {
  return `Profesores · ${sectionName}`;
}

/**
 * Garantiza un hilo evo_chat_direct por cada docente que imparte en la sección del directivo
 * o asistente académica (idempotente). Útil al abrir la bandeja sin reiniciar el servidor.
 */
export async function ensureDirectThreadsForSectionLead(
  institutionId: string,
  leadUserId: string,
  sectionId: string
): Promise<void> {
  const lead = await findUserById(leadUserId);
  if (!lead || lead.institution_id !== institutionId) return;
  if (lead.role !== 'directivo' && lead.role !== 'asistente-academica') return;

  const teacherRows = await queryPg<{ teacher_id: string }>(
    `SELECT DISTINCT gs.teacher_id
     FROM group_subjects gs
     INNER JOIN groups g ON g.id = gs.group_id AND g.institution_id = gs.institution_id
     WHERE gs.institution_id = $1 AND g.section_id = $2 AND gs.teacher_id IS NOT NULL`,
    [institutionId, sectionId]
  );

  for (const row of teacherRows.rows) {
    if (row.teacher_id === leadUserId) continue;
    const prof = await findUserById(row.teacher_id);
    if (!prof || prof.role !== 'profesor') continue;
    const existing = await findDirectThreadBetweenUsers(leadUserId, row.teacher_id, institutionId);
    if (existing) continue;
    const a = await createAnnouncement({
      institution_id: institutionId,
      title: prof.full_name || 'Profesor',
      body: null,
      type: 'evo_chat_direct',
      group_id: null,
      group_subject_id: null,
      created_by_id: leadUserId,
    });
    await addAnnouncementRecipients(a.id, [leadUserId, row.teacher_id]);
  }
}

export async function ensureEvoSendStaffAndDirectThreads(): Promise<void> {
  await ensureEvoSendSupportAndReads();
  const institutions = await findAllInstitutions();
  for (const inst of institutions) {
    try {
      await ensureSectionDirectorChatsForInstitution(inst.id);
      await ensureStaffGroupsForInstitution(inst.id);
      await ensureDirectThreadsForInstitution(inst.id);
      await ensureSupportOneToOneForInstitution(inst.id);
    } catch (err) {
      console.error(`[evoSendBootstrap] Error for institution ${inst.id}:`, err);
    }
  }
}

async function ensureSupportOneToOneForInstitution(institutionId: string): Promise<void> {
  const admins = await findUsersByInstitutionAndRoles(institutionId, ['admin-general-colegio']);
  if (admins.length === 0) return;

  const adminIds = admins.map((a) => a.id);
  const createdBy = admins[0].id;
  const staff = await findUsersByInstitutionAndRoles(institutionId, [...SUPPORT_STAFF_ROLES]);
  for (const u of staff) {
    try {
      await findOrCreateSupportThreadOneToOne(
        institutionId,
        u.id,
        u.full_name || 'Usuario',
        adminIds,
        createdBy
      );
    } catch (e) {
      console.warn(`[evoSendBootstrap] soporte 1-1 ${u.id}:`, (e as Error).message);
    }
  }
}

export async function ensureStaffGroupsForInstitution(institutionId: string): Promise<void> {
  const sections = await findSectionsByInstitution(institutionId);
  const allStaff = await findUsersByInstitutionAndRoles(institutionId, [...STAFF_ROLES]);
  if (allStaff.length === 0) return;
  const createdById = allStaff[0].id;

  if (sections.length === 0) {
    for (const title of [EVO_SEND_STAFF_HS_BASE, EVO_SEND_STAFF_GLC_TITLE] as const) {
      const existing = await findAnnouncementByInstitutionTitleAndType(institutionId, title, 'evo_chat_staff');
      const memberIds = allStaff.map((u) => u.id);
      if (existing) {
        await addAnnouncementRecipients(existing.id, memberIds);
        continue;
      }
      const a = await createAnnouncement({
        institution_id: institutionId,
        title,
        body: null,
        type: 'evo_chat_staff',
        group_id: null,
        group_subject_id: null,
        created_by_id: createdById,
      });
      await addAnnouncementRecipients(a.id, memberIds);
    }
    return;
  }

  const tutores = await queryPg<{ teacher_id: string; section_id: string }>(
    `SELECT DISTINCT gs.teacher_id, g.section_id
     FROM group_subjects gs
     INNER JOIN groups g ON g.id = gs.group_id AND g.institution_id = gs.institution_id
     WHERE gs.institution_id = $1 AND gs.teacher_id IS NOT NULL`,
    [institutionId]
  );

  const teachersBySection = new Map<string, Set<string>>();
  for (const row of tutores.rows) {
    if (!teachersBySection.has(row.section_id)) teachersBySection.set(row.section_id, new Set());
    teachersBySection.get(row.section_id)!.add(row.teacher_id);
  }

  const directoresPorSeccion = await queryPg<{ id: string; section_id: string }>(
    `SELECT id, section_id FROM users
     WHERE institution_id = $1 AND role = 'directivo' AND section_id IS NOT NULL`,
    [institutionId]
  );
  const directorsBySection = new Map<string, string[]>();
  for (const d of directoresPorSeccion.rows) {
    if (!directorsBySection.has(d.section_id)) directorsBySection.set(d.section_id, []);
    directorsBySection.get(d.section_id)!.push(d.id);
  }

  for (const sec of sections) {
    const title = evoSendProfesoresHighschoolTitle(sec.name, sections.length);
    const memberSet = new Set<string>();
    const teach = teachersBySection.get(sec.id);
    if (teach) for (const id of Array.from(teach)) memberSet.add(id);
    const dirs = directorsBySection.get(sec.id);
    if (dirs) for (const id of dirs) memberSet.add(id);
    const memberIds = Array.from(memberSet);
    if (memberIds.length === 0) continue;

    let ann = await findAnnouncementByInstitutionTitleAndType(institutionId, title, 'evo_chat_staff');
    if (!ann) {
      const oldTitle = legacySectionStaffTitle(sec.name);
      const oldAnn = await findAnnouncementByInstitutionTitleAndType(institutionId, oldTitle, 'evo_chat_staff');
      if (oldAnn) {
        await queryPg(
          `UPDATE announcements SET title = $1, updated_at = now() WHERE id = $2 AND institution_id = $3`,
          [title, oldAnn.id, institutionId]
        );
        ann = { ...oldAnn, title };
      }
    }
    if (!ann) {
      ann = await createAnnouncement({
        institution_id: institutionId,
        title,
        body: null,
        type: 'evo_chat_staff',
        group_id: null,
        group_subject_id: null,
        created_by_id: createdById,
      });
    }
    await addAnnouncementRecipients(ann.id, memberIds);
  }

  const allTeachers = await findUsersByInstitutionAndRoles(institutionId, ['profesor']);
  const sectionDirectorUsers = await queryPlainDirectorsWithSection(institutionId);
  const glcMemberIds = Array.from(
    new Set([...allTeachers.map((t) => t.id), ...sectionDirectorUsers.map((d) => d.id)])
  );
  if (glcMemberIds.length === 0) return;

  let glc = await findAnnouncementByInstitutionTitleAndType(institutionId, EVO_SEND_STAFF_GLC_TITLE, 'evo_chat_staff');
  if (!glc) {
    glc = await createAnnouncement({
      institution_id: institutionId,
      title: EVO_SEND_STAFF_GLC_TITLE,
      body: null,
      type: 'evo_chat_staff',
      group_id: null,
      group_subject_id: null,
      created_by_id: createdById,
    });
  }
  await addAnnouncementRecipients(glc.id, glcMemberIds);
}

async function queryPlainDirectorsWithSection(
  institutionId: string
): Promise<{ id: string }[]> {
  const r = await queryPg<{ id: string }>(
    `SELECT id FROM users
     WHERE institution_id = $1 AND role = 'directivo' AND section_id IS NOT NULL`,
    [institutionId]
  );
  return r.rows;
}

async function ensureSectionDirectorChatsForInstitution(institutionId: string): Promise<void> {
  const groups = await findGroupsByInstitution(institutionId);
  const directors = await queryPg<{ id: string; section_id: string | null }>(
    `SELECT id, section_id FROM users
     WHERE institution_id = $1 AND role = 'directivo' AND section_id IS NOT NULL`,
    [institutionId]
  );
  const bySection = new Map<string, string>();
  for (const d of directors.rows) {
    if (d.section_id && !bySection.has(d.section_id)) bySection.set(d.section_id, d.id);
  }

  for (const g of groups) {
    const dirId = bySection.get(g.section_id);
    if (!dirId) continue;
    await findOrCreateSectionDirectorGroupChat(g.id, institutionId, g.name, dirId);
  }
}

async function ensureDirectThreadsForInstitution(institutionId: string): Promise<void> {
  const directivos = await findUsersByInstitutionAndRoles(institutionId, ['directivo']);
  const profesores = await findUsersByInstitutionAndRoles(institutionId, ['profesor']);
  if (directivos.length === 0 || profesores.length === 0) return;

  const teacherToSectionIds = new Map<string, Set<string>>();
  const gs = await queryPg<{ teacher_id: string; section_id: string }>(
    `SELECT gs.teacher_id, g.section_id
     FROM group_subjects gs
     INNER JOIN groups g ON g.id = gs.group_id AND g.institution_id = gs.institution_id
     WHERE gs.institution_id = $1 AND gs.teacher_id IS NOT NULL`,
    [institutionId]
  );
  for (const row of gs.rows) {
    if (!teacherToSectionIds.has(row.teacher_id)) teacherToSectionIds.set(row.teacher_id, new Set());
    teacherToSectionIds.get(row.teacher_id)!.add(row.section_id);
  }

  for (const directivo of directivos) {
    for (const profesor of profesores) {
      if (directivo.id === profesor.id) continue;
      const secId = directivo.section_id;
      if (secId) {
        const secs = teacherToSectionIds.get(profesor.id);
        if (!secs || !secs.has(secId)) continue;
      }
      const existing = await findDirectThreadBetweenUsers(directivo.id, profesor.id, institutionId);
      if (existing) continue;
      const a = await createAnnouncement({
        institution_id: institutionId,
        title: profesor.full_name,
        body: null,
        type: 'evo_chat_direct',
        group_id: null,
        group_subject_id: null,
        created_by_id: directivo.id,
      });
      await addAnnouncementRecipients(a.id, [directivo.id, profesor.id]);
    }
  }
}
