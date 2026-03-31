import { queryPg } from '../config/db-pg.js';

export interface AnnouncementRow {
  id: string;
  institution_id: string;
  title: string;
  body: string | null;
  type: string;
  group_id: string | null;
  group_subject_id: string | null;
  assignment_id: string | null;
  created_by_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  support_staff_id?: string | null;
  status?: string | null;
  scheduled_send_at?: string | null;
  sent_at?: string | null;
  cancelled_at?: string | null;
  corrected_at?: string | null;
  correction_of?: string | null;
  audience?: string | null;
  category?: string | null;
  priority?: string | null;
  attachments_json?: unknown;
}

export interface AnnouncementMessageRow {
  id: string;
  announcement_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  content_type: string;
  priority: string;
  created_at: string;
}

export async function findAnnouncementsByInstitution(
  institutionId: string,
  opts?: { groupId?: string; type?: string }
): Promise<AnnouncementRow[]> {
  let q = 'SELECT * FROM announcements WHERE institution_id = $1';
  const params: unknown[] = [institutionId];
  let i = 2;
  if (opts?.groupId) {
    q += ` AND (group_id = $${i} OR group_id IS NULL)`;
    params.push(opts.groupId);
    i++;
  }
  if (opts?.type) {
    q += ` AND type = $${i}`;
    params.push(opts.type);
  }
  q += ' ORDER BY created_at DESC';
  const r = await queryPg<AnnouncementRow>(q, params);
  return r.rows;
}

/** Feed de Comunicación Académica: nuevas tareas, notas, etc. */
export async function findAcademicFeedAnnouncements(
  institutionId: string,
  opts?: { groupSubjectIds?: string[] }
): Promise<AnnouncementRow[]> {
  let q = `SELECT * FROM announcements
    WHERE institution_id = $1 AND type IN ('nueva_asignacion', 'nueva_nota', 'mensaje_academico')`;
  const params: unknown[] = [institutionId];
  let i = 2;
  if (opts?.groupSubjectIds?.length) {
    q += ` AND group_subject_id = ANY($${i}::uuid[])`;
    params.push(opts.groupSubjectIds);
    i++;
  }
  q += ' ORDER BY created_at DESC LIMIT 100';
  const r = await queryPg<AnnouncementRow>(q, params);
  return r.rows;
}

export interface AcademicFeedItem extends AnnouncementRow {
  subject_name: string | null;
  group_name: string | null;
}

/** Feed académico con nombre de materia y grupo para la UI. */
export async function findAcademicFeedWithDetails(
  institutionId: string,
  opts?: { groupSubjectIds?: string[] }
): Promise<AcademicFeedItem[]> {
  let q = `
    SELECT a.*, COALESCE(gs.display_name, s.name) AS subject_name, g.name AS group_name
    FROM announcements a
    LEFT JOIN group_subjects gs ON gs.id = a.group_subject_id
    LEFT JOIN subjects s ON s.id = gs.subject_id
    LEFT JOIN groups g ON g.id = gs.group_id
    WHERE a.institution_id = $1 AND a.type IN ('nueva_asignacion', 'nueva_nota', 'mensaje_academico')`;
  const params: unknown[] = [institutionId];
  let i = 2;
  if (opts?.groupSubjectIds?.length) {
    q += ` AND a.group_subject_id = ANY($${i}::uuid[])`;
    params.push(opts.groupSubjectIds);
    i++;
  }
  q += ' ORDER BY a.created_at DESC LIMIT 100';
  const r = await queryPg<AcademicFeedItem>(q, params);
  return r.rows;
}

export async function findAnnouncementById(id: string): Promise<AnnouncementRow | null> {
  const r = await queryPg<AnnouncementRow>(
    'SELECT * FROM announcements WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findAnnouncementByGroupSubjectId(groupSubjectId: string): Promise<AnnouncementRow | null> {
  const r = await queryPg<AnnouncementRow>(
    'SELECT * FROM announcements WHERE group_subject_id = $1 AND type = $2 LIMIT 1',
    [groupSubjectId, 'evo_chat']
  );
  return r.rows[0] ?? null;
}

/** Find announcement by institution, title and type (for staff/direct threads, avoid duplicates). */
export async function findAnnouncementByInstitutionTitleAndType(
  institutionId: string,
  title: string,
  type: string
): Promise<AnnouncementRow | null> {
  const r = await queryPg<AnnouncementRow>(
    'SELECT * FROM announcements WHERE institution_id = $1 AND title = $2 AND type = $3 LIMIT 1',
    [institutionId, title, type]
  );
  return r.rows[0] ?? null;
}

/** Add recipients to an announcement (idempotent: ignores duplicates). */
export async function addAnnouncementRecipients(announcementId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await queryPg(
    `INSERT INTO announcement_recipients (announcement_id, user_id)
     SELECT $1, unnest($2::uuid[])
     ON CONFLICT (announcement_id, user_id) DO NOTHING`,
    [announcementId, userIds]
  );
}

/** Find announcements where user is in announcement_recipients and type in given types. */
export async function findAnnouncementsByRecipient(
  userId: string,
  types: string[],
  institutionId: string
): Promise<AnnouncementRow[]> {
  if (types.length === 0) return [];
  const r = await queryPg<AnnouncementRow>(
    `SELECT a.* FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $1
     WHERE a.institution_id = $2 AND a.type = ANY($3::text[])
     ORDER BY a.updated_at DESC`,
    [userId, institutionId, types]
  );
  return r.rows;
}

/** Find evo_chat_direct thread between two users in the same institution. */
export async function findDirectThreadBetweenUsers(
  user1Id: string,
  user2Id: string,
  institutionId: string
): Promise<AnnouncementRow | null> {
  const r = await queryPg<AnnouncementRow>(
    `SELECT a.* FROM announcements a
     INNER JOIN announcement_recipients r1 ON r1.announcement_id = a.id AND r1.user_id = $1
     INNER JOIN announcement_recipients r2 ON r2.announcement_id = a.id AND r2.user_id = $2
     WHERE a.institution_id = $3 AND a.type = 'evo_chat_direct' LIMIT 1`,
    [user1Id, user2Id, institutionId]
  );
  return r.rows[0] ?? null;
}

/** Hilo Evo Send familia: estudiante + todos los acudientes vinculados (un hilo por estudiante). */
export async function findFamilyEvoThreadForStudent(
  studentId: string,
  institutionId: string
): Promise<AnnouncementRow | null> {
  const r = await queryPg<AnnouncementRow>(
    `SELECT a.* FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $1
     WHERE a.institution_id = $2 AND a.type = 'evo_chat_family'
     ORDER BY a.created_at ASC
     LIMIT 1`,
    [studentId, institutionId]
  );
  return r.rows[0] ?? null;
}

/**
 * Crea o devuelve el chat familia del estudiante y sincroniza acudientes en `announcement_recipients`.
 * Usa `users.institution_id` del estudiante y todas las filas de `guardian_students` para ese alumno
 * (sin exigir coincidencia en `guardian_students.institution_id`), alineado con GET /api/users/me/hijos.
 */
export async function findOrCreateFamilyEvoThread(studentId: string): Promise<AnnouncementRow | null> {
  const su = await queryPg<{ institution_id: string; role: string; full_name: string }>(
    'SELECT institution_id, role, full_name FROM users WHERE id = $1 LIMIT 1',
    [studentId]
  );
  const studentRow = su.rows[0];
  if (!studentRow || studentRow.role !== 'estudiante') return null;

  const institutionId = studentRow.institution_id;

  const guardians = await queryPg<{ guardian_id: string }>(
    `SELECT guardian_id FROM guardian_students WHERE student_id = $1`,
    [studentId]
  );
  if (guardians.rows.length === 0) return null;

  const studentName = studentRow.full_name?.trim() || 'Estudiante';
  const title = `Familia · ${studentName}`;

  let ann = await findFamilyEvoThreadForStudent(studentId, institutionId);
  if (!ann) {
    const createdBy = guardians.rows[0]!.guardian_id;
    ann = await createAnnouncement({
      institution_id: institutionId,
      title,
      body: 'Mensajes entre acudientes y estudiante.',
      type: 'evo_chat_family',
      group_id: null,
      created_by_id: createdBy,
    });
    const allIds = [studentId, ...guardians.rows.map((g) => g.guardian_id)];
    await addAnnouncementRecipients(ann.id, [...new Set(allIds)]);
  } else {
    const allIds = [studentId, ...guardians.rows.map((g) => g.guardian_id)];
    await addAnnouncementRecipients(ann.id, [...new Set(allIds)]);
  }
  return ann;
}

/** Check if user is a recipient of the announcement (for staff/direct/support access). */
export async function isUserRecipientOfAnnouncement(announcementId: string, userId: string): Promise<boolean> {
  const r = await queryPg<{ n: number }>(
    'SELECT 1 AS n FROM announcement_recipients WHERE announcement_id = $1 AND user_id = $2 LIMIT 1',
    [announcementId, userId]
  );
  return r.rows.length > 0;
}

/** Legacy: primer hilo soporte sin pareja 1-1 (solo admins). */
export async function findSupportThreadByInstitution(institutionId: string): Promise<AnnouncementRow | null> {
  const r = await queryPg<AnnouncementRow>(
    `SELECT * FROM announcements WHERE institution_id = $1 AND type = 'evo_chat_support' AND support_staff_id IS NULL ORDER BY created_at ASC LIMIT 1`,
    [institutionId]
  );
  return r.rows[0] ?? null;
}

export async function findOrCreateSupportThreadOneToOne(
  institutionId: string,
  staffUserId: string,
  staffDisplayName: string,
  adminUserIds: string[],
  createdByAdminId: string
): Promise<AnnouncementRow> {
  const { ensureEvoSendSupportAndReads } = await import('../db/pgSchemaPatches.js');
  await ensureEvoSendSupportAndReads();
  if (adminUserIds.length === 0) throw new Error('Sin administrador GLC en la institución');
  const existing = await queryPg<AnnouncementRow>(
    `SELECT * FROM announcements WHERE institution_id = $1 AND type = 'evo_chat_support' AND support_staff_id = $2 LIMIT 1`,
    [institutionId, staffUserId]
  );
  if (existing.rows[0]) {
    await addAnnouncementRecipients(existing.rows[0].id, [staffUserId, ...adminUserIds]);
    return existing.rows[0];
  }
  const title = `Soporte · ${staffDisplayName.slice(0, 80)}`;
  const ins = await queryPg<AnnouncementRow>(
    `INSERT INTO announcements (institution_id, title, body, type, group_id, group_subject_id, created_by_id, published_at, support_staff_id)
     VALUES ($1, $2, NULL, 'evo_chat_support', NULL, NULL, $3, now(), $4) RETURNING *`,
    [institutionId, title, createdByAdminId, staffUserId]
  );
  const row = ins.rows[0];
  if (!row) throw new Error('No se creó hilo de soporte');
  await addAnnouncementRecipients(row.id, [staffUserId, ...adminUserIds]);
  return row;
}

export async function countUnreadMessagesForUser(announcementId: string, userId: string): Promise<number> {
  const { ensureEvoSendSupportAndReads } = await import('../db/pgSchemaPatches.js');
  await ensureEvoSendSupportAndReads();
  const r = await queryPg<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM announcement_messages m
     WHERE m.announcement_id = $1 AND m.sender_id::text <> $2::text
     AND m.created_at > COALESCE(
       (SELECT last_read_at FROM evo_thread_reads WHERE user_id = $2::uuid AND announcement_id = $1::uuid),
       '1970-01-01'::timestamptz
     )`,
    [announcementId, userId]
  );
  return parseInt(r.rows[0]?.c ?? '0', 10) || 0;
}

export async function markEvoThreadRead(userId: string, announcementId: string): Promise<void> {
  const { ensureEvoSendSupportAndReads } = await import('../db/pgSchemaPatches.js');
  await ensureEvoSendSupportAndReads();
  await queryPg(
    `INSERT INTO evo_thread_reads (user_id, announcement_id, last_read_at)
     VALUES ($1::uuid, $2::uuid, now())
     ON CONFLICT (user_id, announcement_id) DO UPDATE SET last_read_at = now()`,
    [userId, announcementId]
  );
}

/** Mapa announcement_id → cantidad de mensajes no leídos (otros remitentes desde last_read). */
export async function countUnreadByThreadIds(
  announcementIds: string[],
  userId: string
): Promise<Record<string, number>> {
  if (announcementIds.length === 0) return {};
  const { ensureEvoSendSupportAndReads } = await import('../db/pgSchemaPatches.js');
  await ensureEvoSendSupportAndReads();
  const r = await queryPg<{ announcement_id: string; c: string }>(
    `SELECT m.announcement_id, COUNT(*)::text AS c
     FROM announcement_messages m
     LEFT JOIN evo_thread_reads r ON r.announcement_id = m.announcement_id AND r.user_id = $2::uuid
     WHERE m.announcement_id = ANY($1::uuid[])
       AND m.sender_id::text <> $2::text
       AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
     GROUP BY m.announcement_id`,
    [announcementIds, userId]
  );
  const out: Record<string, number> = {};
  for (const row of r.rows) {
    out[row.announcement_id] = parseInt(row.c, 10) || 0;
  }
  return out;
}

/** Get or create the Evo Send chat thread for a group_subject (curso + materia). @deprecated usar findOrCreateEvoChatForGroupTeacher para un chat por curso */
export async function findOrCreateEvoChatForGroupSubject(
  groupSubjectId: string,
  institutionId: string,
  title: string,
  createdById: string,
  groupId: string
): Promise<AnnouncementRow> {
  const existing = await findAnnouncementByGroupSubjectId(groupSubjectId);
  if (existing) return existing;
  return createAnnouncement({
    institution_id: institutionId,
    title,
    body: null,
    type: 'evo_chat',
    group_id: groupId,
    group_subject_id: groupSubjectId,
    created_by_id: createdById,
  });
}

/** Un solo chat Evo Send por curso (grupo) y profesor — todas las materias comparten el mismo hilo. */
export async function findOrCreateEvoChatForGroupTeacher(
  groupId: string,
  institutionId: string,
  title: string,
  teacherId: string
): Promise<AnnouncementRow> {
  const { ensureEvoChatGroupTeacherUniqueIndex } = await import('../db/pgSchemaPatches.js');
  await ensureEvoChatGroupTeacherUniqueIndex();
  const sel = await queryPg<AnnouncementRow>(
    `SELECT * FROM announcements
     WHERE institution_id = $1 AND type = 'evo_chat' AND group_id = $2
       AND created_by_id = $3 AND group_subject_id IS NULL
     LIMIT 1`,
    [institutionId, groupId, teacherId]
  );
  if (sel.rows[0]) return sel.rows[0];
  try {
    return await createAnnouncement({
      institution_id: institutionId,
      title,
      body: null,
      type: 'evo_chat',
      group_id: groupId,
      group_subject_id: null,
      created_by_id: teacherId,
    });
  } catch {
    const again = await queryPg<AnnouncementRow>(
      `SELECT * FROM announcements
       WHERE institution_id = $1 AND type = 'evo_chat' AND group_id = $2
         AND created_by_id = $3 AND group_subject_id IS NULL
       LIMIT 1`,
      [institutionId, groupId, teacherId]
    );
    if (again.rows[0]) return again.rows[0];
    throw new Error('No se pudo crear u obtener el chat del curso');
  }
}

export async function findAnnouncementMessages(announcementId: string): Promise<AnnouncementMessageRow[]> {
  const r = await queryPg<AnnouncementMessageRow>(
    'SELECT * FROM announcement_messages WHERE announcement_id = $1 ORDER BY created_at',
    [announcementId]
  );
  return r.rows;
}

export async function getLastAnnouncementMessage(announcementId: string): Promise<AnnouncementMessageRow | null> {
  const r = await queryPg<AnnouncementMessageRow>(
    'SELECT * FROM announcement_messages WHERE announcement_id = $1 ORDER BY created_at DESC LIMIT 1',
    [announcementId]
  );
  return r.rows[0] ?? null;
}

export async function createAnnouncement(row: {
  institution_id: string;
  title: string;
  body?: string | null;
  type?: string;
  group_id?: string | null;
  group_subject_id?: string | null;
  assignment_id?: string | null;
  created_by_id: string;
}): Promise<AnnouncementRow> {
  const r = await queryPg<AnnouncementRow>(
    `INSERT INTO announcements (institution_id, title, body, type, group_id, group_subject_id, assignment_id, created_by_id, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) RETURNING *`,
    [
      row.institution_id,
      row.title,
      row.body ?? null,
      row.type ?? 'general',
      row.group_id ?? null,
      row.group_subject_id ?? null,
      row.assignment_id ?? null,
      row.created_by_id,
    ]
  );
  const inserted = r.rows[0];
  if (!inserted) throw new Error('El anuncio no se creó (sin fila devuelta)');
  return inserted;
}

export async function createAnnouncementMessage(row: {
  announcement_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  content_type?: string;
  priority?: string;
}): Promise<AnnouncementMessageRow> {
  const r = await queryPg<AnnouncementMessageRow>(
    `INSERT INTO announcement_messages (announcement_id, sender_id, sender_role, content, content_type, priority)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      row.announcement_id,
      row.sender_id,
      row.sender_role,
      row.content,
      row.content_type ?? 'texto',
      row.priority ?? 'normal',
    ]
  );
  return r.rows[0];
}

/**
 * Elimina un mensaje de EvoSend solo si tiene más de 365 días (política de retención mínima).
 */
export async function deleteAnnouncementMessageIfExpired(
  messageId: string,
  institutionId: string
): Promise<{ deleted: boolean; reason?: string }> {
  const r = await queryPg<{ id: string; created_at: string }>(
    `SELECT m.id, m.created_at FROM announcement_messages m
     WHERE m.id = $1
       AND m.announcement_id IN (
         SELECT id FROM announcements WHERE institution_id = $2
       )
     LIMIT 1`,
    [messageId, institutionId]
  );

  if (!r.rows.length) {
    return { deleted: false, reason: 'Mensaje no encontrado.' };
  }

  const createdAt = new Date(r.rows[0].created_at);
  const now = new Date();
  const diffDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 365) {
    const until = new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1000);
    return {
      deleted: false,
      reason: `El mensaje debe retenerse hasta ${until.toLocaleDateString()}.`,
    };
  }

  await queryPg(`DELETE FROM announcement_messages WHERE id = $1`, [messageId]);

  return { deleted: true };
}
