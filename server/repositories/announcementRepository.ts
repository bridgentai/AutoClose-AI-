import { queryPg } from '../config/db-pg.js';

export interface AnnouncementRow {
  id: string;
  institution_id: string;
  title: string;
  body: string | null;
  type: string;
  group_id: string | null;
  assignment_id: string | null;
  created_by_id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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

export async function findAnnouncementById(id: string): Promise<AnnouncementRow | null> {
  const r = await queryPg<AnnouncementRow>(
    'SELECT * FROM announcements WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
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
  assignment_id?: string | null;
  created_by_id: string;
}): Promise<AnnouncementRow> {
  const r = await queryPg<AnnouncementRow>(
    `INSERT INTO announcements (institution_id, title, body, type, group_id, assignment_id, created_by_id, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING *`,
    [
      row.institution_id,
      row.title,
      row.body ?? null,
      row.type ?? 'general',
      row.group_id ?? null,
      row.assignment_id ?? null,
      row.created_by_id,
    ]
  );
  return r.rows[0];
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
