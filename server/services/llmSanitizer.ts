/**
 * Reemplaza PII (nombres, emails, documentos) con tokens anónimos
 * antes de enviar cualquier dato a OpenAI.
 */
import { randomInt } from 'crypto';
import { saveAnonToken } from '../repositories/kiwiRepository.js';

export interface SanitizationResult {
  sanitized: string;
  dictionary: Record<string, string>;
}

export interface SanitizerContext {
  studentNames?: string[];
  teacherNames?: string[];
  emails?: string[];
  documentIds?: string[];
}

export function sanitizeText(text: string, context: SanitizerContext = {}): SanitizationResult {
  const dictionary: Record<string, string> = {};
  let sanitized = text;
  let studentCounter = 1;
  let teacherCounter = 1;
  let emailCounter = 1;
  let docCounter = 1;

  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  sanitized = sanitized.replace(emailRegex, (match) => {
    const token = `[EMAIL_${emailCounter++}]`;
    dictionary[token] = match;
    return token;
  });

  if (context.studentNames) {
    for (const name of context.studentNames) {
      if (!name || name.trim() === '') continue;
      const token = `[EST_${studentCounter++}]`;
      dictionary[token] = name;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      sanitized = sanitized.replace(new RegExp(escaped, 'gi'), token);
    }
  }

  if (context.teacherNames) {
    for (const name of context.teacherNames) {
      if (!name || name.trim() === '') continue;
      const token = `[PROF_${teacherCounter++}]`;
      dictionary[token] = name;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      sanitized = sanitized.replace(new RegExp(escaped, 'gi'), token);
    }
  }

  const docRegex = /[VEveJ]-?\d{6,9}/g;
  sanitized = sanitized.replace(docRegex, (match) => {
    const token = `[DOC_${docCounter++}]`;
    dictionary[token] = match;
    return token;
  });

  return { sanitized, dictionary };
}

/**
 * Elimina pseudónimos internos [EST_n] / EST_n del texto generado por la IA
 * antes de mostrarlo al usuario (se siguen usando en el contexto enviado a OpenAI).
 */
export function stripInternalStudentTokensForDisplay(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let s = text.replace(/\s*\[EST_\d+\]\s*/gi, ' ');
  s = s.replace(/\bEST_\d+\b/gi, '');
  s = s.replace(/\bEST\d+\b/gi, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

export function sanitizeMessages(
  messages: Array<{ role: string; content: string | null | undefined; [key: string]: unknown }>,
  context: SanitizerContext = {}
): { messages: Array<{ role: string; content: string | null | undefined; [key: string]: unknown }>; dictionary: Record<string, string> } {
  const globalDictionary: Record<string, string> = {};

  const sanitizedMessages = messages.map((msg) => {
    if (msg.content == null || typeof msg.content !== 'string') return msg;
    const { sanitized, dictionary } = sanitizeText(msg.content, context);
    Object.assign(globalDictionary, dictionary);
    return { ...msg, content: sanitized };
  });

  return { messages: sanitizedMessages, dictionary: globalDictionary };
}

// ─── Tipos para sanitización persistente ────────────────────────────────────

export interface NameEntry {
  /** Nombre real de la persona (se tokeniza antes de enviar a OpenAI). */
  name: string;
  /** UUID del usuario en la tabla users (FK requerida por anon_tokens). */
  userId: string;
}

export interface PersistentSanitizerContext {
  students?: NameEntry[];
  teachers?: NameEntry[];
}

export interface PersistentSanitizationResult {
  sanitizedText: string;
  /** Mapa token → nombre real. Solo para desanitizar al mostrar al usuario. */
  tokenMap: Map<string, string>;
}

// ─── Sanitización persistente (Kiwi / Ley 1581) ─────────────────────────────

/**
 * Reemplaza nombres de personas con tokens anónimos persistentes (EST-XXXX / PROF-XXXX).
 * Para cada nombre en el contexto, persiste el mapeo en anon_tokens (best-effort).
 * Devuelve el texto sanitizado y el tokenMap necesario para desanitizar la respuesta.
 *
 * El parámetro `context` es opcional: si no se pasa, el texto se devuelve sin cambios
 * y el tokenMap estará vacío.
 */
export async function sanitizeForOpenAI(
  text: string,
  institutionId: string,
  sessionId: string | null,
  context: PersistentSanitizerContext = {}
): Promise<PersistentSanitizationResult> {
  const tokenMap = new Map<string, string>();
  let sanitizedText = text;

  const replaceAndPersist = async (
    entries: NameEntry[],
    prefix: 'EST' | 'PROF'
  ): Promise<void> => {
    for (const entry of entries) {
      if (!entry.name || entry.name.trim() === '') continue;

      const digits = String(randomInt(1000, 9999));
      const token = `[${prefix}-${digits}]`;

      const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      sanitizedText = sanitizedText.replace(new RegExp(escaped, 'gi'), token);
      tokenMap.set(token, entry.name);

      // Persistencia best-effort — no bloquea el flujo si la DB falla
      saveAnonToken(institutionId, entry.userId, token, sessionId).catch((err) => {
        console.warn('[llmSanitizer] saveAnonToken falló (no crítico):', err?.message ?? err);
      });
    }
  };

  await replaceAndPersist(context.students ?? [], 'EST');
  await replaceAndPersist(context.teachers ?? [], 'PROF');

  return { sanitizedText, tokenMap };
}

/**
 * Reemplaza tokens [EST-XXXX] y [PROF-XXXX] de vuelta por los nombres reales.
 * Solo para mostrar al usuario final — nunca persistir el resultado.
 */
export function desanitizeResponse(
  text: string,
  tokenMap: Map<string, string>
): string {
  if (!text || tokenMap.size === 0) return text;
  let result = text;
  Array.from(tokenMap.entries()).forEach(([token, realName]) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), realName);
  });
  return result;
}

/**
 * Retorna el bloque de reglas de protección de menores que se inyecta en el system prompt.
 * Basado en Ley 1581 de 2012 (Habeas Data) y Ley 1098 de 2006 (Código de Infancia).
 */
export function buildMinorProtectionRules(): string {
  return `
REGLAS DE PROTECCIÓN DE MENORES DE EDAD (Cumplimiento normativo Colombia):

1. [Ley 1581/2012 - Habeas Data] No menciones ni reveles nombres reales, documentos de identidad, direcciones ni datos de contacto de estudiantes menores de edad en tus respuestas. Usa únicamente los tokens anónimos proporcionados en el contexto.

2. [Código de Infancia y Adolescencia - Ley 1098/2006, Art. 33-34] No infieras, estimes ni reveles información que permita identificar la ubicación física, rutina diaria o patrones de movilidad de menores de edad.

3. [Ley 1581/2012, Art. 5 - Datos Sensibles] No proceses ni incluyas en tus respuestas datos biométricos, de salud, origen étnico, orientación sexual, creencias religiosas ni información política de menores de edad.

4. [Principio de finalidad - Ley 1581/2012, Art. 4b] Toda información sobre menores debe usarse exclusivamente para los fines académicos de esta consulta. No cruces datos entre estudiantes ni construyas perfiles más allá de lo estrictamente solicitado.

5. [Principio de minimización] Ante la duda, omite el dato. Si la respuesta es igualmente útil sin mencionar información personal de un menor, no la incluyas.
`.trim();
}

// ─── PII fields (sanitizeContextObject) ─────────────────────────────────────

const PII_FIELDS = ['email', 'telefono', 'phone', 'documento', 'cedula', 'dni', 'passport'] as const;

export function sanitizeContextObject<T extends Record<string, unknown>>(obj: T): T {
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !PII_FIELDS.includes(key.toLowerCase() as (typeof PII_FIELDS)[number]))
          .map(([key, val]) => [key, clean(val)])
      );
    }
    return value;
  };

  return clean(obj) as T;
}
