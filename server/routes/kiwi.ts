import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import {
  getOrCreateSession,
  getUserMemory,
  saveMessage,
} from '../repositories/kiwiRepository.js';
import { generateKiwiResponse } from '../services/openai.js';
import type { KiwiUserContext } from '../services/kiwiContext.js';
import { executeKiwiAction } from '../services/kiwiActions.js';

const router = express.Router();

/**
 * POST /api/kiwi/chat
 * Endpoint SSE para el agente Kiwi.
 * Emite chunks de texto en tiempo real usando Server-Sent Events.
 */
router.post('/chat', protect, async (req: AuthRequest, res) => {
  const { message } = req.body;

  // 1. Validar message
  const userMessage = typeof message === 'string' ? message.trim() : '';
  if (!userMessage) {
    return res.status(400).json({ error: 'El campo "message" es obligatorio.' });
  }

  // 2. Extraer datos del usuario autenticado
  const userId = req.user!.id;
  const institutionId = req.user!.institution_id ?? req.user!.colegioId;
  const rol = req.user!.rol;
  // TODO: agregar nombre del usuario a AuthRequest.user cuando esté disponible en el token
  const nombre = '';

  try {
    // 3. Sesión activa (o nueva si no hay una en las últimas 24h)
    const session = await getOrCreateSession(userId, institutionId, rol);
    const sessionId = session.id;

    // 4. Memoria persistente del usuario
    const memory = await getUserMemory(userId, rol);

    // 5. Construir KiwiUserContext
    const kiwiContext: KiwiUserContext = {
      userId,
      institutionId,
      rol,
      nombre,
      sessionId,
      memory,
    };

    // 6. Guardar mensaje del usuario antes de responder
    await saveMessage(sessionId, userId, institutionId, 'user', userMessage);

    // 7. Configurar SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    // 7.5 Confirmaciones: bypass LLM y ejecuta tool directamente
    // Formato: "KIWI_CONFIRM {\"tool\":\"create_assignment\",\"params\":{...}}"
    if (userMessage.startsWith('KIWI_CONFIRM')) {
      try {
        const raw = userMessage.slice('KIWI_CONFIRM'.length).trim();
        const payload = raw ? JSON.parse(raw) as { tool?: string; params?: Record<string, unknown> } : {};
        const tool = String(payload.tool || '').trim();
        const params = (payload.params && typeof payload.params === 'object') ? payload.params : {};
        if (!tool) throw new Error('Confirmación inválida (tool faltante).');
        const confirmedParams = { ...params, confirmed: true };

        const result = await executeKiwiAction(tool, confirmedParams, institutionId, userId, rol);
        const text =
          result.success
            ? tool === 'create_assignment'
              ? `Listo. Ya creé la tarea. Puedes verla aquí: /assignment/${(result as { success: true; data: { assignmentId?: string } }).data?.assignmentId ?? ''}`
              : 'Listo. Acción confirmada y ejecutada.'
            : `No pude completar la acción: ${(result as { success: false; error?: string }).error ?? 'error desconocido'}`;

        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
          res.end();
          closed = true;
        }
        await saveMessage(sessionId, userId, institutionId, 'assistant', text);
        return;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error procesando confirmación';
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
          res.end();
          closed = true;
        }
        return;
      }
    }

    // 8. Llamar al agente Kiwi con streaming
    await generateKiwiResponse(
      userMessage,
      kiwiContext,
      (chunk) => {
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
        }
      },
      async (fullResponse, tokensUsed) => {
        try {
          await saveMessage(sessionId, userId, institutionId, 'assistant', fullResponse, tokensUsed);
        } catch (err) {
          console.warn('[Kiwi] saveMessage assistant falló (no crítico):', (err as Error)?.message ?? err);
        }
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
          res.end();
          closed = true;
        }
      },
      (error) => {
        console.error('[Kiwi] generateKiwiResponse error:', error.message);
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          res.end();
          closed = true;
        }
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    console.error('[Kiwi] Error en /chat:', message);
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
        res.end();
      }
    } else {
      res.status(500).json({ error: message });
    }
  }
});

export default router;
