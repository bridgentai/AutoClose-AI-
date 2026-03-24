/**
 * Evo Send bootstrap: staff groups, direct threads, soporte 1-1 (profesor/directivo/asistente ↔ GLC).
 */

import { ensureEvoSendSupportAndReads } from '../db/pgSchemaPatches.js';
import { findAllInstitutions } from '../repositories/institutionRepository.js';
import { findUsersByInstitutionAndRoles } from '../repositories/userRepository.js';
import {
  findAnnouncementByInstitutionTitleAndType,
  findDirectThreadBetweenUsers,
  findOrCreateSupportThreadOneToOne,
  createAnnouncement,
  addAnnouncementRecipients,
} from '../repositories/announcementRepository.js';

const STAFF_GROUP_TITLES = ['Profesores Highschool', 'Profesores GLC'] as const;
const STAFF_ROLES = ['profesor', 'directivo'];
const SUPPORT_STAFF_ROLES = ['profesor', 'directivo', 'asistente'];

export async function ensureEvoSendStaffAndDirectThreads(): Promise<void> {
  await ensureEvoSendSupportAndReads();
  const institutions = await findAllInstitutions();
  for (const inst of institutions) {
    try {
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

async function ensureStaffGroupsForInstitution(institutionId: string): Promise<void> {
  const staffUsers = await findUsersByInstitutionAndRoles(institutionId, [...STAFF_ROLES]);
  const memberIds = staffUsers.map((u) => u.id);
  if (memberIds.length === 0) return;

  const createdById = staffUsers[0].id;

  for (const title of STAFF_GROUP_TITLES) {
    const existing = await findAnnouncementByInstitutionTitleAndType(
      institutionId,
      title,
      'evo_chat_staff'
    );
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
}

async function ensureDirectThreadsForInstitution(institutionId: string): Promise<void> {
  // POLÍTICA DE SEGURIDAD: solo se crean hilos directos entre adultos (directivo ↔ profesor).
  // Los hilos directo adulto-estudiante no se generan aquí.
  // Solo el profesor directo o el padre/acudiente vinculado puede iniciar chat con un estudiante,
  // validado en POST /api/evo-send/threads con tipo evo_chat_direct (targetUserId / recipientId).
  const directivos = await findUsersByInstitutionAndRoles(institutionId, ['directivo']);
  const profesores = await findUsersByInstitutionAndRoles(institutionId, ['profesor']);
  if (directivos.length === 0 || profesores.length === 0) return;

  for (const directivo of directivos) {
    for (const profesor of profesores) {
      const existing = await findDirectThreadBetweenUsers(
        directivo.id,
        profesor.id,
        institutionId
      );
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
