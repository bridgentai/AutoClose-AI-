import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { reserveEvoAgentMessage, recordEvoAgentUsageForBilling } from '../services/evoAgentBilling.js';

export async function evoAgentBudgetMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const institutionId = req.user!.institution_id ?? req.user!.colegioId;
  const r = await reserveEvoAgentMessage(institutionId);
  if (!r.allowed) {
    res.status(429).json({
      error: 'Límite diario de Evo Agent alcanzado para tu institución.',
      limit: r.limit,
      remaining: r.remaining,
    });
    return;
  }
  recordEvoAgentUsageForBilling(institutionId, {
    userId: req.user!.id,
    channel: 'evo-agent',
  });
  next();
}
