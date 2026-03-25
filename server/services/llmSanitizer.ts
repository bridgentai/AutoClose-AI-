/**
 * Reemplaza PII (nombres, emails, documentos) con tokens anónimos
 * antes de enviar cualquier dato a OpenAI.
 */

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
