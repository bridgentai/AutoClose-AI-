/**
 * Evita mostrar UUIDs puros en la UI. Devuelve siempre un nombre legible para curso/materia.
 */
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s).trim());
}

export interface AssignmentCourseInfo {
  curso?: string;
  materiaNombre?: string;
  courseId?: string;
}

/** Etiqueta legible para curso/materia: nunca mostrar UUID puro. */
export function courseDisplayLabel(a: AssignmentCourseInfo): string {
  const curso = (a.curso ?? '').trim();
  const materia = (a.materiaNombre ?? '').trim();
  if (curso && !isUuid(curso)) return curso;
  if (materia && !isUuid(materia)) return materia;
  if (curso) return curso;
  if (materia) return materia;
  return 'Curso';
}
