import * as dataQuery from './legacy/dataQuery';

export type StructuredResponseType = 'text' | 'top_student_card';

export interface TopStudentCardData {
  studentName: string;
  average: number;
  group: string;
  ranking: number;
  ctaRoute: string;
}

export interface StructuredResponse {
  type: StructuredResponseType;
  content: string;
  data?: TopStudentCardData;
}

const MEJOR_PROMEDIO_PATTERN = /(?:mejor\s+promedio|promedio\s+más\s+alto|quién\s+(?:tiene|tiene\s+el)\s+(?:el\s+)?mejor|mejor\s+estudiante|primero\s+del\s+grupo)/i;
const GROUP_PATTERN = /\b(1[0-2][A-Z]|[0-9][A-Z])\b/i;

/**
 * Detecta si el mensaje pide "mejor promedio en [grupo]" y extrae el grupo.
 */
export function detectTopStudentIntent(message: string): { match: boolean; group?: string } {
  const trimmed = message.trim();
  if (!MEJOR_PROMEDIO_PATTERN.test(trimmed)) return { match: false };
  const groupMatch = trimmed.match(GROUP_PATTERN);
  const group = groupMatch ? groupMatch[0].toUpperCase() : undefined;
  return { match: true, group };
}

/**
 * Ejecuta la lógica determinística para "mejor promedio en grupo" y devuelve respuesta estructurada.
 */
export async function handleTopStudentInGroup(
  profesorId: string,
  groupName: string,
  colegioId: string
): Promise<StructuredResponse> {
  const result = await dataQuery.queryTopStudentInGroup(profesorId, groupName, colegioId);
  if (!result) {
    return {
      type: 'text',
      content: `No encontré notas para el grupo ${groupName} en tus materias. Verifica que el grupo exista y que tengas calificaciones cargadas.`,
    };
  }
  return {
    type: 'top_student_card',
    content: `${result.studentName} tiene el mejor promedio en ${result.group}: ${result.average}.`,
    data: {
      studentName: result.studentName,
      average: result.average,
      group: result.group,
      ranking: result.ranking,
      ctaRoute: result.ctaRoute,
    },
  };
}
