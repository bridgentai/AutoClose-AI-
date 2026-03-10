import { queryPg } from '../config/db-pg.js';

export interface ChatSessionRow {
  id: string;
  institution_id: string;
  title: string | null;
  created_by_id: string | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function findChatSessionById(id: string): Promise<ChatSessionRow | null> {
  const r = await queryPg<ChatSessionRow>(
    'SELECT * FROM chat_sessions WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findChatSessionsByInstitution(institutionId: string): Promise<ChatSessionRow[]> {
  const r = await queryPg<ChatSessionRow>(
    'SELECT * FROM chat_sessions WHERE institution_id = $1 ORDER BY updated_at DESC',
    [institutionId]
  );
  return r.rows;
}

export async function findChatSessionsByCreatedBy(userId: string): Promise<ChatSessionRow[]> {
  const r = await queryPg<ChatSessionRow>(
    'SELECT * FROM chat_sessions WHERE created_by_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
  return r.rows;
}

export async function createChatSession(row: {
  institution_id: string;
  title?: string | null;
  created_by_id?: string | null;
  group_id?: string | null;
}): Promise<ChatSessionRow> {
  const r = await queryPg<ChatSessionRow>(
    'INSERT INTO chat_sessions (institution_id, title, created_by_id, group_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [row.institution_id, row.title ?? null, row.created_by_id ?? null, row.group_id ?? null]
  );
  return r.rows[0];
}

export async function updateChatSessionTitle(id: string, title: string): Promise<ChatSessionRow | null> {
  const r = await queryPg<ChatSessionRow>(
    'UPDATE chat_sessions SET title = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [title, id]
  );
  return r.rows[0] ?? null;
}
