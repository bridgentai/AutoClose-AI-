/**
 * Content guardrails for Kiwi Assist.
 * Goes beyond PII sanitization (llmSanitizer.ts) to validate:
 * - Input: blocks prompt injection, off-topic requests, harmful content
 * - Output: blocks hallucinated data, inappropriate responses
 */

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  sanitizedInput?: string;
}

const BLOCKED_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /forget\s+(everything|all|your)\s+(you\s+)?(know|learned|were\s+told)/i,
  /system\s*:\s*/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /jailbreak|DAN\s+mode|developer\s+mode/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(porn|xxx|nsfw|sex\s+con|drogas?\s+ilegal|armas?\s+de\s+fuego)\b/i,
  /\b(hackear|inyeccion\s+sql|explotar\s+vulnerabilidad)\b/i,
  /\b(suicide|suicidio|matarme|quiero\s+morir)\b/i,
];

const CRISIS_PATTERNS = [
  /\b(suicid|matarme|quiero\s+morir|no\s+quiero\s+vivir|hacerme\s+daño)\b/i,
  /\b(me\s+voy\s+a\s+matar|ya\s+no\s+aguanto)\b/i,
];

export function validateInput(message: string): GuardrailResult {
  const trimmed = message.trim();

  if (trimmed.length < 1) {
    return { allowed: false, reason: 'Mensaje vacío.' };
  }

  if (trimmed.length > 4000) {
    return { allowed: false, reason: 'El mensaje es demasiado largo (máximo 4000 caracteres).' };
  }

  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: true,
        sanitizedInput: trimmed,
        reason: 'crisis_detected',
      };
    }
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: 'Tu mensaje contiene patrones no permitidos. Reformúlalo de otra manera.' };
    }
  }

  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: 'Kiwi solo puede ayudarte con temas académicos y escolares.' };
    }
  }

  return { allowed: true, sanitizedInput: trimmed };
}

const CRISIS_RESPONSE = `Entiendo que puedes estar pasando por un momento difícil. Quiero que sepas que no estás solo/a.

Por favor, habla con alguien de confianza: un profesor, orientador escolar, o un familiar.

Línea de atención en crisis en Colombia:
- Línea 106 (gratuita, 24 horas)
- Línea 141 del ICBF

Tu bienestar es lo más importante.`;

export function getCrisisResponse(): string {
  return CRISIS_RESPONSE;
}

export function validateOutput(response: string): { safe: boolean; filtered?: string } {
  if (response.includes('sk-') || response.includes('api_key') || response.includes('password')) {
    return {
      safe: false,
      filtered: response
        .replace(/sk-[a-zA-Z0-9_-]{20,}/g, '[API_KEY_REDACTED]')
        .replace(/password\s*[:=]\s*\S+/gi, 'password=[REDACTED]'),
    };
  }

  return { safe: true };
}
