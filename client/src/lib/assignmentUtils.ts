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
  subjectId?: string;
  groupId?: string;
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

export type CalendarVariant = 'student' | 'teacher';

/** Clave estable para color en calendario: por materia (estudiante) o por curso (profesor). */
export function calendarColorKey(a: AssignmentCourseInfo, variant: CalendarVariant): string {
  if (variant === 'student') {
    return (a.subjectId ?? a.materiaNombre ?? a.courseId ?? '').trim() || 'Sin materia';
  }
  return (a.groupId ?? a.curso ?? a.courseId ?? '').trim() || 'Sin curso';
}

/** Etiqueta para leyenda y celdas del calendario: materia (estudiante) o curso (profesor). */
export function calendarDisplayLabel(a: AssignmentCourseInfo, variant: CalendarVariant): string {
  if (variant === 'student') {
    const name = (a.materiaNombre ?? '').trim();
    return name && !isUuid(name) ? name : 'Sin materia';
  }
  const name = (a.curso ?? '').trim();
  return name && !isUuid(name) ? name : 'Sin curso';
}
