import { queryPg } from '../config/db-pg.js';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface KiwiSessionRow {
  id: string;
  institution_id: string;
  title: string | null;
  created_by_id: string | null;
  group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KiwiMessageRow {
  id: string;
  chat_session_id: string;
  user_id: string | null;
  role: string;
  content: string;
  tokens_used: number | null;
  type: string;
  structured_data: unknown;
  created_at: string;
}

export interface KiwiMemoryRow {
  id: string;
  institution_id: string;
  user_id: string;
  user_role: string | null;
  memory_summary: string | null;
  key_facts: unknown[];
  context_type: string;
  created_at: string;
  updated_at: string | null;
}

export interface AnonTokenRow {
  id: string;
  institution_id: string;
  real_user_id: string;
  anon_token: string;
  chat_session_id: string | null;
  created_at: string;
}

export interface KiwiToolCallRow {
  id: string;
  institution_id: string;
  user_id: string | null;
  chat_session_id: string | null;
  user_role: string | null;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: Record<string, unknown>;
  success: boolean;
  execution_ms: number | null;
  created_at: string;
}

// ─── Funciones ───────────────────────────────────────────────────────────────

/**
 * Busca la sesión activa del usuario en las últimas 24 h (la más reciente).
 * Si no existe, crea una nueva sesión y la devuelve.
 */
export async function getOrCreateSession(
  userId: string,
  institutionId: string,
  _userRole: string
): Promise<KiwiSessionRow> {
  const existing = await queryPg<KiwiSessionRow>(
    `SELECT * FROM chat_sessions
     WHERE created_by_id = $1
       AND institution_id = $2
       AND updated_at >= now() - interval '24 hours'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, institutionId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const created = await queryPg<KiwiSessionRow>(
    `INSERT INTO chat_sessions (institution_id, created_by_id)
     VALUES ($1, $2)
     RETURNING *`,
    [institutionId, userId]
  );
  return created.rows[0];
}

/**
 * Devuelve los últimos N mensajes de una sesión, ordenados ASC (más antiguos primero).
 */
export async function getRecentMessages(
  sessionId: string,
  limit = 12
): Promise<KiwiMessageRow[]> {
  const r = await queryPg<KiwiMessageRow>(
    `SELECT * FROM chat_messages
     WHERE chat_session_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [sessionId, limit]
  );
  return r.rows;
}

/**
 * Guarda un mensaje en chat_messages.
 * institution_id no es columna de chat_messages (ya está en la sesión),
 * se acepta por consistencia de interfaz pero no se persiste.
 */
export async function saveMessage(
  sessionId: string,
  userId: string,
  _institutionId: string,
  role: 'system' | 'user' | 'assistant',
  content: string,
  tokensUsed?: number | null
): Promise<KiwiMessageRow> {
  const r = await queryPg<KiwiMessageRow>(
    `INSERT INTO chat_messages (chat_session_id, user_id, "role", content, tokens_used)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [sessionId, userId, role, content, tokensUsed ?? null]
  );
  return r.rows[0];
}

/**
 * Trae el registro de ai_memory para un usuario + rol específico.
 */
export async function getUserMemory(
  userId: string,
  userRole: string
): Promise<KiwiMemoryRow | null> {
  const r = await queryPg<KiwiMemoryRow>(
    `SELECT * FROM ai_memory
     WHERE user_id = $1 AND user_role = $2
     LIMIT 1`,
    [userId, userRole]
  );
  return r.rows[0] ?? null;
}

/**
 * Crea o actualiza el registro de ai_memory para el par (user_id, user_role).
 * El índice único idx_ai_memory_user_role garantiza el upsert.
 */
export async function upsertUserMemory(
  userId: string,
  institutionId: string,
  userRole: string,
  memorySummary: string,
  keyFacts: unknown[]
): Promise<KiwiMemoryRow> {
  const r = await queryPg<KiwiMemoryRow>(
    `INSERT INTO ai_memory
       (institution_id, user_id, user_role, memory_summary, key_facts, context_type, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'kiwi', now())
     ON CONFLICT (user_id, user_role)
     DO UPDATE SET
       memory_summary = EXCLUDED.memory_summary,
       key_facts      = EXCLUDED.key_facts,
       updated_at     = now()
     RETURNING *`,
    [institutionId, userId, userRole, memorySummary, JSON.stringify(keyFacts)]
  );
  return r.rows[0];
}

/**
 * Guarda un mapeo anon_token → real_user_id.
 * Si el token ya existe para esa institución, hace DO NOTHING y devuelve null.
 */
export async function saveAnonToken(
  institutionId: string,
  realUserId: string,
  anonToken: string,
  sessionId: string | null
): Promise<AnonTokenRow | null> {
  const r = await queryPg<AnonTokenRow>(
    `INSERT INTO anon_tokens (institution_id, real_user_id, anon_token, chat_session_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (institution_id, anon_token) DO NOTHING
     RETURNING *`,
    [institutionId, realUserId, anonToken, sessionId]
  );
  return r.rows[0] ?? null;
}

/**
 * Resuelve un token anónimo y devuelve el real_user_id, o null si no existe.
 */
export async function resolveAnonToken(
  institutionId: string,
  anonToken: string
): Promise<string | null> {
  const r = await queryPg<{ real_user_id: string }>(
    `SELECT real_user_id FROM anon_tokens
     WHERE institution_id = $1 AND anon_token = $2
     LIMIT 1`,
    [institutionId, anonToken]
  );
  return r.rows[0]?.real_user_id ?? null;
}

/**
 * Registra una llamada a herramienta Kiwi en kiwi_tool_calls.
 */
export async function logToolCall(
  institutionId: string,
  userId: string,
  sessionId: string | null,
  userRole: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  toolOutput: Record<string, unknown>,
  success: boolean,
  executionMs: number | null
): Promise<KiwiToolCallRow> {
  const r = await queryPg<KiwiToolCallRow>(
    `INSERT INTO kiwi_tool_calls
       (institution_id, user_id, chat_session_id, user_role, tool_name,
        tool_input, tool_output, success, execution_ms)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
     RETURNING *`,
    [
      institutionId,
      userId,
      sessionId,
      userRole,
      toolName,
      JSON.stringify(toolInput),
      JSON.stringify(toolOutput),
      success,
      executionMs,
    ]
  );
  return r.rows[0];
}
