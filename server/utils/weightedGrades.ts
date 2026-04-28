/**
 * Duplicado de shared/weightedGrades (servidor no importa shared en bundle).
 * Regla: si hay al menos una nota en el logro → número; si no hay ninguna → null (UI: "—").
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

export interface OutcomeGradeNode {
  id: string;
  pesoEnCurso: number;
  indicadores: { id: string; porcentaje: number }[];
}

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

export function courseGradeFromOutcomes(
  outcomes: OutcomeGradeNode[],
  getIndicadorGrade: (indicadorId: string) => number | null
): number | null {
  if (!outcomes.length) return null;
  const getLogroGrade = (outcomeId: string): number | null => {
    const outcome = outcomes.find((item) => item.id === outcomeId);
    if (!outcome?.indicadores?.length) return null;
    return courseWeightedFromLogros(
      outcome.indicadores.map((indicador) => ({
        _id: indicador.id,
        porcentaje: indicador.porcentaje,
      })),
      getIndicadorGrade
    );
  };
  return courseWeightedFromLogros(
    outcomes.map((outcome) => ({ _id: outcome.id, porcentaje: outcome.pesoEnCurso })),
    getLogroGrade
  );
}
