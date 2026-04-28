import { queryPg } from '../config/db-pg.js';
import { findGroupById } from '../repositories/groupRepository.js';
import {
  findOrCreateEvoChatForGroupSubject,
  findOrCreateParentSubjectEvoThread,
  createAnnouncementMessage,
  addAnnouncementRecipients,
} from '../repositories/announcementRepository.js';
import { findGroupSubjectWithDetailsById } from '../repositories/groupSubjectRepository.js';
import { resolveRecipientsForThread } from './evoSendAccess.js';
import {
  createComunicacionAnnouncement,
  findParentUserIdsForGroupSubject,
} from '../repositories/comunicacionRepository.js';
import { notify } from '../repositories/notificationRepository.js';
import { emitEvoMessageBroadcast } from '../socket.js';
import { findUserById } from '../repositories/userRepository.js';

function truncateText(s: string, max = 240): string {
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

/** Destinatarios del hilo evo_chat (grupo + profesor del group_subject si aplica). */
async function resolveEvoChatRecipients(args: {
  groupId: string;
  groupSubjectId: string | null;
  teacherId: string;
  institutionId: string;
}): Promise<string[]> {
  const r = await queryPg<{ student_id: string }>(
    'SELECT student_id FROM enrollments WHERE group_id = $1',
    [args.groupId]
  );
  const recipientMap: Record<string, true> = {};
  for (const x of r.rows) recipientMap[x.student_id] = true;
  if (args.groupSubjectId) {
    const t = await queryPg<{ teacher_id: string }>(
      'SELECT teacher_id FROM group_subjects WHERE id = $1 AND institution_id = $2 LIMIT 1',
      [args.groupSubjectId, args.institutionId]
    );
    const teacherId = t.rows[0]?.teacher_id;
    if (teacherId) recipientMap[teacherId] = true;
  } else {
    recipientMap[args.teacherId] = true;
  }
  return Object.keys(recipientMap);
}

function adjuntosToComunicadoAttachments(raw: unknown): { name: string; url?: string; source?: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; url?: string; source?: string }[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.nombre === 'string' ? o.nombre.trim() : '';
    const url = typeof o.url === 'string' && o.url.trim() ? o.url.trim() : undefined;
    if (!name && !url) continue;
    out.push({
      name: name || url || 'Adjunto',
      url,
      source: 'tarea',
    });
  }
  return out;
}

const TASK_ACCENT = '#84cc16';

/**
 * Tras crear una tarea (PG): comunicado a padres (categoría tareas) y mensaje EvoSend tipo assignment_reminder en el chat del curso.
 */
export async function runAfterAssignmentCreatedPg(args: {
  assignmentId: string;
  groupSubjectId: string;
  groupId: string;
  institutionId: string;
  teacherId: string;
  title: string;
  description: string;
  dueDateIso: string;
  adjuntosFromBody?: unknown;
}): Promise<void> {
  const {
    assignmentId,
    groupSubjectId,
    groupId,
    institutionId,
    teacherId,
    title,
    description,
    dueDateIso,
    adjuntosFromBody,
  } = args;

  const dueLabel = new Date(dueDateIso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const bodyPadres = `${description}\n\n—\nEntrega: ${dueLabel}`;
  const attachments = adjuntosToComunicadoAttachments(adjuntosFromBody);
  const assignmentReminderMeta = {
    title,
    dueAt: dueDateIso,
    url: `/assignment/${assignmentId}`,
    description: truncateText(description, 420),
    attachments,
    accent: TASK_ACCENT,
  };

  try {
    const parentIds = await findParentUserIdsForGroupSubject(groupSubjectId, institutionId);
    if (parentIds.length > 0) {
      const scheduled = new Date(Date.now() + 30_000).toISOString();
      const createdPadres = await createComunicacionAnnouncement({
        institution_id: institutionId,
        title: `Nueva tarea: ${title}`,
        body: bodyPadres,
        type: 'comunicado_padres',
        group_id: groupId,
        group_subject_id: groupSubjectId,
        created_by_id: teacherId,
        status: 'pending',
        scheduled_send_at: scheduled,
        sent_at: null,
        audience: 'parents',
        category: 'tareas',
        priority: 'normal',
        attachments_json: JSON.stringify(attachments),
        assignment_id: assignmentId,
      });
      await addAnnouncementRecipients(createdPadres.id, parentIds);
    }
  } catch (e: unknown) {
    console.error('[assignmentSideEffects] comunicado padres tarea:', (e as Error).message);
  }

  try {
    const gsMeta = await findGroupSubjectWithDetailsById(groupSubjectId, institutionId);
    const group = await findGroupById(groupId);
    const threadTitle = gsMeta
      ? `${gsMeta.subject_name} · ${gsMeta.group_name}`
      : (group?.name ?? groupId);
    const thread = await findOrCreateEvoChatForGroupSubject(
      groupSubjectId,
      institutionId,
      threadTitle,
      teacherId,
      groupId
    );
    const msg = await createAnnouncementMessage({
      announcement_id: thread.id,
      sender_id: teacherId,
      sender_role: 'profesor',
      content: JSON.stringify(assignmentReminderMeta),
      content_type: 'assignment_reminder',
      priority: 'normal',
    });

    const recipientIds = await resolveEvoChatRecipients({
      groupId,
      groupSubjectId,
      teacherId,
      institutionId,
    });
    const recipientsWithoutSender = recipientIds.filter((rid) => rid !== teacherId);
    await Promise.all(
      recipientsWithoutSender.map(async (rid) => {
        const email = await getUserEmail(rid);
        await notify({
          institution_id: institutionId,
          user_id: rid,
          user_email: email,
          type: 'mensaje',
          entity_type: 'evo_send_thread',
          entity_id: thread.id,
          action_url: `/evo-send?thread=${encodeURIComponent(thread.id)}`,
          title: `EvoSend · ${threadTitle}`,
          body: truncateText(`Nueva tarea: ${title}`),
        });
      })
    );

    const sender = await findUserById(teacherId);
    const participantIds = Array.from(new Set([...recipientIds, teacherId]));
    emitEvoMessageBroadcast(
      thread.id,
      {
        _id: msg.id,
        contenido: msg.content,
        tipo: msg.content_type,
        prioridad: msg.priority,
        fecha: msg.created_at,
        remitenteId: { _id: teacherId, nombre: sender?.full_name ?? '', rol: sender?.role },
        rolRemitente: msg.sender_role,
      },
      participantIds
    );
  } catch (e: unknown) {
    console.error('[assignmentSideEffects] evo send tarea:', (e as Error).message);
  }

  try {
    const parentThread = await findOrCreateParentSubjectEvoThread(groupSubjectId, institutionId);
    const msgPadres = await createAnnouncementMessage({
      announcement_id: parentThread.id,
      sender_id: teacherId,
      sender_role: 'profesor',
      content: JSON.stringify(assignmentReminderMeta),
      content_type: 'assignment_reminder',
      priority: 'normal',
    });

    const recipientIdsPadres = await resolveRecipientsForThread({
      announcement: {
        id: parentThread.id,
        type: parentThread.type,
        group_id: parentThread.group_id,
        group_subject_id: parentThread.group_subject_id,
        created_by_id: parentThread.created_by_id,
      },
      institutionId,
    });
    const recipientsPadresNoProf = recipientIdsPadres.filter((rid) => rid !== teacherId);
    await Promise.all(
      recipientsPadresNoProf.map(async (rid) => {
        const email = await getUserEmail(rid);
        await notify({
          institution_id: institutionId,
          user_id: rid,
          user_email: email,
          type: 'mensaje',
          entity_type: 'evo_send_thread',
          entity_id: parentThread.id,
          action_url: `/evo-send?thread=${encodeURIComponent(parentThread.id)}`,
          title: `EvoSend · ${parentThread.title}`,
          body: truncateText(`Nueva tarea: ${title}`),
        });
      })
    );

    const senderP = await findUserById(teacherId);
    const participantIdsPadres = Array.from(new Set([...recipientIdsPadres, teacherId]));
    emitEvoMessageBroadcast(
      parentThread.id,
      {
        _id: msgPadres.id,
        contenido: msgPadres.content,
        tipo: msgPadres.content_type,
        prioridad: msgPadres.priority,
        fecha: msgPadres.created_at,
        remitenteId: { _id: teacherId, nombre: senderP?.full_name ?? '', rol: senderP?.role },
        rolRemitente: msgPadres.sender_role,
      },
      participantIdsPadres
    );
  } catch (e: unknown) {
    console.error('[assignmentSideEffects] evo send tarea (padres):', (e as Error).message);
  }
}
