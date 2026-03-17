/**
 * Evo Send bootstrap: create staff groups (evo_chat_staff) and direct threads (evo_chat_direct)
 * per institution on server start. Idempotent: skips if threads already exist.
 */

import { findAllInstitutions } from '../repositories/institutionRepository.js';
import { findUsersByInstitutionAndRoles } from '../repositories/userRepository.js';
import {
  findAnnouncementByInstitutionTitleAndType,
  findDirectThreadBetweenUsers,
  createAnnouncement,
  addAnnouncementRecipients,
} from '../repositories/announcementRepository.js';

const STAFF_GROUP_TITLES = ['Profesores Highschool', 'Profesores GLC'] as const;
const STAFF_ROLES = ['profesor', 'directivo'];

export async function ensureEvoSendStaffAndDirectThreads(): Promise<void> {
  const institutions = await findAllInstitutions();
  for (const inst of institutions) {
    try {
      await ensureStaffGroupsForInstitution(inst.id);
      await ensureDirectThreadsForInstitution(inst.id);
    } catch (err) {
      console.error(`[evoSendBootstrap] Error for institution ${inst.id}:`, err);
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
