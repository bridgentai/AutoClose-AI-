import { queryPg } from '../config/db-pg.js';

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  attachments: string[];
  read_at: string | null;
  created_at: string;
}

export async function findMessagesByConversation(conversationId: string): Promise<MessageRow[]> {
  const r = await queryPg<MessageRow>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at',
    [conversationId]
  );
  return r.rows;
}

export async function findMessageById(id: string): Promise<MessageRow | null> {
  const r = await queryPg<MessageRow>(
    'SELECT * FROM messages WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function getLastMessageByConversation(conversationId: string): Promise<MessageRow | null> {
  const r = await queryPg<MessageRow>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
    [conversationId]
  );
  return r.rows[0] ?? null;
}

export async function createMessage(row: {
  conversation_id: string;
  sender_id: string;
  text: string;
  attachments?: string[];
}): Promise<MessageRow> {
  const r = await queryPg<MessageRow>(
    'INSERT INTO messages (conversation_id, sender_id, text, attachments) VALUES ($1, $2, $3, $4) RETURNING *',
    [row.conversation_id, row.sender_id, row.text, (row.attachments ?? []) as string[]]
  );
  return r.rows[0];
}

export async function markMessagesAsReadByConversationForUser(conversationId: string, userId: string): Promise<number> {
  const r = await queryPg(
    'UPDATE messages SET read_at = now() WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL RETURNING id',
    [conversationId, userId]
  );
  return r.rowCount ?? 0;
}
