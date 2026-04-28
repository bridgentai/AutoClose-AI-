import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect, type AuthRequest } from '../middleware/auth.js';
import { sanitizeText } from '../services/llmSanitizer.js';
import {
  getOrCreateSession,
  getUserMemory,
  saveMessage,
} from '../repositories/kiwiRepository.js';
import { runKiwiAgent } from '../services/kiwiAgent.js';
import type { KiwiUserContext } from '../services/kiwiContext.js';
import { validateInput, getCrisisResponse, validateOutput } from '../services/kiwiGuardrails.js';

const router = express.Router();

/**
 * POST /api/ai/chat — JSON (no SSE) compat layer backed by Kiwi Agent (`runKiwiAgent`).
 * El chat interactivo vive en POST /api/kiwi/chat (streaming SSE).
 */
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.id ?? req.ip ?? 'anon',
  message: { error: 'Demasiadas solicitudes de IA. Espera un momento e intenta de nuevo.' },
});

router.use(aiRateLimiter);

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Usa POST /api/kiwi/chat para streaming Kiwi. POST /api/ai/chat devuelve JSON vía la misma pila Kiwi.',
    timestamp: new Date().toISOString(),
  });
});

router.post('/chat', protect, async (req: AuthRequest, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawMsg = body.message;
    const newUserMessage = typeof rawMsg === 'string' ? rawMsg.trim() : '';
    if (!newUserMessage) {
      return res.status(400).json({
        success: false,
        response: 'El campo "message" es obligatorio y debe ser una cadena de texto.',
        error: 'El campo "message" es obligatorio y debe ser una cadena de texto.',
      });
    }

    const userId = req.user!.id;
    const institutionId = req.user!.institution_id ?? req.user!.colegioId;
    const rol = req.user!.rol;

    const guardrailCheck = validateInput(newUserMessage);
    if (!guardrailCheck.allowed && guardrailCheck.reason !== 'crisis_detected') {
      return res.status(400).json({
        success: false,
        error: guardrailCheck.reason ?? 'Validación rechazada.',
      });
    }

    if (guardrailCheck.reason === 'crisis_detected') {
      const crisisMsg = getCrisisResponse();
      return res.json({
        success: true,
        response: crisisMsg,
        streamingEndpoint: '/api/kiwi/chat',
        timestamp: new Date().toISOString(),
      });
    }

    const session = await getOrCreateSession(userId, institutionId, rol);
    const sessionId = session.id;
    const memory = await getUserMemory(userId, rol);

    const kiwiContext: KiwiUserContext = {
      userId,
      institutionId,
      rol,
      nombre: '',
      sessionId,
      memory,
    };

    const { sanitized: safeUserMsg } = sanitizeText(newUserMessage);
    await saveMessage(sessionId, userId, institutionId, 'user', safeUserMsg);

    let collected = '';
    let kiwiFailure: Error | undefined;

    const useStrongModel =
      rol === 'padre' ||
      /\bnotas?\b|evo\s*doc|evodoc|análisis|analisis|rendimiento|desempeño|desempeno|pdf|bolet[ií]n/i.test(
        safeUserMsg,
      );

    await runKiwiAgent(
      safeUserMsg,
      kiwiContext,
      {
        onChunk(chunk: string) {
          collected += chunk;
        },
        onToolStep() {},
        onComplete(_fullResponse: string, _tokensUsed: number) {},
        onError(err: Error) {
          kiwiFailure = err;
        },
      },
      useStrongModel
        ? { model: 'gpt-4o', maxOutputTokens: 4000 }
        : { model: 'gpt-4o-mini', maxOutputTokens: 1200 },
    );

    if (!kiwiFailure) {
    const merged = collected.trim().length > 0 ? collected : '';

    const outputCheck = validateOutput(merged);
    const aiResponse = outputCheck.safe ? merged : outputCheck.filtered ?? merged;
    await saveMessage(sessionId, userId, institutionId, 'assistant', aiResponse);

    res.json({
      success: true,
      response: aiResponse,
      sessionId,
      chatId: sessionId,
      userId,
      role: rol,
      executedActions: [] as string[],
      streamingEndpoint: '/api/kiwi/chat',
      timestamp: new Date().toISOString(),
    });
    } else {
      console.error('[API /ai/chat] Kiwi:', kiwiFailure.message);
      if (kiwiFailure.message.includes('OPENAI_API_KEY')) {
        return res.status(500).json({
          success: false,
          response:
            'El servicio de IA no está configurado correctamente. Por favor, contacta al administrador.',
          error:
            'El servicio de IA no está configurado correctamente. Por favor, contacta al administrador.',
        });
      }
      if (kiwiFailure.message.includes('rate limit') || kiwiFailure.message.includes('quota')) {
        return res.status(429).json({
          success: false,
          response:
            'Se ha excedido el límite de uso del servicio de IA. Por favor, intenta más tarde.',
          error:
            'Se ha excedido el límite de uso del servicio de IA. Por favor, intenta más tarde.',
        });
      }
      return res.status(500).json({
        success: false,
        response: kiwiFailure.message,
        error: kiwiFailure.message,
      });
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Error en /api/ai/chat:', errMsg);

    if (typeof errMsg === 'string' && errMsg.includes('OPENAI_API_KEY')) {
      return res.status(500).json({
        success: false,
        response:
          'El servicio de IA no está configurado correctamente. Por favor, contacta al administrador.',
        error:
          'El servicio de IA no está configurado correctamente. Por favor, contacta al administrador.',
      });
    }

    if (typeof errMsg === 'string' && (errMsg.includes('rate limit') || errMsg.includes('quota'))) {
      return res.status(429).json({
        success: false,
        response:
          'Se ha excedido el límite de uso del servicio de IA. Por favor, intenta más tarde.',
        error:
          'Se ha excedido el límite de uso del servicio de IA. Por favor, intenta más tarde.',
      });
    }

    res.status(500).json({
      success: false,
      response: errMsg || 'Error al procesar la solicitud del chat AI.',
      error: errMsg || 'Error al procesar la solicitud del chat AI.',
    });
  }
});

export default router;
