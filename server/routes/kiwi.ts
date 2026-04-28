import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect, type AuthRequest } from '../middleware/auth.js';
import { handleKiwiSseChat } from './kiwiChatHandler.js';

const router = express.Router();

const kiwiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.id ?? req.ip ?? 'anon',
  message: { error: 'Demasiadas solicitudes a Kiwi. Espera un momento e intenta de nuevo.' },
});

router.use(kiwiRateLimiter);

router.post('/chat', protect, handleKiwiSseChat);

export default router;
