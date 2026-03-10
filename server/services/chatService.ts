import {
  findChatSessionById,
  findChatSessionsByCreatedBy,
  createChatSession,
  updateChatSessionTitle,
} from '../repositories/chatSessionRepository.js';
import {
  findChatMessagesBySession,
  createChatMessage,
} from '../repositories/chatMessageRepository.js';

/** Máximo de mensajes recientes a enviar al modelo. */
export const HISTORY_MESSAGE_LIMIT = 30;

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function validateChatOwnership(
  chatId: string,
  userId: string,
  rol: string
): Promise<{ chat: { id: string; title: string | null; created_by_id: string | null }; error?: string; status?: number }> {
  const chat = await findChatSessionById(chatId);
  if (!chat) {
    return { chat: null as unknown as { id: string; title: string | null; created_by_id: string | null }, error: 'Chat no encontrado.', status: 404 };
  }
  const ownerId = chat.created_by_id;
  const isOwner = ownerId && ownerId === userId;
  const isDirectivo = rol === 'directivo';
  if (!isOwner && !isDirectivo) {
    return { chat: null as unknown as { id: string; title: string | null; created_by_id: string | null }, error: 'No tienes permiso para acceder a este chat.', status: 403 };
  }
  return { chat: { id: chat.id, title: chat.title, created_by_id: chat.created_by_id } };
}

export async function getMessagesForContext(
  chatId: string,
  limit: number = HISTORY_MESSAGE_LIMIT
): Promise<OpenAIMessage[]> {
  const messages = await findChatMessagesBySession(chatId);
  const ordered = messages
    .filter((m) => m.role !== 'system')
    .slice(-limit)
    .map((m) => ({
      role: (String(m.role).toLowerCase() || 'user') as 'user' | 'assistant',
      content: m.content ?? '',
    }));
  return ordered;
}

export interface AddMessageOptions {
  type?: string;
  structuredData?: Record<string, unknown>;
}

export async function addMessage(
  chatId: string,
  role: 'system' | 'user' | 'assistant',
  content: string,
  options?: AddMessageOptions
): Promise<{ id: string; role: string; content: string }> {
  const doc = await createChatMessage({
    chat_session_id: chatId,
    user_id: role === 'user' ? undefined : null,
    role,
    content: content ?? '',
    type: options?.type ?? 'text',
    structured_data: options?.structuredData,
  });
  return { id: doc.id, role: doc.role, content: doc.content };
}

export async function createChat(
  userId: string,
  colegioId: string,
  _rol: string,
  titulo?: string
): Promise<{ _id: string; titulo: string }> {
  const title = titulo || `Chat ${new Date().toLocaleDateString('es-CO')}`;
  const newChat = await createChatSession({
    institution_id: colegioId,
    title,
    created_by_id: userId,
    group_id: null,
  });
  return { _id: newChat.id, titulo: newChat.title ?? title };
}

export interface FrontendMessage {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
  type?: string;
  structuredData?: Record<string, unknown>;
}

export async function getHistoryForFrontend(chatId: string): Promise<FrontendMessage[]> {
  const messages = await findChatMessagesBySession(chatId);
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      emisor: (m.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
      contenido: m.content ?? '',
      timestamp: new Date(m.created_at),
      ...(m.type && m.type !== 'text' && { type: m.type }),
      ...(m.structured_data != null && { structuredData: m.structured_data as Record<string, unknown> }),
    }));
}

export async function touchChat(chatId: string): Promise<void> {
  await updateChatSessionTitle(chatId, (await findChatSessionById(chatId))?.title ?? '');
}

export async function getChatsForUser(userId: string, limit: number = 50): Promise<{
  _id: string;
  titulo: string | null;
  contexto: unknown;
  createdAt: string;
  updatedAt: string;
  mensajesCount: number;
  ultimoMensaje: string | null;
}[]> {
  const sessions = await findChatSessionsByCreatedBy(userId);
  const limited = sessions.slice(0, limit);

  const result = await Promise.all(
    limited.map(async (session) => {
      const msgs = await findChatMessagesBySession(session.id);
      const lastMsg = msgs[msgs.length - 1];
      return {
        _id: session.id,
        titulo: session.title,
        contexto: {},
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        mensajesCount: msgs.length,
        ultimoMensaje: lastMsg?.content?.substring(0, 100) ?? null,
      };
    })
  );
  return result;
}

export async function updateChatTitle(chatId: string, title: string): Promise<{ title: string } | null> {
  const updated = await updateChatSessionTitle(chatId, title);
  return updated ? { title: updated.title ?? title } : null;
}
