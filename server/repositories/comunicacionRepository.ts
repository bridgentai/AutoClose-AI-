import { queryPg } from '../config/db-pg.js';
import { ensureEvoSendSupportAndReads } from '../db/pgSchemaPatches.js';
import type { AnnouncementRow } from './announcementRepository.js';

export interface ComunicadoPadresListItem extends AnnouncementRow {
  reads_count: number;
  total_recipients: number;
  has_correction: boolean;
  replies_count: number;
  subject_name: string | null;
  group_name: string | null;
  author_name: string | null;
  author_role: string | null;
  staff_last_read_at: string | null;
  is_read: boolean;
  parent_replies: ParentReplyEnriched[];
}

export interface ParentReplyEnriched {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  parent_display_name: string;
  linked_student_names: string | null;
}

export interface InstitucionalListItem extends AnnouncementRow {
  reads_count: number;
  total_recipients: number;
  has_correction: boolean;
  author_name: string | null;
  author_role: string | null;
}

/** Texto para tarjeta «Destacado» en Centro de Comunicación. */
export interface ComunicadoResumenHighlight {
  remitente: string;
  extracto: string;
}

/** Último comunicado a padres enviado que recibió este acudiente (orden real de llegada). */
export async function findLastSentComunicadoPadresHighlightForPadre(
  institutionId: string,
  padreUserId: string
): Promise<ComunicadoResumenHighlight | null> {
  const r = await queryPg<{
    title: string;
    body: string | null;
    subject_name: string | null;
    group_name: string | null;
  }>(
    `SELECT a.title, a.body,
            COALESCE(gs.display_name, s.name) AS subject_name,
            g.name AS group_name
     FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2::uuid
     LEFT JOIN group_subjects gs ON gs.id = a.group_subject_id
     LEFT JOIN subjects s ON s.id = gs.subject_id
     LEFT JOIN groups g ON g.id = a.group_id
     WHERE a.institution_id = $1::uuid AND a.type = 'comunicado_padres' AND a.status = 'sent'
     ORDER BY COALESCE(a.sent_at, a.created_at) DESC NULLS LAST, a.created_at DESC
     LIMIT 1`,
    [institutionId, padreUserId]
  );
  const row = r.rows[0];
  if (!row) return null;
  const remitente = [row.subject_name, row.group_name].filter(Boolean).join(' - ') || 'Comunicación';
  const extracto = (row.title || row.body || '').trim().slice(0, 280);
  if (!extracto) return { remitente, extracto: '(Sin texto)' };
  return { remitente, extracto };
}

/** Cursos/materias distintos donde este padre ha recibido al menos un comunicado enviado. */
export async function countDistinctPadresComunicadoGroupSubjectsForPadre(
  institutionId: string,
  padreUserId: string
): Promise<number> {
  const r = await queryPg<{ c: string }>(
    `SELECT COUNT(DISTINCT a.group_subject_id)::text AS c
     FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2::uuid
     WHERE a.institution_id = $1::uuid
       AND a.type = 'comunicado_padres'
       AND a.status = 'sent'
       AND a.group_subject_id IS NOT NULL`,
    [institutionId, padreUserId]
  );
  return parseInt(r.rows[0]?.c ?? '0', 10) || 0;
}

/**
 * Última respuesta de un padre en comunicados del ámbito (docente: solo hilos que él creó; staff: cualquier hilo en esas materias).
 */
export async function findLastParentReplyHighlightForStaff(
  institutionId: string,
  viewerUserId: string,
  viewerRole: string,
  groupSubjectIds: string[]
): Promise<ComunicadoResumenHighlight | null> {
  if (groupSubjectIds.length === 0) return null;
  const isProfesor = viewerRole === 'profesor';
  const r = isProfesor
    ? await queryPg<{
        content: string;
        title: string;
        subject_name: string | null;
        group_name: string | null;
      }>(
        `SELECT m.content, a.title,
                COALESCE(gs.display_name, s.name) AS subject_name,
                g.name AS group_name
         FROM announcement_messages m
         INNER JOIN announcements a ON a.id = m.announcement_id
         LEFT JOIN group_subjects gs ON gs.id = a.group_subject_id
         LEFT JOIN subjects s ON s.id = gs.subject_id
         LEFT JOIN groups g ON g.id = a.group_id
         WHERE a.institution_id = $1::uuid
           AND a.type = 'comunicado_padres'
           AND a.group_subject_id = ANY($2::uuid[])
           AND a.created_by_id = $3::uuid
           AND m.sender_role = 'padre'
         ORDER BY m.created_at DESC
         LIMIT 1`,
        [institutionId, groupSubjectIds, viewerUserId]
      )
    : await queryPg<{
        content: string;
        title: string;
        subject_name: string | null;
        group_name: string | null;
      }>(
        `SELECT m.content, a.title,
                COALESCE(gs.display_name, s.name) AS subject_name,
                g.name AS group_name
         FROM announcement_messages m
         INNER JOIN announcements a ON a.id = m.announcement_id
         LEFT JOIN group_subjects gs ON gs.id = a.group_subject_id
         LEFT JOIN subjects s ON s.id = gs.subject_id
         LEFT JOIN groups g ON g.id = a.group_id
         WHERE a.institution_id = $1::uuid
           AND a.type = 'comunicado_padres'
           AND a.group_subject_id = ANY($2::uuid[])
           AND m.sender_role = 'padre'
         ORDER BY m.created_at DESC
         LIMIT 1`,
        [institutionId, groupSubjectIds]
      );
  const row = r.rows[0];
  if (!row) return null;
  const remitente = [row.subject_name, row.group_name].filter(Boolean).join(' - ') || 'Familia';
  const extracto = (row.content || row.title || '').trim().slice(0, 280);
  if (!extracto) return { remitente, extracto: '(Mensaje sin texto)' };
  return { remitente, extracto };
}

/** Último comunicado institucional que este usuario recibió (destinatario explícito). */
export async function findLastInstitucionalHighlightForViewer(
  institutionId: string,
  viewerUserId: string
): Promise<ComunicadoResumenHighlight | null> {
  const r = await queryPg<{ title: string; body: string | null; category: string | null }>(
    `SELECT a.title, a.body, a.category
     FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2::uuid
     WHERE a.institution_id = $1::uuid AND a.type = 'comunicado_institucional' AND a.status = 'sent'
     ORDER BY COALESCE(a.sent_at, a.created_at) DESC NULLS LAST, a.created_at DESC
     LIMIT 1`,
    [institutionId, viewerUserId]
  );
  const row = r.rows[0];
  if (!row) return null;
  const cat = (row.category || '').trim();
  const remitente = cat ? `GLC · ${cat}` : 'Comunicados institucionales';
  const extracto = (row.title || row.body || '').trim().slice(0, 280);
  if (!extracto) return { remitente, extracto: '(Sin texto)' };
  return { remitente, extracto };
}

/** Padres (usuarios role padre) vinculados vía guardian_students a estudiantes del grupo del group_subject. */
export async function findParentUserIdsForGroupSubject(
  groupSubjectId: string,
  institutionId: string
): Promise<string[]> {
  const r = await queryPg<{ id: string }>(
    `SELECT DISTINCT u.id
     FROM group_subjects gs
     JOIN enrollments e ON e.group_id = gs.group_id
     JOIN guardian_students g ON g.student_id = e.student_id AND g.institution_id = gs.institution_id
     JOIN users u ON u.id = g.guardian_id AND u.role = 'padre'
     WHERE gs.id = $1 AND gs.institution_id = $2`,
    [groupSubjectId, institutionId]
  );
  return r.rows.map((x: { id: string }) => x.id);
}

export async function countParentsForGroupSubject(
  groupSubjectId: string,
  institutionId: string
): Promise<number> {
  const ids = await findParentUserIdsForGroupSubject(groupSubjectId, institutionId);
  return ids.length;
}

/** Padres vinculados al curso de la materia (para elegir destinatarios del comunicado). */
export async function listParentRecipientsForGroupSubject(
  groupSubjectId: string,
  institutionId: string
): Promise<{ id: string; full_name: string }[]> {
  const r = await queryPg<{ id: string; full_name: string }>(
    `SELECT DISTINCT u.id,
            COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(u.email), ''), u.id::text) AS full_name
     FROM group_subjects gs
     JOIN enrollments e ON e.group_id = gs.group_id
     JOIN guardian_students g ON g.student_id = e.student_id AND g.institution_id = gs.institution_id
     JOIN users u ON u.id = g.guardian_id AND u.role = 'padre'
     WHERE gs.id = $1 AND gs.institution_id = $2
     ORDER BY full_name`,
    [groupSubjectId, institutionId]
  );
  return r.rows;
}

export async function createComunicacionAnnouncement(row: {
  institution_id: string;
  title: string;
  body: string | null;
  type: 'comunicado_padres' | 'comunicado_institucional';
  group_id?: string | null;
  group_subject_id?: string | null;
  assignment_id?: string | null;
  created_by_id: string;
  status: 'pending' | 'sent';
  scheduled_send_at?: string | null;
  sent_at?: string | null;
  audience?: string;
  category?: string;
  priority?: string;
  correction_of?: string | null;
  attachments_json?: string;
}): Promise<AnnouncementRow> {
  const attachmentsPayload = row.attachments_json ?? '[]';
  const r = await queryPg<AnnouncementRow>(
    `INSERT INTO announcements (
       institution_id, title, body, type, group_id, group_subject_id, assignment_id, created_by_id, published_at,
       status, scheduled_send_at, sent_at, audience, category, priority, correction_of, attachments_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(),
       $9, $10, $11, $12, $13, $14, $15, $16::jsonb)
     RETURNING *`,
    [
      row.institution_id,
      row.title,
      row.body,
      row.type,
      row.group_id ?? null,
      row.group_subject_id ?? null,
      row.assignment_id ?? null,
      row.created_by_id,
      row.status,
      row.scheduled_send_at ?? null,
      row.sent_at ?? null,
      row.audience ?? 'parents',
      row.category ?? 'general',
      row.priority ?? 'normal',
      row.correction_of ?? null,
      attachmentsPayload,
    ]
  );
  const ins = r.rows[0];
  if (!ins) throw new Error('No se creó el comunicado');
  return ins;
}

export async function releasePendingAnnouncements(): Promise<AnnouncementRow[]> {
  const r = await queryPg<AnnouncementRow>(
    `UPDATE announcements
     SET status = 'sent', sent_at = now(), updated_at = now()
     WHERE status = 'pending'
       AND type IN ('comunicado_padres', 'comunicado_institucional')
       AND scheduled_send_at IS NOT NULL
       AND scheduled_send_at <= now()
       AND cancelled_at IS NULL
     RETURNING *`
  );
  return r.rows;
}

export async function cancelComunicadoPending(
  id: string,
  creatorId: string,
  institutionId: string
): Promise<{ ok: boolean; message?: string }> {
  const r = await queryPg<AnnouncementRow>(
    `UPDATE announcements
     SET status = 'cancelled', cancelled_at = now(), updated_at = now()
     WHERE id = $1
       AND institution_id = $2
       AND created_by_id = $3
       AND status = 'pending'
       AND scheduled_send_at > now()
       AND cancelled_at IS NULL
     RETURNING *`,
    [id, institutionId, creatorId]
  );
  if (!r.rows[0]) {
    return { ok: false, message: 'No se puede cancelar (no es tuyo, ya enviado o cancelado).' };
  }
  return { ok: true };
}

export async function findComunicadoById(id: string, institutionId: string): Promise<AnnouncementRow | null> {
  const r = await queryPg<AnnouncementRow>(
    `SELECT * FROM announcements WHERE id = $1 AND institution_id = $2`,
    [id, institutionId]
  );
  return r.rows[0] ?? null;
}

export async function markAnnouncementCorrected(originalId: string, institutionId: string): Promise<void> {
  await queryPg(
    `UPDATE announcements SET corrected_at = now(), updated_at = now()
     WHERE id = $1 AND institution_id = $2`,
    [originalId, institutionId]
  );
}

export async function copyRecipientsToAnnouncement(
  fromAnnouncementId: string,
  toAnnouncementId: string
): Promise<void> {
  await queryPg(
    `INSERT INTO announcement_recipients (announcement_id, user_id)
     SELECT $2, user_id FROM announcement_recipients WHERE announcement_id = $1
     ON CONFLICT (announcement_id, user_id) DO NOTHING`,
    [fromAnnouncementId, toAnnouncementId]
  );
}

export async function markComunicadoRead(announcementId: string, userId: string): Promise<void> {
  await queryPg(
    `INSERT INTO announcement_reads (announcement_id, user_id, read_at)
     VALUES ($1, $2, now())
     ON CONFLICT (announcement_id, user_id) DO NOTHING`,
    [announcementId, userId]
  );
}

async function loadParentRepliesMap(announcementIds: string[]): Promise<Record<string, ParentReplyEnriched[]>> {
  if (announcementIds.length === 0) return {};
  const r = await queryPg<{
    id: string;
    announcement_id: string;
    content: string;
    created_at: string;
    sender_id: string;
    parent_display_name: string;
    linked_student_names: string | null;
  }>(
    `SELECT m.id,
            m.announcement_id,
            m.content,
            m.created_at,
            m.sender_id,
            COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(TRIM(p.email), ''), p.id::text) AS parent_display_name,
            COALESCE(
              (
                SELECT string_agg(sub.sn, ' · ' ORDER BY sub.sn)
                FROM (
                  SELECT DISTINCT COALESCE(NULLIF(TRIM(st2.full_name), ''), NULLIF(TRIM(st2.email), ''), st2.id::text) AS sn
                  FROM enrollments e2
                  INNER JOIN guardian_students gs2
                    ON gs2.student_id = e2.student_id
                   AND gs2.guardian_id = m.sender_id
                   AND gs2.institution_id = a.institution_id
                  INNER JOIN users st2 ON st2.id = e2.student_id
                  WHERE e2.group_id = COALESCE(gs_join.group_id, a.group_id)
                ) sub
              ),
              (
                SELECT string_agg(sub2.sn, ' · ' ORDER BY sub2.sn)
                FROM (
                  SELECT DISTINCT COALESCE(NULLIF(TRIM(st3.full_name), ''), NULLIF(TRIM(st3.email), ''), st3.id::text) AS sn
                  FROM guardian_students gs3
                  INNER JOIN users st3 ON st3.id = gs3.student_id
                  WHERE gs3.guardian_id = m.sender_id
                    AND gs3.institution_id = a.institution_id
                ) sub2
              )
            ) AS linked_student_names
     FROM announcement_messages m
     INNER JOIN announcements a ON a.id = m.announcement_id
     LEFT JOIN group_subjects gs_join ON gs_join.id = a.group_subject_id
     INNER JOIN users p ON p.id = m.sender_id
     WHERE m.announcement_id = ANY($1::uuid[])
       AND m.sender_role = 'padre'
     ORDER BY m.created_at ASC`,
    [announcementIds]
  );
  const out: Record<string, ParentReplyEnriched[]> = {};
  for (const row of r.rows) {
    if (!out[row.announcement_id]) out[row.announcement_id] = [];
    out[row.announcement_id].push({
      id: row.id,
      content: row.content,
      created_at: row.created_at,
      sender_id: row.sender_id,
      parent_display_name: row.parent_display_name,
      linked_student_names: row.linked_student_names,
    });
  }
  return out;
}

function baseComunicadoPadresWhere(groupSubjectId: string | null, institutionId: string): {
  sql: string;
  params: unknown[];
} {
  if (groupSubjectId) {
    return {
      sql: `a.institution_id = $1 AND a.type = 'comunicado_padres' AND a.group_subject_id = $2`,
      params: [institutionId, groupSubjectId],
    };
  }
  return {
    sql: `a.institution_id = $1 AND a.type = 'comunicado_padres'`,
    params: [institutionId],
  };
}

export async function listComunicadosPadresForStaff(
  institutionId: string,
  groupSubjectId: string
): Promise<ComunicadoPadresListItem[]> {
  const { sql, params } = baseComunicadoPadresWhere(groupSubjectId, institutionId);
  const r = await queryPg<ComunicadoPadresListItem>(
    `SELECT a.*,
      COALESCE(gs.display_name, s.name) AS subject_name,
      g.name AS group_name,
      u.full_name AS author_name,
      u.role AS author_role,
      (SELECT COUNT(*)::int FROM announcement_reads ar WHERE ar.announcement_id = a.id) AS reads_count,
      (SELECT COUNT(*)::int FROM announcement_recipients ar2 WHERE ar2.announcement_id = a.id) AS total_recipients,
      EXISTS (SELECT 1 FROM announcements ch WHERE ch.correction_of = a.id) AS has_correction,
      (SELECT COUNT(*)::int FROM announcement_messages am
        WHERE am.announcement_id = a.id AND am.sender_role = 'padre') AS replies_count
     FROM announcements a
     LEFT JOIN group_subjects gs ON gs.id = a.group_subject_id
     LEFT JOIN subjects s ON s.id = gs.subject_id
     LEFT JOIN groups g ON g.id = gs.group_id
     LEFT JOIN users u ON u.id = a.created_by_id
     WHERE ${sql}
     ORDER BY a.created_at DESC`,
    params
  );
  const ids = r.rows.map((x: ComunicadoPadresListItem) => x.id);
  const replies = await loadParentRepliesMap(ids);
  return r.rows.map((row: ComunicadoPadresListItem) => ({
    ...row,
    parent_replies: replies[row.id] ?? [],
  }));
}

export async function listComunicadosPadresForPadre(
  institutionId: string,
  padreUserId: string
): Promise<ComunicadoPadresListItem[]> {
  const r = await queryPg<ComunicadoPadresListItem>(
    `SELECT a.*,
      COALESCE(gs.display_name, s.name) AS subject_name,
      g.name AS group_name,
      u.full_name AS author_name,
      u.role AS author_role,
      (SELECT COUNT(*)::int FROM announcement_reads ar WHERE ar.announcement_id = a.id) AS reads_count,
      (SELECT COUNT(*)::int FROM announcement_recipients ar2 WHERE ar2.announcement_id = a.id) AS total_recipients,
      EXISTS (SELECT 1 FROM announcements ch WHERE ch.correction_of = a.id) AS has_correction,
      (SELECT r.last_read_at FROM evo_thread_reads r WHERE r.user_id = a.created_by_id AND r.announcement_id = a.id) AS staff_last_read_at,
      EXISTS (SELECT 1 FROM announcement_reads ar0 WHERE ar0.announcement_id = a.id AND ar0.user_id = $2) AS is_read,
      (SELECT COUNT(*)::int FROM announcement_messages am
        WHERE am.announcement_id = a.id AND am.sender_role = 'padre') AS replies_count
     FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2
     LEFT JOIN group_subjects gs ON gs.id = a.group_subject_id
     LEFT JOIN subjects s ON s.id = gs.subject_id
     LEFT JOIN groups g ON g.id = gs.group_id
     LEFT JOIN users u ON u.id = a.created_by_id
     WHERE a.institution_id = $1 AND a.type = 'comunicado_padres'
     ORDER BY a.created_at DESC`,
    [institutionId, padreUserId]
  );
  const ids = r.rows.map((x: ComunicadoPadresListItem) => x.id);
  const replies = await loadParentRepliesMap(ids);
  return r.rows.map((row: ComunicadoPadresListItem) => ({
    ...row,
    parent_replies: replies[row.id] ?? [],
  }));
}

export async function listUnreadComunicadosPadresForPadre(
  institutionId: string,
  padreUserId: string,
  limit: number
): Promise<ComunicadoPadresListItem[]> {
  const r = await queryPg<ComunicadoPadresListItem>(
    `SELECT a.*,
      COALESCE(gs.display_name, s.name) AS subject_name,
      g.name AS group_name,
      u.full_name AS author_name,
      u.role AS author_role,
      (SELECT COUNT(*)::int FROM announcement_reads ar WHERE ar.announcement_id = a.id) AS reads_count,
      (SELECT COUNT(*)::int FROM announcement_recipients ar2 WHERE ar2.announcement_id = a.id) AS total_recipients,
      EXISTS (SELECT 1 FROM announcements ch WHERE ch.correction_of = a.id) AS has_correction,
      (SELECT COUNT(*)::int FROM announcement_messages am
        WHERE am.announcement_id = a.id AND am.sender_role = 'padre') AS replies_count
     FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2
     LEFT JOIN group_subjects gs ON gs.id = a.group_subject_id
     LEFT JOIN subjects s ON s.id = gs.subject_id
     LEFT JOIN groups g ON g.id = gs.group_id
     LEFT JOIN users u ON u.id = a.created_by_id
     WHERE a.institution_id = $1 AND a.type = 'comunicado_padres'
       AND a.status = 'sent'
       AND NOT EXISTS (
         SELECT 1 FROM announcement_reads arx
         WHERE arx.announcement_id = a.id AND arx.user_id = $2
       )
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [institutionId, padreUserId, limit]
  );
  const ids = r.rows.map((x: ComunicadoPadresListItem) => x.id);
  const replies = await loadParentRepliesMap(ids);
  return r.rows.map((row: ComunicadoPadresListItem) => ({
    ...row,
    parent_replies: replies[row.id] ?? [],
  }));
}

export async function countUnreadComunicadosPadresForPadre(
  institutionId: string,
  padreUserId: string
): Promise<number> {
  const r = await queryPg<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2
     WHERE a.institution_id = $1 AND a.type = 'comunicado_padres'
       AND a.status = 'sent'
       AND NOT EXISTS (
         SELECT 1 FROM announcement_reads arx
         WHERE arx.announcement_id = a.id AND arx.user_id = $2
       )`,
    [institutionId, padreUserId]
  );
  return parseInt(r.rows[0]?.c ?? '0', 10) || 0;
}

/** Por curso: pendientes de envío + comunicados enviados donde falta lectura de algún padre. */
export async function statsComunicadosPadresByGroupSubject(
  institutionId: string,
  groupSubjectIds: string[]
): Promise<Record<string, { pending: number; awaiting_read: number }>> {
  const out: Record<string, { pending: number; awaiting_read: number }> = {};
  for (const id of groupSubjectIds) {
    out[id] = { pending: 0, awaiting_read: 0 };
  }
  if (groupSubjectIds.length === 0) return out;

  const pending = await queryPg<{ group_subject_id: string; c: string }>(
    `SELECT group_subject_id::text, COUNT(*)::text AS c
     FROM announcements
     WHERE institution_id = $1
       AND type = 'comunicado_padres'
       AND status = 'pending'
       AND group_subject_id = ANY($2::uuid[])
     GROUP BY group_subject_id`,
    [institutionId, groupSubjectIds]
  );
  for (const row of pending.rows) {
    if (row.group_subject_id && out[row.group_subject_id]) {
      out[row.group_subject_id].pending = parseInt(row.c, 10) || 0;
    }
  }

  const awaiting = await queryPg<{ group_subject_id: string; c: string }>(
    `SELECT a.group_subject_id::text, COUNT(*)::text AS c
     FROM announcements a
     WHERE a.institution_id = $1
       AND a.type = 'comunicado_padres'
       AND a.status = 'sent'
       AND a.group_subject_id = ANY($2::uuid[])
       AND EXISTS (
         SELECT 1 FROM announcement_recipients ar
         WHERE ar.announcement_id = a.id
           AND NOT EXISTS (
             SELECT 1 FROM announcement_reads arx
             WHERE arx.announcement_id = a.id AND arx.user_id = ar.user_id
           )
       )
     GROUP BY a.group_subject_id`,
    [institutionId, groupSubjectIds]
  );
  for (const row of awaiting.rows) {
    if (row.group_subject_id && out[row.group_subject_id]) {
      out[row.group_subject_id].awaiting_read = parseInt(row.c, 10) || 0;
    }
  }

  return out;
}

/** Mensajes de padres (entrantes) no leídos por el docente/staff, por materia–curso. No cuenta envíos del profesor. */
export async function countUnreadParentMessagesByGroupSubjectForUser(
  institutionId: string,
  viewerUserId: string,
  groupSubjectIds: string[]
): Promise<Record<string, number>> {
  await ensureEvoSendSupportAndReads();
  const out: Record<string, number> = {};
  for (const id of groupSubjectIds) out[id] = 0;
  if (groupSubjectIds.length === 0) return out;

  const r = await queryPg<{ group_subject_id: string; c: string }>(
    `SELECT a.group_subject_id::text, COUNT(m.id)::text AS c
     FROM announcement_messages m
     INNER JOIN announcements a ON a.id = m.announcement_id
     LEFT JOIN evo_thread_reads r ON r.announcement_id = m.announcement_id AND r.user_id = $2::uuid
     WHERE a.institution_id = $1::uuid
       AND a.type = 'comunicado_padres'
       AND a.group_subject_id = ANY($3::uuid[])
       AND m.sender_role = 'padre'
       AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
     GROUP BY a.group_subject_id`,
    [institutionId, viewerUserId, groupSubjectIds]
  );
  for (const row of r.rows) {
    if (row.group_subject_id && out[row.group_subject_id] !== undefined) {
      out[row.group_subject_id] = parseInt(row.c, 10) || 0;
    }
  }
  return out;
}

/** Marca todos los hilos de comunicados a padres de esa materia como vistos por el usuario (actualiza last_read_at). */
export async function markComunicadosPadresThreadsReadForGroupSubject(
  institutionId: string,
  viewerUserId: string,
  groupSubjectId: string
): Promise<void> {
  await ensureEvoSendSupportAndReads();
  await queryPg(
    `INSERT INTO evo_thread_reads (user_id, announcement_id, last_read_at)
     SELECT $1::uuid, a.id, now()
     FROM announcements a
     WHERE a.institution_id = $2::uuid
       AND a.type = 'comunicado_padres'
       AND a.group_subject_id = $3::uuid
     ON CONFLICT (user_id, announcement_id) DO UPDATE SET last_read_at = now()`,
    [viewerUserId, institutionId, groupSubjectId]
  );
}

export async function countPendingParentRepliesForTeacher(
  institutionId: string,
  teacherId: string,
  groupSubjectIds: string[]
): Promise<number> {
  if (groupSubjectIds.length === 0) return 0;
  const r = await queryPg<{ c: string }>(
    `SELECT COUNT(DISTINCT am.id)::text AS c
     FROM announcement_messages am
     JOIN announcements a ON a.id = am.announcement_id
     WHERE a.institution_id = $1
       AND a.type = 'comunicado_padres'
       AND a.group_subject_id = ANY($3::uuid[])
       AND a.created_by_id = $2
       AND am.sender_role = 'padre'`,
    [institutionId, teacherId, groupSubjectIds]
  );
  return parseInt(r.rows[0]?.c ?? '0', 10) || 0;
}

export async function listInstitucionalComunicados(
  institutionId: string,
  opts: {
    viewerUserId: string;
    category?: string | null;
    asPublisher: boolean;
  }
): Promise<InstitucionalListItem[]> {
  const { viewerUserId, category, asPublisher } = opts;
  let q: string;
  const params: unknown[] = [institutionId];

  if (asPublisher) {
    q = `
     SELECT a.*,
      u.full_name AS author_name,
      u.role AS author_role,
      (SELECT COUNT(*)::int FROM announcement_reads ar WHERE ar.announcement_id = a.id) AS reads_count,
      (SELECT COUNT(*)::int FROM announcement_recipients ar2 WHERE ar2.announcement_id = a.id) AS total_recipients,
      EXISTS (SELECT 1 FROM announcements ch WHERE ch.correction_of = a.id) AS has_correction
     FROM announcements a
     LEFT JOIN users u ON u.id = a.created_by_id
     WHERE a.institution_id = $1 AND a.type = 'comunicado_institucional'`;
    if (category && category !== 'all') {
      params.push(category);
      q += ` AND a.category = $${params.length}`;
    }
    q += ` ORDER BY a.created_at DESC`;
  } else {
    params.push(viewerUserId);
    q = `
     SELECT a.*,
      u.full_name AS author_name,
      u.role AS author_role,
      (SELECT COUNT(*)::int FROM announcement_reads ar WHERE ar.announcement_id = a.id) AS reads_count,
      (SELECT COUNT(*)::int FROM announcement_recipients ar2 WHERE ar2.announcement_id = a.id) AS total_recipients,
      EXISTS (SELECT 1 FROM announcements ch WHERE ch.correction_of = a.id) AS has_correction
     FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2
     LEFT JOIN users u ON u.id = a.created_by_id
     WHERE a.institution_id = $1 AND a.type = 'comunicado_institucional'`;
    if (category && category !== 'all') {
      params.push(category);
      q += ` AND a.category = $${params.length}`;
    }
    q += ` ORDER BY a.created_at DESC`;
  }

  const r = await queryPg<InstitucionalListItem>(q, params);
  return r.rows;
}

export async function countInstitucionalByCategory(
  institutionId: string,
  asPublisher: boolean,
  viewerUserId: string
): Promise<Record<string, number>> {
  const cats = ['general', 'circular', 'evento', 'calendario', 'aviso'];
  const out: Record<string, number> = { all: 0 };
  for (const c of cats) out[c] = 0;

  let base: string;
  const params: unknown[] = [institutionId];
  if (asPublisher) {
    base = `FROM announcements a WHERE a.institution_id = $1 AND a.type = 'comunicado_institucional'`;
  } else {
    params.push(viewerUserId);
    base = `FROM announcements a
      INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2
      WHERE a.institution_id = $1 AND a.type = 'comunicado_institucional'`;
  }

  const total = await queryPg<{ c: string }>(`SELECT COUNT(*)::text AS c ${base}`, params);
  out.all = parseInt(total.rows[0]?.c ?? '0', 10) || 0;

  const byCat = await queryPg<{ category: string; c: string }>(
    `SELECT COALESCE(a.category, 'general') AS category, COUNT(*)::text AS c ${base} GROUP BY COALESCE(a.category, 'general')`,
    params
  );
  for (const row of byCat.rows) {
    if (row.category && row.category in out) {
      out[row.category] = parseInt(row.c, 10) || 0;
    }
  }

  return out;
}

export async function countInstitucionalThisMonth(institutionId: string): Promise<number> {
  const r = await queryPg<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM announcements
     WHERE institution_id = $1 AND type = 'comunicado_institucional'
       AND created_at >= date_trunc('month', now())`,
    [institutionId]
  );
  return parseInt(r.rows[0]?.c ?? '0', 10) || 0;
}

export async function lastInstitucionalTitle(institutionId: string): Promise<string | null> {
  const r = await queryPg<{ title: string }>(
    `SELECT title FROM announcements
     WHERE institution_id = $1 AND type = 'comunicado_institucional'
     ORDER BY created_at DESC LIMIT 1`,
    [institutionId]
  );
  return r.rows[0]?.title ?? null;
}

export async function countUnreadInstitucionalForUser(
  institutionId: string,
  userId: string
): Promise<number> {
  const r = await queryPg<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $2
     WHERE a.institution_id = $1 AND a.type = 'comunicado_institucional'
       AND a.status = 'sent'
       AND NOT EXISTS (
         SELECT 1 FROM announcement_reads arx
         WHERE arx.announcement_id = a.id AND arx.user_id = $2
       )`,
    [institutionId, userId]
  );
  return parseInt(r.rows[0]?.c ?? '0', 10) || 0;
}

export async function resolveInstitutionalRecipientIds(
  institutionId: string,
  audience: 'all' | 'parents' | 'teachers' | 'staff'
): Promise<string[]> {
  if (audience === 'all') {
    const r = await queryPg<{ id: string }>(
      `SELECT id FROM users WHERE institution_id = $1`,
      [institutionId]
    );
    return r.rows.map((x: { id: string }) => x.id);
  }
  if (audience === 'parents') {
    const r = await queryPg<{ id: string }>(
      `SELECT id FROM users WHERE institution_id = $1 AND role = 'padre'`,
      [institutionId]
    );
    return r.rows.map((x: { id: string }) => x.id);
  }
  if (audience === 'teachers') {
    const r = await queryPg<{ id: string }>(
      `SELECT id FROM users WHERE institution_id = $1 AND role = 'profesor'`,
      [institutionId]
    );
    return r.rows.map((x: { id: string }) => x.id);
  }
  const staffRoles = [
    'directivo',
    'asistente',
    'admin-general-colegio',
    'school_admin',
    'transporte',
    'tesoreria',
    'nutricion',
    'cafeteria',
    'administrador-general',
    'rector',
  ];
  const r = await queryPg<{ id: string }>(
    `SELECT id FROM users WHERE institution_id = $1 AND role = ANY($2::text[])`,
    [institutionId, staffRoles]
  );
  return r.rows.map((x: { id: string }) => x.id);
}

export async function getReadDetailForComunicado(
  announcementId: string,
  institutionId: string
): Promise<{ user_id: string; full_name: string; read_at: string | null }[]> {
  const r = await queryPg<{ user_id: string; full_name: string; read_at: string | null }>(
    `SELECT ar.user_id, u.full_name,
            rd.read_at
     FROM announcement_recipients ar
     JOIN users u ON u.id = ar.user_id
     LEFT JOIN announcement_reads rd ON rd.announcement_id = ar.announcement_id AND rd.user_id = ar.user_id
     WHERE ar.announcement_id = $1
       AND EXISTS (SELECT 1 FROM announcements a WHERE a.id = ar.announcement_id AND a.institution_id = $2)
     ORDER BY u.full_name`,
    [announcementId, institutionId]
  );
  return r.rows;
}
