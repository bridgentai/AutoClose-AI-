import { queryPg } from '../config/db-pg.js';

export interface NotificationRow {
  id: string;
  institution_id: string;
  user_id: string;
  title: string;
  body: string;
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
