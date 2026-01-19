import express from 'express';
import { protect, AuthRequest } from '../middleware/authMiddleware';
import { generateAIResponseWithFunctions } from '../services/openai';
import { normalizeIdForQuery } from '../utils/idGenerator';
import { ChatSession } from '../models';

const router = express.Router();

/**
 * GET /api/ai/health
 * Endpoint de prueba para verificar que la ruta esté funcionando
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI Chat endpoint está funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/ai/debug-env
 * Endpoint de diagnóstico para verificar que el .env se está cargando
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
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/ai/chat
 * Endpoint principal para el Chat AI Global
 * Recibe mensajes del usuario y devuelve respuestas del AI con capacidad de ejecutar acciones
 * Gestiona sesiones de chat persistentes automáticamente
 */
router.post('/chat', protect, async (req: AuthRequest, res) => {
  console.log('[AI Chat] Petición recibida en /api/ai/chat');
  try {
    const { message, sessionId, contexto_extra, conversationHistory } = req.body;
    const { id: userId, colegioId, rol } = req.user!;
    const normalizedUserId = normalizeIdForQuery(userId || '');
    
    console.log('[AI Chat] Usuario:', normalizedUserId, 'Rol:', rol, 'SessionId:', sessionId, 'Mensaje:', message?.substring(0, 50));

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        success: false,
        response: 'El campo "message" es obligatorio y debe ser una cadena de texto.',
        error: 'El campo "message" es obligatorio y debe ser una cadena de texto.'
      });
    }

    let session;
    
    // Si hay sessionId, cargar sesión existente
    if (sessionId) {
      session = await ChatSession.findById(sessionId);
      if (!session) {
        console.log('[AI Chat] Sesión no encontrada, creando nueva sesión');
        // Si la sesión no existe, crear una nueva
        session = await ChatSession.create({
          userId: normalizedUserId,
          colegioId,
          titulo: `Chat ${new Date().toLocaleDateString('es-CO')}`,
          contexto: {
            tipo: `${rol}_general`,
          },
          participantes: [normalizedUserId],
          historial: []
        });
        console.log('[AI Chat] Nueva sesión creada (sesión anterior no encontrada):', session._id.toString());
      } else {
        // Verificar permisos
        const sessionUserId = session.userId?.toString();
        if (sessionUserId !== normalizedUserId && rol !== 'directivo') {
          return res.status(403).json({ 
            success: false,
            response: 'No tienes acceso a esta sesión de chat.',
            error: 'No tienes acceso a esta sesión de chat.'
          });
        }
        console.log('[AI Chat] Sesión existente cargada:', sessionId, 'con', session.historial?.length || 0, 'mensajes en historial');
      }
    } else {
      // Crear nueva sesión automáticamente
      session = await ChatSession.create({
        userId: normalizedUserId,
        colegioId,
        titulo: `Chat ${new Date().toLocaleDateString('es-CO')}`,
        contexto: {
          tipo: `${rol}_general`,
        },
        participantes: [normalizedUserId],
        historial: []
      });
      console.log('[AI Chat] Nueva sesión creada:', session._id.toString());
    }

    // Construir historial de conversación para el AI ANTES de agregar el nuevo mensaje
    // IMPORTANTE: Incluir TODOS los mensajes previos (sin límite) para mantener el contexto completo
    // El historial debe incluir todos los mensajes de la sesión para que el AI tenga memoria completa
    const historyMessages = session.historial && session.historial.length > 0
      ? session.historial.map(msg => ({
          role: msg.emisor === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.contenido
        }))
      : [];
    
    console.log('[AI Chat] Historial de conversación:', historyMessages.length, 'mensajes previos');
    if (historyMessages.length > 0) {
      console.log('[AI Chat] Todos los mensajes del historial:');
      historyMessages.forEach((msg, idx) => {
        const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
        console.log(`  [${idx + 1}] ${msg.role}: ${preview}`);
      });
      console.log('[AI Chat] ✅ El AI tiene acceso a TODO el historial de la conversación');
    } else {
      console.log('[AI Chat] ⚠️ No hay historial previo - esta es la primera conversación');
    }

    // Guardar mensaje del usuario en la sesión (después de construir el historial)
    session.historial.push({
      emisor: 'user',
      contenido: message,
      timestamp: new Date()
    });

    // Generar respuesta con Function Calling
    let aiResponse: string;
    let executedActions: string[] = []; // Track executed actions
    let actionData: Record<string, any> | undefined = undefined;
    try {
      const result = await generateAIResponseWithFunctions(
        message,
        normalizedUserId,
        rol,
        colegioId,
        historyMessages
      );
      
      // Extract response and executed actions
      if (typeof result === 'string') {
        aiResponse = result;
      } else {
        aiResponse = result.response || '';
        executedActions = result.executedActions || [];
        actionData = result.actionData;
      }
    } catch (error: any) {
      console.error('[AI Chat] Error con Function Calling:', error.message);
      throw error; // Re-lanzar para manejar en el catch general
    }

    // Guardar respuesta del AI en la sesión
    session.historial.push({
      emisor: 'ai',
      contenido: aiResponse,
      timestamp: new Date()
    });

    // Guardar la sesión actualizada (marcar como modificada explícitamente)
    session.markModified('historial');
    await session.save();
    
    console.log('[AI Chat] Sesión guardada. Total de mensajes en historial:', session.historial.length);
    if (executedActions.length > 0) {
      console.log('[AI Chat] Acciones ejecutadas:', executedActions);
    }

    res.json({
      success: true,
      response: aiResponse,
      sessionId: session._id.toString(),
      userId: normalizedUserId,
      role: rol,
      timestamp: new Date().toISOString(),
      executedActions: executedActions, // Include executed actions
      actionData: actionData, // Include action data
    });
  } catch (error: any) {
    console.error('Error en /api/ai/chat:', error.message);
    
    // Manejar errores específicos
    if (error.message?.includes('OPENAI_API_KEY')) {
      return res.status(500).json({ 
        success: false,
        response: 'El servicio de IA no está configurado correctamente. Por favor, contacta al administrador.',
        error: 'El servicio de IA no está configurado correctamente. Por favor, contacta al administrador.'
      });
    }

    if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      return res.status(429).json({ 
        success: false,
        response: 'Se ha excedido el límite de uso del servicio de IA. Por favor, intenta más tarde.',
        error: 'Se ha excedido el límite de uso del servicio de IA. Por favor, intenta más tarde.'
      });
    }

    res.status(500).json({ 
      success: false,
      response: error.message || 'Error al procesar la solicitud del chat AI.',
      error: error.message || 'Error al procesar la solicitud del chat AI.'
    });
  }
});

export default router;

