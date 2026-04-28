/**
 * Evo Agent — capa de producto sobre Kiwi con cuota por institución.
 * POST /api/evo-agent/chat acepta el mismo cuerpo que /api/kiwi/chat.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect, type AuthRequest } from '../middleware/auth.js';
import { handleKiwiSseChat } from './kiwiChatHandler.js';
import { evoAgentBudgetMiddleware } from '../middleware/evoAgentBudget.js';

const router = express.Router();

const evoAgentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.id ?? req.ip ?? 'anon',
  message: { error: 'Demasiadas solicitudes a Evo Agent. Espera un momento e intenta de nuevo.' },
});

router.use(evoAgentRateLimiter);

router.get('/health', protect, (req: AuthRequest, res) => {
  res.json({
    product: 'evo-agent',
    status: 'ok',
    userId: req.user?.id,
    institutionId: req.user?.institution_id ?? req.user?.colegioId,
    chat: 'POST /api/evo-agent/chat (mismo contrato que /api/kiwi/chat)',
  });
});

router.post('/chat', protect, evoAgentBudgetMiddleware, handleKiwiSseChat);

export default router;
