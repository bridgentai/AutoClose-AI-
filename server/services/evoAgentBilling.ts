/**
 * Cuotas por institución para Evo Agent (mensajes de chat / día).
 * Usa institutions.settings.evo_agent.daily_message_budget (default amplio en dev).
 */

import { findInstitutionById } from '../repositories/institutionRepository.js';

export interface EvoAgentBudgetSettings {
  /** Máximo de mensajes Evo Agent por día e institución (0 = usar default). */
  daily_message_budget?: number;
}

function dayKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const usageByDay = new Map<string, number>();
const DEFAULT_DAILY_CAP = 5000;

function parseSettings(raw: Record<string, unknown> | undefined): EvoAgentBudgetSettings {
  const evo = raw?.evo_agent as Record<string, unknown> | undefined;
  if (!evo || typeof evo !== 'object') return {};
  const daily = evo.daily_message_budget;
  const daily_message_budget =
    typeof daily === 'number' && Number.isFinite(daily) ? Math.max(0, Math.floor(daily)) : undefined;
  return { daily_message_budget };
}

export async function getInstitutionEvoAgentDailyCap(institutionId: string): Promise<number> {
  const inst = await findInstitutionById(institutionId);
  const { daily_message_budget } = parseSettings(inst?.settings);
  if (daily_message_budget != null && daily_message_budget > 0) {
    return daily_message_budget;
  }
  return DEFAULT_DAILY_CAP;
}

export interface ReserveResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/**
 * Reserva un slot de mensaje para la institución (best-effort en memoria).
 * Para producción multi-instancia usar Redis con INCR + EXPIRE.
 */
export async function reserveEvoAgentMessage(institutionId: string): Promise<ReserveResult> {
  const limit = await getInstitutionEvoAgentDailyCap(institutionId);
  const key = `${institutionId}:${dayKeyUtc(new Date())}`;
  const current = usageByDay.get(key) ?? 0;
  if (current >= limit) {
    return { allowed: false, remaining: 0, limit };
  }
  usageByDay.set(key, current + 1);

  if (usageByDay.size > 50_000) {
    const prefix = `${dayKeyUtc(new Date())}`;
    for (const k of usageByDay.keys()) {
      if (!k.endsWith(prefix)) usageByDay.delete(k);
    }
  }

  return { allowed: true, remaining: limit - current - 1, limit };
}

/** Hook para futura facturación por uso (tokens, llamadas API). */
export function recordEvoAgentUsageForBilling(
  institutionId: string,
  meta: { userId: string; estimatedTokens?: number; channel: 'evo-agent' | 'kiwi' },
): void {
  void institutionId;
  void meta;
  // Integrar con proveedor de billing / warehouse cuando exista producto comercial.
}
