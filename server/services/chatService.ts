import { ChatSession, ChatMessage } from '../models';
import type { IChatMessage } from '../models/ChatMessage';
import { normalizeIdForQuery } from '../utils/idGenerator';
import { Types } from 'mongoose';

/** Máximo de mensajes recientes a enviar al modelo (evita exceder contexto). Escalable: luego se puede añadir resumen. */
export const HISTORY_MESSAGE_LIMIT = 30;

/** Formato de mensaje para la API de OpenAI */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Valida que el chat exista y pertenezca al usuario. Directivos pueden acceder a cualquier chat.
 */
export async function validateChatOwnership(
  chatId: string,
  userId: string,
  rol: string
): Promise<{ chat: any; error?: string; status?: number }> {
  const normalizedChatId = normalizeIdForQuery(chatId);
  const normalizedUserId = normalizeIdForQuery(userId);

  const chat = await ChatSession.findById(normalizedChatId).lean();
  if (!chat) {
    return { chat: null, error: 'Chat no encontrado.', status: 404 };
  }

  const ownerId = chat.userId?.toString?.() ?? (chat as any).userId;
  const isOwner = ownerId && normalizeIdForQuery(ownerId) === normalizedUserId;
  const isDirectivo = rol === 'directivo';

  if (!isOwner && !isDirectivo) {
    return { chat: null, error: 'No tienes permiso para acceder a este chat.', status: 403 };
  }

  return { chat };
}

/**
 * Obtiene los últimos N mensajes del chat en orden ASC (del más antiguo al más reciente).
 * Así el modelo recibe el contexto cronológico correcto y siempre incluye los intercambios más recientes.
 * Excluye role 'system' del historial (el system se inyecta en cada request).
 */
export async function getMessagesForContext(
  chatId: string,
  limit: number = HISTORY_MESSAGE_LIMIT
): Promise<OpenAIMessage[]> {
  const normalizedChatId = normalizeIdForQuery(chatId);
  const chatIdObj = new Types.ObjectId(normalizedChatId);

  const messages = await ChatMessage.find({ chatId: chatIdObj })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const ordered = messages.reverse();

  return ordered
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: (String(m.role).toLowerCase() || 'user') as 'user' | 'assistant',
      content: m.content ?? '',
    }));
}

export interface AddMessageOptions {
  type?: string;
  structuredData?: Record<string, unknown>;
}

/**
 * Guarda un mensaje en la colección chat_messages.
 * Para respuestas estructuradas (ej. top_student_card), pasar type y structuredData.
 */
export async function addMessage(
  chatId: string,
  role: IChatMessage['role'],
  content: string,
  options?: AddMessageOptions
): Promise<IChatMessage> {
  const normalizedChatId = normalizeIdForQuery(chatId);
  const doc = await ChatMessage.create({
    chatId: new Types.ObjectId(normalizedChatId),
    role,
    content: content ?? '',
    type: options?.type ?? 'text',
    ...(options?.structuredData != null && { structuredData: options.structuredData }),
  });
  return doc;
}

/**
 * Crea un nuevo chat para el usuario.
 */
export async function createChat(
  userId: string,
  colegioId: string,
  rol: string,
  titulo?: string
): Promise<{ _id: Types.ObjectId; titulo: string }> {
  const normalizedUserId = normalizeIdForQuery(userId);
  const newChat = await ChatSession.create({
    userId: normalizedUserId,
    colegioId,
    titulo: titulo || `Chat ${new Date().toLocaleDateString('es-CO')}`,
    contexto: { tipo: `${rol}_general` },
    participantes: [normalizedUserId],
    historial: [],
  });
  return { _id: newChat._id as Types.ObjectId, titulo: newChat.titulo || '' };
}

export interface FrontendMessage {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
  type?: string;
  structuredData?: Record<string, unknown>;
}

/**
 * Obtiene el historial de mensajes para mostrar en el frontend (formato emisor/contenido/timestamp).
 * Incluye type y structuredData cuando existen (para render de cards).
 * Si no hay mensajes en la colección Message, usa el historial embebido del Chat (compatibilidad con chats antiguos).
 */
export async function getHistoryForFrontend(chatId: string): Promise<FrontendMessage[]> {
  const normalizedChatId = normalizeIdForQuery(chatId);
  const messages = await ChatMessage.find({ chatId: normalizedChatId })
    .sort({ createdAt: 1 })
    .lean();

  if (messages.length > 0) {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => {
        const base = {
          emisor: (m.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
          contenido: m.content ?? '',
          timestamp: m.createdAt,
        };
        const type = (m as any).type;
        const structuredData = (m as any).structuredData;
        return { ...base, ...(type && type !== 'text' && { type }), ...(structuredData != null && { structuredData }) };
      });
  }

  const chat = await ChatSession.findById(normalizedChatId).select('historial').lean();
  const historial = (chat as any)?.historial;
  if (Array.isArray(historial) && historial.length > 0) {
    return historial.map((h: { emisor: string; contenido: string; timestamp: Date }) => ({
      emisor: h.emisor === 'user' ? 'user' : 'ai',
      contenido: h.contenido,
      timestamp: h.timestamp instanceof Date ? h.timestamp : new Date(h.timestamp),
    })) as FrontendMessage[];
  }
  return [];
}

/**
 * Actualiza updatedAt del chat (útil tras agregar mensajes).
 */
export async function touchChat(chatId: string): Promise<void> {
  const normalizedChatId = normalizeIdForQuery(chatId);
  await ChatSession.findByIdAndUpdate(normalizedChatId, { updatedAt: new Date() });
}

/**
 * Lista de chats del usuario con metadatos (último mensaje, cantidad).
 * Preparado para futura paginación o resumen.
 */
export async function getChatsForUser(userId: string, limit: number = 50): Promise<any[]> {
  const normalizedUserId = normalizeIdForQuery(userId);
  const sessions = await ChatSession.find({ userId: normalizedUserId })
    .sort({ updatedAt: -1 })
    .select('_id titulo contexto createdAt updatedAt historial')
    .limit(limit)
    .lean();

  const result = await Promise.all(
    sessions.map(async (session) => {
      const lastMsg = await ChatMessage.findOne({ chatId: session._id })
        .sort({ createdAt: -1 })
        .select('content')
        .lean();
      const count = await ChatMessage.countDocuments({ chatId: session._id });
      const historial = (session as any).historial;
      const mensajesCount = count > 0 ? count : (Array.isArray(historial) ? historial.length : 0);
      const ultimoMensaje =
        lastMsg?.content?.substring(0, 100) ??
        (Array.isArray(historial) && historial.length > 0
          ? historial[historial.length - 1].contenido?.substring(0, 100)
          : null);
      return {
        _id: session._id,
        titulo: session.titulo,
        contexto: session.contexto,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        mensajesCount,
        ultimoMensaje,
      };
    })
  );

  return result;
}
