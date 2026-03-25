/**
 * Promedios por logro (categoría): nota vacía/null no cuenta; nota 0 sí cuenta.
 * Si hay al menos una nota en el logro → siempre se devuelve un número (nunca N/A).
 * Si no hay ninguna nota en el logro → se devuelve null (en UI mostrar "—").
 * Pesos dentro del logro: si todas las tareas tienen categoryWeightPct > 0 se usan;
 * si no, peso 1 cada una (media simple entre las calificadas).
 */

export type AssignmentSlot = { categoryWeightPct?: number | null };

export function weightsForAssignmentsInLogro(assignments: AssignmentSlot[]): number[] {
  const n = assignments.length;
  if (n === 0) return [];
  const allPct = assignments.every(
    (a) => a.categoryWeightPct != null && Number(a.categoryWeightPct) > 0
  );
  if (allPct) return assignments.map((a) => Number(a.categoryWeightPct));
  return assignments.map(() => 1);
}

/** true si hay calificación registrada (incluye 0). false = N/A. */
export function hasRecordedScore(score: number | null | undefined): boolean {
  if (score === null || score === undefined) return false;
  if (typeof score === 'number' && Number.isNaN(score)) return false;
  return true;
}

export function weightedGradeWithinLogro(
  assignments: AssignmentSlot[],
  scores: (number | null | undefined)[]
): number | null {
  const n = Math.min(assignments.length, scores.length);
  if (n === 0) return null;
  const w = weightsForAssignmentsInLogro(assignments.slice(0, n));
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const s = scores[i];
    if (!hasRecordedScore(s)) continue;
    num += Number(s) * w[i];
    den += w[i];
  }
  if (den <= 0) return null;
  return num / den;
}

export interface LogroPct {
  _id: string;
  porcentaje: number;
}

/** Logro (peso en curso) con indicadores que ponderan el subtotal del logro (suman 100%). */
export interface OutcomeGradeNode {
  id: string;
  pesoEnCurso: number;
  indicadores: { id: string; porcentaje: number }[];
}

/**
 * Nota final del curso: por cada logro, subtotal ponderado por indicadores; luego ponderado por pesoEnCurso entre logros.
 */
export function courseGradeFromOutcomes(
  outcomes: OutcomeGradeNode[],
  getIndicadorGrade: (indicadorId: string) => number | null
): number | null {
  if (!outcomes.length) return null;
  const getLogroGrade = (outcomeId: string): number | null => {
    const o = outcomes.find((x) => x.id === outcomeId);
    if (!o?.indicadores?.length) return null;
    return courseWeightedFromLogros(
      o.indicadores.map((i) => ({ _id: i.id, porcentaje: i.porcentaje })),
      getIndicadorGrade
    );
  };
  return courseWeightedFromLogros(
    outcomes.map((o) => ({ _id: o.id, porcentaje: o.pesoEnCurso })),
    getLogroGrade
  );
}

/** Promedio del curso: solo logros con al menos una nota registrada; se renorma por % de esos logros. */
export function courseWeightedFromLogros(
  logros: LogroPct[],
  getCategoryGrade: (categoryId: string) => number | null
): number | null {
  let num = 0;
  let den = 0;
  for (const l of logros) {
    const g = getCategoryGrade(l._id);
    if (g === null) continue;
    const p = Number(l.porcentaje) || 0;
    if (p <= 0) continue;
    num += g * p;
    den += p;
  }
  if (den <= 0) return null;
  return num / den;
}
