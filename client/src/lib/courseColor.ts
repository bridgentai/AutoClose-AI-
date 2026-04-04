export interface GroupSubjectColorInput {
  groupSubjectId?: string | null;
  fallbackId?: string | null;
  colorAcento?: string | null;
  subjectName?: string | null;
}

/**
 * Paleta de tonalidades de azul para identificar group subjects en toda la app.
 * Cada tono es visualmente distinto pero dentro del espectro azul.
 */
export const GROUP_SUBJECT_COLORS = [
  '#1e40af', // azul marino profundo
  '#2563eb', // azul royal
  '#3b82f6', // azul medio
  '#1d4ed8', // azul intenso
  '#0ea5e9', // azul cielo
  '#0284c7', // azul océano
  '#0369a1', // azul acero
  '#075985', // azul petróleo
  '#4f46e5', // azul índigo
  '#3730a3', // índigo oscuro
  '#60a5fa', // azul claro vibrante
  '#38bdf8', // azul aguamarina
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function resolveStableColor(seed: string): string {
  if (!seed) return GROUP_SUBJECT_COLORS[0];
  return GROUP_SUBJECT_COLORS[Math.abs(hashString(seed)) % GROUP_SUBJECT_COLORS.length];
}

/**
 * Compatibilidad con llamadas existentes que solo pasan un id.
 */
export function generateCourseColor(id: string): string {
  return resolveStableColor(id);
}

/**
 * Fuente de verdad para el color visual de una materia/group subject.
 * Siempre retorna una tonalidad de azul estable por id.
 * Si el backend envía colorAcento explícito, se respeta.
 */
export function getGroupSubjectColor({
  groupSubjectId,
  fallbackId,
  colorAcento,
}: GroupSubjectColorInput): string {
  const explicitColor = colorAcento?.trim();
  if (explicitColor) return explicitColor;
  return resolveStableColor(groupSubjectId?.trim() || fallbackId?.trim() || '');
}
