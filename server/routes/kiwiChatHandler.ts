import type { Response } from 'express';
import {
  getOrCreateSession,
  getUserMemory,
  saveMessage,
} from '../repositories/kiwiRepository.js';
import { runKiwiAgent } from '../services/kiwiAgent.js';
import type { KiwiUserContext } from '../services/kiwiContext.js';
import { executeKiwiAction } from '../services/kiwiActions.js';
import { validateInput, getCrisisResponse, validateOutput } from '../services/kiwiGuardrails.js';
import { findGuardianStudent } from '../repositories/guardianStudentRepository.js';
import type { AuthRequest } from '../middleware/auth.js';

function readBodyBool(v: unknown): boolean {
  return v === true || v === 'true';
}

/**
 * Handler SSE compartido por POST /api/kiwi/chat y POST /api/evo-agent/chat.
 */
export async function handleKiwiSseChat(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown> | undefined;
  const { message } = body ?? {};

  const userMessage = typeof message === 'string' ? message.trim() : '';
  if (!userMessage) {
    res.status(400).json({ error: 'El campo "message" es obligatorio.' });
    return;
  }

  const intentRaw = typeof body?.intent === 'string' ? body.intent.trim() : '';
  const generateEvoDocFlag = readBodyBool(body?.generateEvoDoc);
  const bodyStudentId = typeof body?.studentId === 'string' ? body.studentId.trim() : '';

  const userId = req.user!.id;
  const institutionId = req.user!.institution_id ?? req.user!.colegioId;
  const rol = req.user!.rol;
  const nombre = '';

  try {
    const session = await getOrCreateSession(userId, institutionId, rol);
    const sessionId = session.id;

    const memory = await getUserMemory(userId, rol);

    const kiwiContext: KiwiUserContext = {
      userId,
      institutionId,
      rol,
      nombre,
      sessionId,
      memory,
    };

    await saveMessage(sessionId, userId, institutionId, 'user', userMessage);

    const guardrailCheck = validateInput(userMessage);
    if (!guardrailCheck.allowed) {
      res.json({ error: guardrailCheck.reason });
      return;
    }

    if (guardrailCheck.reason === 'crisis_detected') {
      const crisisMsg = getCrisisResponse();
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: crisisMsg })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
      res.end();
      await saveMessage(sessionId, userId, institutionId, 'assistant', crisisMsg);
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    if (userMessage.startsWith('KIWI_CONFIRM')) {
      try {
        const raw = userMessage.slice('KIWI_CONFIRM'.length).trim();
        const payload = raw ? JSON.parse(raw) as { tool?: string; params?: Record<string, unknown> } : {};
        const tool = String(payload.tool || '').trim();
        const params = payload.params && typeof payload.params === 'object' ? payload.params : {};
        if (!tool) throw new Error('Confirmación inválida (tool faltante).');
        const confirmedParams = { ...params, confirmed: true };

        const result = await executeKiwiAction(tool, confirmedParams, institutionId, userId, rol);
        const text = result.success
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

    const shouldForceParentEvoDoc =
      rol === 'padre' && (generateEvoDocFlag || intentRaw === 'parent_notes_evo_doc');

    if (shouldForceParentEvoDoc) {
      let validatedChildId: string | undefined;
      if (bodyStudentId) {
        const link = await findGuardianStudent(userId, bodyStudentId);
        if (!link || link.institution_id !== institutionId) {
          if (!closed) {
            res.write(
              `data: ${JSON.stringify({
                type: 'error',
                message: 'No tienes permiso para generar documentos de ese estudiante.',
              })}\n\n`,
            );
            res.end();
            closed = true;
          }
          return;
        }
        validatedChildId = bodyStudentId;
      }

      const toolParams: Record<string, unknown> = {
        title: `Análisis académico — ${new Date().getFullYear()}`,
        docType: 'student_analysis',
      };
      if (validatedChildId) toolParams.subjectId = validatedChildId;

      if (!closed) {
        res.write(`data: ${JSON.stringify({ type: 'tool_step', tool: 'generate_evo_doc', status: 'start' })}\n\n`);
      }

      const forced = await executeKiwiAction('generate_evo_doc', toolParams, institutionId, userId, rol);

      if (!closed) {
        res.write(`data: ${JSON.stringify({ type: 'tool_step', tool: 'generate_evo_doc', status: 'done' })}\n\n`);
      }

      if (forced.success && forced.data && typeof forced.data === 'object' && '__type' in forced.data) {
        const docPayload = forced.data as Record<string, unknown>;
        const chunk = `__EVO_DOC__:${JSON.stringify(docPayload)}`;
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
        }
        const assistantNote =
          'Generé tu Evo Doc con el análisis académico desde los datos del sistema. Abre la tarjeta para ver el PDF.';
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: assistantNote })}\n\n`);
        }
        try {
          await saveMessage(sessionId, userId, institutionId, 'assistant', assistantNote, 0);
        } catch (err) {
          console.warn('[Kiwi] saveMessage assistant failed (non-critical):', (err as Error)?.message ?? err);
        }
      } else {
        const errText =
          forced.success === false && 'error' in forced
            ? forced.error
            : 'No se pudo generar el Evo Doc.';
        if (!closed) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: errText })}\n\n`);
        }
        try {
          await saveMessage(sessionId, userId, institutionId, 'assistant', errText, 0);
        } catch (err) {
          console.warn('[Kiwi] saveMessage assistant failed (non-critical):', (err as Error)?.message ?? err);
        }
      }

      if (!closed) {
        res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
        res.end();
        closed = true;
      }
      return;
    }

    const useStrongModel =
      rol === 'padre' ||
      intentRaw === 'parent_notes_evo_doc' ||
      /\bnotas?\b|evo\s*doc|evodoc|análisis|analisis|rendimiento|desempeño|desempeno|pdf|bolet[ií]n/i.test(
        userMessage,
      );

    await runKiwiAgent(
      userMessage,
      kiwiContext,
      {
        onChunk(chunk) {
          if (!closed) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
          }
        },
        onToolStep(toolName, status) {
          if (!closed) {
            res.write(`data: ${JSON.stringify({ type: 'tool_step', tool: toolName, status })}\n\n`);
          }
        },
        async onComplete(fullResponse, tokensUsed) {
          const outputCheck = validateOutput(fullResponse);
          const safeResponse = outputCheck.safe ? fullResponse : (outputCheck.filtered ?? fullResponse);
          try {
            await saveMessage(sessionId, userId, institutionId, 'assistant', safeResponse, tokensUsed);
          } catch (err) {
            console.warn('[Kiwi] saveMessage assistant failed (non-critical):', (err as Error)?.message ?? err);
          }
          if (!closed) {
            res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
            res.end();
            closed = true;
          }
        },
        onError(error) {
          console.error('[KiwiAgent] error:', error.message);
          if (!closed) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
            closed = true;
          }
        },
      },
      useStrongModel ? { model: 'gpt-4o', maxOutputTokens: 4000 } : { model: 'gpt-4o-mini' },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno del servidor';
    console.error('[Kiwi] Error en /chat:', msg);
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
        res.end();
      }
    } else {
      res.status(500).json({ error: msg });
    }
  }
}
