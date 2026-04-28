import { queryPg } from '../config/db-pg.js';
import type { AnnouncementRow } from '../repositories/announcementRepository.js';
import {
  findOrCreateParentSubjectEvoThread,
  createAnnouncementMessage,
} from '../repositories/announcementRepository.js';
import { resolveRecipientsForThread } from './evoSendAccess.js';
import { emitEvoMessageBroadcast } from '../socket.js';
import { findUserById } from '../repositories/userRepository.js';
import { notify } from '../repositories/notificationRepository.js';

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

function attachmentsSummary(attachmentsJson: unknown): string {
  try {
    if (!attachmentsJson) return '';
    const arr =
      typeof attachmentsJson === 'string' ? (JSON.parse(attachmentsJson) as unknown) : attachmentsJson;
    if (!Array.isArray(arr) || arr.length === 0) return '';
    const names: string[] = [];
    for (const item of arr) {
      if (typeof item !== 'object' || item === null) continue;
      const o = item as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name.trim() : typeof o.nombre === 'string' ? o.nombre.trim() : '';
      if (name) names.push(name);
    }
    return names.length ? `\n\nAdjuntos: ${names.join(', ')}` : '';
  } catch {
    return '';
  }
}

/**
 * Cuando un comunicado_padres pasa a enviado, refleja el contenido en el hilo EvoSend padre–materia.
 * Omite filas de tareas con assignment_id: ahí ya entra assignment_reminder vía assignmentSideEffectsService.
 */
export async function mirrorComunicadosPadresToParentSubjectThreads(rows: AnnouncementRow[]): Promise<void> {
  for (const row of rows) {
    if (row.type !== 'comunicado_padres' || !row.group_subject_id) continue;
    if ((row.category || '').toLowerCase() === 'tareas' && row.assignment_id) continue;

    try {
      const thread = await findOrCreateParentSubjectEvoThread(row.group_subject_id, row.institution_id);
      const body = typeof row.body === 'string' ? row.body.trim() : '';
      const att = attachmentsSummary(row.attachments_json);
      const content = `${String(row.title ?? '').trim()}\n\n${body}${att}`.trim();
      const author = await findUserById(row.created_by_id);
      const msg = await createAnnouncementMessage({
        announcement_id: thread.id,
        sender_id: row.created_by_id,
        sender_role: author?.role ?? 'profesor',
        content: content || '(sin contenido)',
        content_type: 'texto',
        priority: typeof row.priority === 'string' && row.priority.trim() ? row.priority : 'normal',
      });

      const recipientIds = await resolveRecipientsForThread({
        announcement: {
          id: thread.id,
          type: thread.type,
          group_id: thread.group_id,
          group_subject_id: thread.group_subject_id,
          created_by_id: thread.created_by_id,
        },
        institutionId: row.institution_id,
      });
      const recipientsWithoutSender = recipientIds.filter((rid) => rid !== row.created_by_id);
      await Promise.all(
        recipientsWithoutSender.map(async (rid) => {
          const email = await getUserEmail(rid);
          await notify({
            institution_id: row.institution_id,
            user_id: rid,
            user_email: email,
            type: 'mensaje',
            entity_type: 'evo_send_thread',
            entity_id: thread.id,
            action_url: `/evo-send?thread=${encodeURIComponent(thread.id)}`,
            title: `EvoSend · ${thread.title}`,
            body: truncateText(String(row.title ?? '')),
          });
        })
      );

      const sender = await findUserById(row.created_by_id);
      const participantIds = Array.from(new Set([...recipientIds, row.created_by_id]));
      emitEvoMessageBroadcast(
        thread.id,
        {
          _id: msg.id,
          contenido: msg.content,
          tipo: msg.content_type,
          prioridad: msg.priority,
          fecha: msg.created_at,
          remitenteId: { _id: row.created_by_id, nombre: sender?.full_name ?? '', rol: sender?.role },
          rolRemitente: msg.sender_role,
        },
        participantIds
      );
    } catch (e: unknown) {
      console.error('[parentSubjectEvoSync] mirror comunicado:', (e as Error).message);
    }
  }
}
