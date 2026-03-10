import express from 'express';
import { protect, AuthRequest } from '../middleware/authMiddleware.js';
import {
  validateChatOwnership,
  createChat,
  getHistoryForFrontend,
  getChatsForUser,
  updateChatTitle,
} from '../services/chatService.js';

const router = express.Router();

// GET /api/chat/sessions - Debe ir ANTES de /:sessionId para no capturar "sessions" como id
router.get('/sessions', protect, async (req: AuthRequest, res) => {
  const { id: userId } = req.user!;
  try {
    const formattedSessions = await getChatsForUser(userId, 50);
    res.json(formattedSessions);
  } catch (error: any) {
    console.error('Error al obtener sesiones:', error.message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// POST /api/chat/new - Crear nueva sesión de chat
router.post('/new', protect, async (req: AuthRequest, res) => {
  const { titulo, contextoTipo, contextoReferenciaId, cursoId } = req.body;
  const userId = req.user!.id;
  const { colegioId, rol } = req.user!;

  try {
    const { _id, titulo: newTitulo } = await createChat(
      userId,
      colegioId,
      rol,
      titulo || undefined
    );

    res.status(201).json({
      message: 'Nueva sesión de chat creada.',
      sessionId: _id,
    });
  } catch (error: any) {
    console.error('Error al iniciar chat:', error.message);
    res.status(500).json({ message: 'Error en el servidor al iniciar el chat.' });
  }
});

// GET /api/chat/:sessionId/history - Obtener historial desde DB (mensajes persistentes)
router.get('/:sessionId/history', protect, async (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  const { id: userId, rol } = req.user!;

  try {
    const { chat, error, status } = await validateChatOwnership(sessionId, userId, rol);
    if (error) {
      return res.status(status ?? 403).json({ message: error });
    }

    const historial = await getHistoryForFrontend(sessionId);

    res.json({
      sessionId: chat.id,
      titulo: chat.title,
      historial,
      contexto: {},
    });
  } catch (error: any) {
    console.error('Error al obtener historial:', error.message);
    res.status(500).json({ message: 'Error en el servidor al obtener el chat.' });
  }
});

// PUT /api/chat/:sessionId/title - Actualizar título de la sesión
router.put('/:sessionId/title', protect, async (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  const { titulo } = req.body;
  const { id: userId, rol } = req.user!;

  try {
    if (!titulo || typeof titulo !== 'string' || titulo.trim().length === 0) {
      return res.status(400).json({ message: 'El título es obligatorio y debe ser una cadena de texto válida.' });
    }

    const { chat, error, status } = await validateChatOwnership(sessionId, userId, rol);
    if (error) {
      return res.status(status ?? 403).json({ message: error });
    }

    const updated = await updateChatTitle(chat.id, titulo.trim());

    res.json({
      message: 'Título actualizado exitosamente',
      titulo: updated?.title ?? titulo.trim(),
    });
  } catch (error: any) {
    console.error('Error al actualizar título:', error.message);
    res.status(500).json({ message: 'Error en el servidor al actualizar el título.' });
  }
});

// POST /api/chat/:sessionId/message - Legacy: enviar mensaje (mantener compatibilidad; flujo principal es POST /api/ai/chat)
router.post('/:sessionId/message', protect, async (req: AuthRequest, res) => {
  return res.status(410).json({
    message: 'Use POST /api/ai/chat con sessionId para enviar mensajes. Este endpoint está deprecado.',
  });
});

export default router;
