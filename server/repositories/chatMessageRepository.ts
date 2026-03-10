import { queryPg } from '../config/db-pg.js';

export interface ChatMessageRow {
  id: string;
  chat_session_id: string;
  user_id: string | null;
  role: string;
  content: string;
  type: string;
  structured_data: unknown;
  created_at: string;
}

export async function findChatMessagesBySession(chatSessionId: string): Promise<ChatMessageRow[]> {
  const r = await queryPg<ChatMessageRow>(
    'SELECT * FROM chat_messages WHERE chat_session_id = $1 ORDER BY created_at',
    [chatSessionId]
  );
  return r.rows;
}

export async function createChatMessage(row: {
  chat_session_id: string;
  user_id?: string | null;
  role: string;
  content: string;
  type?: string;
  structured_data?: unknown;
}): Promise<ChatMessageRow> {
  const r = await queryPg<ChatMessageRow>(
    'INSERT INTO chat_messages (chat_session_id, user_id, "role", content, "type", structured_data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [
      row.chat_session_id,
      row.user_id ?? null,
      row.role,
      row.content,
      row.type ?? 'text',
      row.structured_data ?? null,
    ]
  );
  return r.rows[0];
}
