/**
 * Shared helpers for POST /api/kiwi/chat SSE streams (Kiwi Agent).
 */

export function isKiwiConfirmPayload(text: string): boolean {
  return typeof text === 'string' && text.startsWith('__CONFIRM__:');
}

export function parseKiwiConfirmPayload(text: string): Record<string, unknown> | null {
  if (!isKiwiConfirmPayload(text)) return null;
  const raw = text.slice('__CONFIRM__:'.length).trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

export interface KiwiSseEvent {
  type: string;
  text?: string;
  sessionId?: string;
  message?: string;
  tool?: string;
  status?: string;
}

export function parseKiwiSseLine(line: string): KiwiSseEvent | null {
  if (!line.startsWith('data: ')) return null;
  const jsonStr = line.slice(6).trim();
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr) as KiwiSseEvent;
  } catch {
    return null;
  }
}
