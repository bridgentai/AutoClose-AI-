import { queryPg } from '../config/db-pg.js';
import { sendNotificationEmail } from '../services/emailService.js';

export interface NotificationRow {
  id: string;
  institution_id: string;
  user_id: string;
  title: string;
  body: string;
  type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  read_at: string | null;
  created_at: string;
}

export async function findNotificationsByUser(userId: string, limit = 50): Promise<NotificationRow[]> {
  const r = await queryPg<NotificationRow>(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return r.rows;
}

export async function findNotificationById(id: string): Promise<NotificationRow | null> {
  const r = await queryPg<NotificationRow>(
    'SELECT * FROM notifications WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findNotificationsByUserFiltered(
  userId: string,
  options: { read?: boolean; limit?: number } = {}
): Promise<NotificationRow[]> {
  const limit = Math.min(options.limit ?? 50, 100);
  let q = 'SELECT * FROM notifications WHERE user_id = $1';
  const params: unknown[] = [userId];
  if (options.read === true) {
    q += ' AND read_at IS NOT NULL';
  } else if (options.read === false) {
    q += ' AND read_at IS NULL';
  }
  q += ' ORDER BY created_at DESC LIMIT $2';
  params.push(limit);
  const r = await queryPg<NotificationRow>(q, params);
  return r.rows;
}

export async function countUnreadByUser(userId: string): Promise<number> {
  const r = await queryPg<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [userId]
  );
  return parseInt(r.rows[0]?.count ?? '0', 10);
}

export async function updateNotificationRead(id: string, userId: string): Promise<NotificationRow | null> {
  const r = await queryPg<NotificationRow>(
    'UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return r.rows[0] ?? null;
}

export async function markAllNotificationsReadByUser(userId: string): Promise<number> {
  const r = await queryPg(
    'UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id',
    [userId]
  );
  return r.rowCount ?? 0;
}

export async function createNotification(row: {
  institution_id: string;
  user_id: string;
  title: string;
  body: string;
}): Promise<NotificationRow> {
  const r = await queryPg<NotificationRow>(
    'INSERT INTO notifications (institution_id, user_id, title, body) VALUES ($1, $2, $3, $4) RETURNING *',
    [row.institution_id, row.user_id, row.title, row.body]
  );
  return r.rows[0];
}

export async function deleteExpiredNotifications(): Promise<void> {
  await queryPg(
    `DELETE FROM notifications
     WHERE read_at IS NOT NULL
     AND read_at < now() - interval '30 days'`
  );
}

export async function notify(params: {
  institution_id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  user_email?: string;
}): Promise<void> {
  try {
    await queryPg(
      `INSERT INTO notifications (institution_id, user_id, title, body, type, entity_type, entity_id, action_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.institution_id,
        params.user_id,
        params.title,
        params.body,
        params.type,
        params.entity_type ?? null,
        params.entity_id ?? null,
        params.action_url ?? null,
      ]
    );
  } catch (err: unknown) {
    console.error('[notify] Error insert notifications:', (err as Error).message);
  }

  try {
    if (params.user_email) {
      await sendNotificationEmail(params.user_email, params.title, params.body, params.action_url);
    }
  } catch (err: unknown) {
    // best-effort: no throw
    console.error('[notify] Error sending email:', (err as Error).message);
  }
}
