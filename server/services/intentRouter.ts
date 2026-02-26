/**
 * Capa de interpretación de intención para el chat.
 * Detecta "muéstrame", "mostrar", "ver", "enséñame" y enruta a respuestas estructuradas
 * sin que el modelo decida el tipo de render.
 */

export type VisualIntentType =
  | 'top_student_card'
  | 'tasks_overview'
  | 'grade_trend_analysis'
  | 'notes_overview'
  | 'text';

export interface ParsedIntent {
  matched: boolean;
  intent?: VisualIntentType;
  params?: { group?: string; period?: string };
}

const SHOW_PREFIXES = /^\s*(mu[eé]strame|mostrar|ver|ens[eé][nñ]ame|dame|quiero\s+ver)\s+/i;
const GROUP_PATTERN = /\b(1[0-2][A-Z]|[0-9][A-Z])\b/i;

// Patrones por intención (dentro de mensajes que ya pasaron el prefijo "mostrar")
const PATTERN_TOP_STUDENT = /(?:mejor\s+promedio|promedio\s+m[aá]s\s+alto|qui[eé]n\s+tiene\s+(?:el\s+)?mejor|mejor\s+estudiante|primero\s+del\s+grupo|top\s+estudiante)/i;
const PATTERN_TASKS = /(?:tareas?|asignaciones?|entregas?)\s*(?:del?\s+)?/i;
const PATTERN_TREND = /(?:tendencias?|an[aá]lisis|evoluci[oó]n|progreso|trimestre|semestre|tendencia\s+de\s+notas)/i;
const PATTERN_NOTAS = /(?:notas?|calificaciones?)\s*(?:del?\s+(?:grupo\s+)?)?|acceder\s+a\s+(?:las\s+)?notas|ver\s+las\s+notas/i;

/**
 * Parsea el mensaje y devuelve si debe mostrarse como UI estructurada y con qué tipo/parámetros.
 */
export function parseVisualIntent(message: string): ParsedIntent {
  const trimmed = message.trim();
  if (!trimmed) return { matched: false };

  const withPrefix = SHOW_PREFIXES.test(trimmed);
  const rest = trimmed.replace(SHOW_PREFIXES, '').trim();

  if (!withPrefix) {
    // También aceptar mensajes que empiecen por la intención directa (ej. "mejor promedio en 11H", "notas de 11H")
    if (PATTERN_TOP_STUDENT.test(trimmed)) {
      const groupMatch = trimmed.match(GROUP_PATTERN);
      return {
        matched: true,
        intent: 'top_student_card',
        params: { group: groupMatch ? groupMatch[0].toUpperCase() : undefined },
      };
    }
    if (PATTERN_NOTAS.test(trimmed)) {
      const groupMatch = trimmed.match(GROUP_PATTERN);
      return {
        matched: true,
        intent: 'notes_overview',
        params: { group: groupMatch ? groupMatch[0].toUpperCase() : undefined },
      };
    }
    return { matched: false };
  }

  const groupMatch = rest.match(GROUP_PATTERN) || trimmed.match(GROUP_PATTERN);
  const group = groupMatch ? groupMatch[0].toUpperCase() : undefined;

  if (PATTERN_TOP_STUDENT.test(rest) || PATTERN_TOP_STUDENT.test(trimmed)) {
    return { matched: true, intent: 'top_student_card', params: { group } };
  }
  if (PATTERN_TASKS.test(rest) || /\btareas?\b/i.test(rest) || /\basignaciones?\b/i.test(rest)) {
    return { matched: true, intent: 'tasks_overview', params: { group } };
  }
  if (PATTERN_TREND.test(rest) || PATTERN_TREND.test(trimmed)) {
    return { matched: true, intent: 'grade_trend_analysis', params: { period: 'trimestre' } };
  }
  if (PATTERN_NOTAS.test(rest) || PATTERN_NOTAS.test(trimmed)) {
    return { matched: true, intent: 'notes_overview', params: { group } };
  }

  return { matched: false };
}
