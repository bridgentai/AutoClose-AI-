import { queryPg } from '../config/db-pg.js';

export interface ConversationRow {
  id: string;
  institution_id: string;
  subject: string;
  type: string;
  created_by: string;
  created_at: string;
}

export async function findConversationById(id: string): Promise<ConversationRow | null> {
  const r = await queryPg<ConversationRow>(
    'SELECT * FROM conversations WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findConversationsByInstitution(institutionId: string): Promise<ConversationRow[]> {
  const r = await queryPg<ConversationRow>(
    'SELECT * FROM conversations WHERE institution_id = $1 ORDER BY created_at DESC',
    [institutionId]
  );
  return r.rows;
}

export async function findConversationIdsByParticipant(userId: string): Promise<string[]> {
  const r = await queryPg<{ conversation_id: string }>(
    'SELECT conversation_id FROM conversation_participants WHERE user_id = $1',
    [userId]
  );
  return r.rows.map((row) => row.conversation_id);
}

export async function createConversation(row: {
  institution_id: string;
  subject: string;
  type: string;
  created_by: string;
}): Promise<ConversationRow> {
  const r = await queryPg<ConversationRow>(
    'INSERT INTO conversations (institution_id, subject, "type", created_by) VALUES ($1, $2, $3, $4) RETURNING *',
    [row.institution_id, row.subject, row.type, row.created_by]
  );
  return r.rows[0];
}

export async function addConversationParticipant(conversationId: string, userId: string): Promise<void> {
  await queryPg(
    'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [conversationId, userId]
  );
}

export async function isConversationParticipant(conversationId: string, userId: string): Promise<boolean> {
  const r = await queryPg<{ n: number }>(
    'SELECT 1 AS n FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
    [conversationId, userId]
  );
  return r.rows.length > 0;
}
