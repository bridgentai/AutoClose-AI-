import express from 'express';
import { ChatSession } from '../models';
import { protect, AuthRequest } from '../middleware/authMiddleware';
import { generateAIResponse, generateAIResponseWithFunctions } from '../services/openai';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// POST /api/chat/new - Crear nueva sesión de chat
router.post('/new', protect, async (req: AuthRequest, res) => {
  const { titulo, contextoTipo, contextoReferenciaId, cursoId } = req.body;
  const normalizedUserId = normalizeIdForQuery(req.userId || '');
  const { id: userId, colegioId, rol } = req.user!;

  try {
    // cursoId es opcional - permite chats globales sin curso específico
    const newChat = await ChatSession.create({
      cursoId: cursoId || undefined, // Opcional para chats globales
      participantes: [normalizedUserId], // Campo requerido - incluir al usuario actual
      // Campos adicionales para compatibilidad
      colegioId,
      userId: normalizedUserId,
      titulo: titulo || `Chat ${new Date().toLocaleDateString('es-CO')}`,
      contexto: {
        tipo: contextoTipo || `${rol}_general`,
        referenciaId: contextoReferenciaId,
      },
      historial: [],
    });

    res.status(201).json({
      message: 'Nueva sesión de chat creada.',
      sessionId: newChat._id,
    });
  } catch (error: any) {
    console.error('Error al iniciar chat:', error.message);
    res.status(500).json({ message: 'Error en el servidor al iniciar el chat.' });
  }
});

// POST /api/chat/:sessionId/message - Enviar mensaje
router.post('/:sessionId/message', protect, async (req: AuthRequest, res) => {
  const { mensaje, emisor } = req.body;
  const { sessionId } = req.params;
  const normalizedUserId = normalizeIdForQuery(req.userId || '');
  const { id: userId, colegioId, rol } = req.user!;

  try {
    const session = await ChatSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada.' });
    }

    // Verificar permisos
    const canWrite = rol === 'directivo' || session.userId?.toString() === normalizedUserId;
    if (!canWrite) {
      return res.status(403).json({ message: 'Acceso denegado a esta sesión de chat.' });
    }

    // Guardar mensaje del usuario
    session.historial.push({ 
      emisor: 'user', 
      contenido: mensaje, 
      timestamp: new Date() 
    });

    // Construir historial de conversación para el AI (últimos 10 mensajes)
    const conversationHistory = session.historial
      .slice(-10)
      .map(msg => ({
        role: msg.emisor === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.contenido
      }));

    // Generar respuesta de IA con Function Calling para permitir acciones
    let aiResponse: string;
    try {
      aiResponse = await generateAIResponseWithFunctions(
        mensaje,
        userId,
        rol,
        colegioId,
        conversationHistory
      );
    } catch (error: any) {
      // Si falla con Function Calling, usar respuesta básica como fallback
      console.warn('Error con Function Calling, usando respuesta básica:', error.message);
      aiResponse = await generateAIResponse(mensaje, {
        rol,
        colegioId,
        contextoTipo: session.contexto.tipo,
      });
    }

    session.historial.push({ 
      emisor: 'ai', 
      contenido: aiResponse, 
      timestamp: new Date() 
    });

    await session.save();

    res.json({
      message: 'Mensaje procesado',
      aiResponse,
      sessionId: session._id,
    });
  } catch (error: any) {
    console.error('Error al enviar mensaje:', error.message);
    const errorMessage = error.message || 'Error en el servidor al procesar el chat.';
    res.status(500).json({ message: errorMessage });
  }
});

// GET /api/chat/:sessionId/history - Obtener historial
router.get('/:sessionId/history', protect, async (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  const { id: userId, rol } = req.user!;

  try {
    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(userId || '');

    const session = await ChatSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Sesión de chat no encontrada.' });
    }

    const canAccess = rol === 'directivo' || (session.userId && normalizeIdForQuery(session.userId.toString()) === normalizedUserId);
    if (!canAccess) {
      return res.status(403).json({ message: 'No tienes permiso para ver este historial.' });
    }

    res.json({
      sessionId: session._id,
      titulo: session.titulo,
      historial: session.historial,
      contexto: session.contexto,
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
    const normalizedUserId = normalizeIdForQuery(userId || '');

    if (!titulo || typeof titulo !== 'string' || titulo.trim().length === 0) {
      return res.status(400).json({ message: 'El título es obligatorio y debe ser una cadena de texto válida.' });
    }

    const session = await ChatSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Sesión de chat no encontrada.' });
    }

    // Verificar permisos
    const canEdit = rol === 'directivo' || (session.userId && normalizeIdForQuery(session.userId.toString()) === normalizedUserId);
    if (!canEdit) {
      return res.status(403).json({ message: 'No tienes permiso para editar esta sesión.' });
    }

    session.titulo = titulo.trim();
    await session.save();

    res.json({
      message: 'Título actualizado exitosamente',
      titulo: session.titulo,
    });
  } catch (error: any) {
    console.error('Error al actualizar título:', error.message);
    res.status(500).json({ message: 'Error en el servidor al actualizar el título.' });
  }
});

// GET /api/chat/sessions - Obtener todas las sesiones del usuario
router.get('/sessions', protect, async (req: AuthRequest, res) => {
  const { id: userId } = req.user!;

  try {
    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(userId || '');
    const sessions = await ChatSession.find({ userId: normalizedUserId })
      .sort({ updatedAt: -1 })
      .select('titulo contexto createdAt updatedAt historial')
      .limit(50)
      .lean();

    // Formatear sesiones para incluir información útil
    const formattedSessions = sessions.map(session => ({
      _id: session._id,
      titulo: session.titulo,
      contexto: session.contexto,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      mensajesCount: session.historial?.length || 0,
      ultimoMensaje: session.historial && session.historial.length > 0 
        ? session.historial[session.historial.length - 1].contenido.substring(0, 100)
        : null
    }));

    res.json(formattedSessions);
  } catch (error: any) {
    console.error('Error al obtener sesiones:', error.message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

export default router;
