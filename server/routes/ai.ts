import express from 'express';
import { protect, AuthRequest } from '../middleware/authMiddleware';
import { generateAIResponseWithFunctions } from '../services/openai';
import { sanitizeText } from '../services/llmSanitizer.js';
import { normalizeIdForQuery } from '../utils/idGenerator';
import {
  validateChatOwnership,
  createChat,
  getMessagesForContext,
  addMessage,
  touchChat,
  HISTORY_MESSAGE_LIMIT,
} from '../services/chatService';
import { parseVisualIntent } from '../services/intentRouter';
import {
  handleTopStudent,
  handleTasksOverview,
  handleGradeTrendAnalysis,
  handleNotesOverview,
} from '../services/structuredHandlers';

const router = express.Router();

/**
 * GET /api/ai/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI Chat endpoint está funcionando correctamente',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/ai/debug-env
 */
router.get('/debug-env', (req, res) => {
  const rawKey = process.env.OPENAI_API_KEY || '';
  res.json({
    envLoaded: !!process.env.OPENAI_API_KEY,
    keyExists: rawKey.length > 0,
    keyLength: rawKey.length,
    firstChars: rawKey.substring(0, 20),
    lastChars: rawKey.length > 10 ? rawKey.substring(rawKey.length - 10) : rawKey,
    hasAsterisks: rawKey.includes('*'),
    hasDots: rawKey.includes('...'),
    startsWithSk: rawKey.startsWith('sk-'),
    startsWithSkproj: rawKey.startsWith('skproj'),
    isValidFormat: rawKey.startsWith('sk-') || rawKey.startsWith('skproj'),
    message: rawKey ? 'API key detectada en process.env' : 'API key NO detectada en process.env',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/ai/chat
 * Chat con memoria conversacional persistente en DB.
 * Recibe: message, sessionId (opcional, mismo que chatId).
 * Carga historial desde Message, construye [system, ...historial, newUserMessage], llama al modelo, guarda user + assistant en DB.
 */
router.post('/chat', protect, async (req: AuthRequest, res) => {
  try {
    const { message, sessionId, chatId: bodyChatId, contexto_extra } = req.body;
    const userId = req.user!.id;
    const { colegioId, rol } = req.user!;
    const normalizedUserId = normalizeIdForQuery(userId);

    const newUserMessage = typeof message === 'string' ? message.trim() : '';
    if (!newUserMessage) {
      return res.status(400).json({
        success: false,
        response: 'El campo "message" es obligatorio y debe ser una cadena de texto.',
        error: 'El campo "message" es obligatorio y debe ser una cadena de texto.',
      });
    }

    const incomingChatId = bodyChatId || sessionId;
    let chatId: string;

    if (incomingChatId) {
      const validation = await validateChatOwnership(incomingChatId, userId, rol);
      if (validation.error) {
        return res.status(validation.status ?? 403).json({
          success: false,
          response: validation.error,
          error: validation.error,
        });
      }
      chatId = incomingChatId;
    } else {
      const { _id } = await createChat(userId, colegioId, rol);
      chatId = _id.toString();
    }

    const { sanitized: safeUserMessage } = sanitizeText(newUserMessage);
    await addMessage(chatId, 'user', safeUserMessage);

    const visualIntent = rol === 'profesor' ? parseVisualIntent(newUserMessage) : { matched: false };
    if (visualIntent.matched && visualIntent.intent) {
      let structured: { type: string; content: string; data?: Record<string, unknown> };
      switch (visualIntent.intent) {
        case 'top_student_card':
          structured = await handleTopStudent(normalizedUserId, visualIntent.params?.group, colegioId);
          break;
        case 'tasks_overview':
          structured = await handleTasksOverview(normalizedUserId, visualIntent.params?.group, colegioId);
          break;
        case 'grade_trend_analysis':
          structured = await handleGradeTrendAnalysis(normalizedUserId, colegioId, visualIntent.params?.period);
          break;
        case 'notes_overview':
          structured = await handleNotesOverview(normalizedUserId, visualIntent.params?.group, colegioId);
          break;
        default:
          structured = { type: 'text', content: '' };
      }
      if (structured.content) {
        await addMessage(chatId, 'assistant', structured.content, {
          type: structured.type,
          ...(structured.data && { structuredData: structured.data }),
        });
        await touchChat(chatId);
        return res.json({
          success: true,
          response: structured.content,
          sessionId: chatId,
          chatId,
          userId: normalizedUserId,
          role: rol,
          timestamp: new Date().toISOString(),
          structuredResponse:
            structured.type !== 'text' && structured.data
              ? { type: structured.type, data: structured.data }
              : undefined,
        });
      }
    }

    const historialMensajes = await getMessagesForContext(chatId, HISTORY_MESSAGE_LIMIT);

    const historialFormateado = historialMensajes.map((m) => ({
      role: (m.role ?? 'user').toLowerCase() as 'user' | 'assistant',
      content: m.content ?? '',
    }));

    const conversationHistory = historialFormateado.slice(0, -1);
    const lastUserContent = historialFormateado.length > 0 ? historialFormateado[historialFormateado.length - 1].content : newUserMessage;

    let aiResponse: string;
    let executedActions: string[] = [];
    let actionData: Record<string, any> | undefined;

    try {
      const result = await generateAIResponseWithFunctions(
        lastUserContent,
        normalizedUserId,
        rol,
        colegioId,
        conversationHistory
      );

      if (typeof result === 'string') {
        aiResponse = result;
      } else {
        aiResponse = result.response || '';
        executedActions = result.executedActions || [];
        actionData = result.actionData;
      }
    } catch (error: any) {
      console.error('[AI Chat] Error al generar respuesta:', error.message);
      throw error;
    }

    const { sanitized: safeAiResponse } = sanitizeText(aiResponse);
    await addMessage(chatId, 'assistant', safeAiResponse);
    await touchChat(chatId);

    res.json({
      success: true,
      response: aiResponse,
      sessionId: chatId,
      chatId,
      userId: normalizedUserId,
      role: rol,
      timestamp: new Date().toISOString(),
      executedActions,
      actionData,
    });
  } catch (error: any) {
    console.error('Error en /api/ai/chat:', error.message);

    if (error.message?.includes('OPENAI_API_KEY')) {
      return res.status(500).json({
        success: false,
        response: 'El servicio de IA no está configurado correctamente. Por favor, contacta al administrador.',
        error: 'El servicio de IA no está configurado correctamente. Por favor, contacta al administrador.',
      });
    }

    if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      return res.status(429).json({
        success: false,
        response: 'Se ha excedido el límite de uso del servicio de IA. Por favor, intenta más tarde.',
        error: 'Se ha excedido el límite de uso del servicio de IA. Por favor, intenta más tarde.',
      });
    }

    res.status(500).json({
      success: false,
      response: error.message || 'Error al procesar la solicitud del chat AI.',
      error: error.message || 'Error al procesar la solicitud del chat AI.',
    });
  }
});

export default router;
