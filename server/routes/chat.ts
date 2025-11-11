import express from 'express';
import { ChatSession } from '../models';
import { protect, AuthRequest } from '../middleware/authMiddleware';
import { generateAIResponse } from '../services/openai';

const router = express.Router();

// POST /api/chat/new - Crear nueva sesión de chat
router.post('/new', protect, async (req: AuthRequest, res) => {
  const { titulo, contextoTipo, contextoReferenciaId } = req.body;
  const { id: userId, colegioId, rol } = req.user!;

  try {
    const newChat = await ChatSession.create({
      colegioId,
      userId,
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
  const { id: userId, colegioId, rol } = req.user!;

  try {
    const session = await ChatSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada.' });
    }

    // Verificar permisos
    const canWrite = rol === 'directivo' || session.userId.toString() === userId.toString();
    if (!canWrite) {
      return res.status(403).json({ message: 'Acceso denegado a esta sesión de chat.' });
    }

    // Guardar mensaje del usuario
    session.historial.push({ 
      emisor: 'user', 
      contenido: mensaje, 
      timestamp: new Date() 
    });

    // Generar respuesta de IA
    const aiResponse = await generateAIResponse(mensaje, {
      rol,
      colegioId,
      contextoTipo: session.contexto.tipo,
    });

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
    res.status(500).json({ message: 'Error en el servidor al procesar el chat.' });
  }
});

// GET /api/chat/:sessionId/history - Obtener historial
router.get('/:sessionId/history', protect, async (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  const { id: userId, rol } = req.user!;

  try {
    const session = await ChatSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Sesión de chat no encontrada.' });
    }

    const canAccess = rol === 'directivo' || session.userId.toString() === userId.toString();
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

// GET /api/chat/sessions - Obtener todas las sesiones del usuario
router.get('/sessions', protect, async (req: AuthRequest, res) => {
  const { id: userId } = req.user!;

  try {
    const sessions = await ChatSession.find({ userId })
      .sort({ updatedAt: -1 })
      .select('titulo contexto createdAt updatedAt')
      .limit(50);

    res.json(sessions);
  } catch (error: any) {
    console.error('Error al obtener sesiones:', error.message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

export default router;
