/**
 * Ventana de envío de Evo Send para estudiantes: solo entre 7:00 y 19:00 (hora local configurable).
 * Tipos de hilo considerados "grupos" (no aplica a soporte 1-1 u otros comunicados legacy).
 */
const GROUP_THREAD_TYPES = new Set(['evo_chat', 'evo_chat_staff', 'evo_chat_direct']);

export function isStudentGroupEvoThreadType(tipo: string): boolean {
  return GROUP_THREAD_TYPES.has(tipo);
}

export function getEvoSendStudentChatTimezone(): string {
  const tz = process.env.EVO_SEND_STUDENT_CHAT_TZ?.trim();
  return tz && tz.length > 0 ? tz : 'America/Bogota';
}

/** true si la hora local en `timeZone` está en [07:00, 19:00) — desde las 7:00 hasta antes de las 19:00 (7 PM). */
export function isWithinStudentEvoSendWriteWindow(now: Date = new Date(), timeZone: string = getEvoSendStudentChatTimezone()): boolean {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const total = hour * 60 + minute;
  const start = 7 * 60;
  const end = 19 * 60;
  return total >= start && total < end;
}

export function studentCanWriteEvoSendNow(rol: string | undefined, threadType: string, now?: Date): boolean {
  if (rol !== 'estudiante') return true;
  if (!isStudentGroupEvoThreadType(threadType)) return true;
  return isWithinStudentEvoSendWriteWindow(now);
}
