import { queryPg } from '../config/db-pg.js';
import { ensureEvoSendSupportAndReads } from '../db/pgSchemaPatches.js';

export interface MessageUserStateRow {
  message_id: string;
  trashed: boolean;
  starred: boolean;
}

export interface InstitutionalFolderRow {
  message_id: string;
  announcement_id: string;
  content: string;
  content_type: string;
  created_at: string;
  asunto: string;
  sender_name: string;
  folder_at: string;
}

/** Devuelve flags por message_id para el usuario (solo ids solicitados). */
export async function getMessageUserFlagsMap(
  userId: string,
  messageIds: string[]
): Promise<Map<string, { trashed: boolean; starred: boolean }>> {
  await ensureEvoSendSupportAndReads();
  const out = new Map<string, { trashed: boolean; starred: boolean }>();
  if (messageIds.length === 0) return out;
  const r = await queryPg<{ message_id: string; trashed_at: string | null; starred_at: string | null }>(
    `SELECT message_id, trashed_at, starred_at
     FROM evo_send_message_user_state
     WHERE user_id = $1 AND message_id = ANY($2::uuid[])`,
    [userId, messageIds]
  );
  for (const row of r.rows) {
    out.set(row.message_id, {
      trashed: row.trashed_at != null,
      starred: row.starred_at != null,
    });
  }
  return out;
}

export async function setMessageTrashed(
  userId: string,
  messageId: string,
  institutionId: string,
  trashed: boolean
): Promise<void> {
  await ensureEvoSendSupportAndReads();
  if (trashed) {
    await queryPg(
      `INSERT INTO evo_send_message_user_state (user_id, message_id, institution_id, trashed_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, message_id) DO UPDATE SET
         trashed_at = now(),
         updated_at = now(),
         institution_id = EXCLUDED.institution_id`,
      [userId, messageId, institutionId]
    );
  } else {
    await queryPg(
      `UPDATE evo_send_message_user_state
       SET trashed_at = NULL, updated_at = now()
       WHERE user_id = $1 AND message_id = $2 AND institution_id = $3`,
      [userId, messageId, institutionId]
    );
  }
}

export async function setMessageStarred(
  userId: string,
  messageId: string,
  institutionId: string,
  starred: boolean
): Promise<void> {
  await ensureEvoSendSupportAndReads();
  if (starred) {
    await queryPg(
      `INSERT INTO evo_send_message_user_state (user_id, message_id, institution_id, starred_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, message_id) DO UPDATE SET
         starred_at = now(),
         updated_at = now(),
         institution_id = EXCLUDED.institution_id`,
      [userId, messageId, institutionId]
    );
  } else {
    await queryPg(
      `UPDATE evo_send_message_user_state
       SET starred_at = NULL, updated_at = now()
       WHERE user_id = $1 AND message_id = $2 AND institution_id = $3`,
      [userId, messageId, institutionId]
    );
  }
}

/** Mensajes en papelera o destacados (hilos 1:1 directos; filtrar institucional en la capa de ruta). */
export async function listInstitutionalFolderCandidates(
  userId: string,
  institutionId: string,
  folder: 'trash' | 'starred'
): Promise<InstitutionalFolderRow[]> {
  await ensureEvoSendSupportAndReads();
  const timeCol = folder === 'trash' ? 's.trashed_at' : 's.starred_at';
  const cond = folder === 'trash' ? 's.trashed_at IS NOT NULL' : 's.starred_at IS NOT NULL';
  const r = await queryPg<InstitutionalFolderRow>(
    `SELECT mm.id AS message_id,
            mm.announcement_id,
            mm.content,
            mm.content_type,
            mm.created_at,
            a.title AS asunto,
            u.full_name AS sender_name,
            ${timeCol} AS folder_at
     FROM evo_send_message_user_state s
     INNER JOIN announcement_messages mm ON mm.id = s.message_id
     INNER JOIN announcements a ON a.id = mm.announcement_id
     INNER JOIN users u ON u.id = mm.sender_id
     WHERE s.user_id = $1
       AND s.institution_id = $2
       AND ${cond}
       AND a.institution_id = $2
       AND a.type = 'evo_chat_direct'
       AND (SELECT COUNT(*)::int FROM announcement_recipients ar WHERE ar.announcement_id = a.id) = 2
     ORDER BY ${timeCol} DESC NULLS LAST`,
    [userId, institutionId]
  );
  return r.rows;
}
