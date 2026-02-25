/**
 * AcademicInsightEngine: stateless functions for insights, stability index, recovery potential.
 * Called from recalculation job or on-demand for Executive View.
 */

import type { ICategory } from '../../../models/Category';
import type { IGradeEvent } from '../../../models/GradeEvent';

export interface InsightEngineInput {
  snapshot: {
    weightedFinalAverage: number;
    consistencyIndex?: number;
    trendDirection?: 'up' | 'down' | 'stable';
    categoryAverages: Record<string, number>;
  };
  forecast: {
    projectedFinalGrade: number;
    riskProbabilityPercent?: number;
  };
  risk: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  };
  categories: ICategory[];
  gradeEvents: IGradeEvent[];
}

export interface InsightEngineOutput {
  insights: string[];
  academicStabilityIndex?: number;
  recoveryPotentialScore?: number;
}

const LOW_THRESHOLD = 60;
const VOLATILITY_CONSISTENCY_THRESHOLD = 0.5;

/**
 * Academic Stability Index: composite of consistency, trend, and risk (0–1).
 */
function computeAcademicStabilityIndex(input: InsightEngineInput): number {
  const { snapshot, risk } = input;
  let stability = 1;
  if (snapshot.consistencyIndex != null) {
    stability *= 0.4 + 0.6 * snapshot.consistencyIndex;
  }
  if (snapshot.trendDirection === 'down') stability *= 0.85;
  if (snapshot.trendDirection === 'up') stability = Math.min(1, stability * 1.05);
  if (risk.level === 'high') stability *= 0.6;
  else if (risk.level === 'medium') stability *= 0.8;
  return Math.max(0, Math.min(1, Math.round(stability * 100) / 100));
}

/**
 * Recovery Potential: heuristic from trend, gap to passing, and remaining weight.
 */
function computeRecoveryPotentialScore(input: InsightEngineInput): number {
  const { snapshot, forecast } = input;
  const current = snapshot.weightedFinalAverage;
  const projected = forecast.projectedFinalGrade;
  const gap = LOW_THRESHOLD - Math.min(current, projected);
  if (gap <= 0) return 1;
  const trendBonus = projected > current ? 0.2 : 0;
  const raw = Math.max(0, 1 - gap / 50 + trendBonus);
  return Math.round(raw * 100) / 100;
}

/**
 * Generate bullet insights (low performance, downward trend, weight-risk, volatility).
 */
function generateInsights(input: InsightEngineInput): string[] {
  const { snapshot, forecast, risk, categories } = input;
  const list: string[] = [];

  if (snapshot.weightedFinalAverage < LOW_THRESHOLD) {
    list.push('Rendimiento por debajo del umbral objetivo.');
  }
  if (snapshot.trendDirection === 'down') {
    list.push('Tendencia a la baja en el rendimiento.');
  }
  if (
    snapshot.consistencyIndex != null &&
    snapshot.consistencyIndex < VOLATILITY_CONSISTENCY_THRESHOLD
  ) {
    list.push('Rendimiento volátil; conviene reforzar consistencia.');
  }
  const highWeightLowAvg = categories.find((c) => {
    const avg = snapshot.categoryAverages[String(c._id)];
    return c.weight >= 30 && avg != null && avg < LOW_THRESHOLD;
  });
  if (highWeightLowAvg) {
    list.push(
      `Categoría "${highWeightLowAvg.nombre}" tiene mucho peso y promedio bajo.`
    );
  }
  if (forecast.riskProbabilityPercent != null && forecast.riskProbabilityPercent > 50) {
    list.push('Riesgo alto de no alcanzar el umbral de aprobación.');
  }
  return list.slice(0, 5);
}

/**
 * Run the full insight engine; returns insights, stability index, recovery potential.
 */
export function runAcademicInsightEngine(input: InsightEngineInput): InsightEngineOutput {
  const insights = generateInsights(input);
  const academicStabilityIndex = computeAcademicStabilityIndex(input);
  const recoveryPotentialScore = computeRecoveryPotentialScore(input);
  return {
    insights,
    academicStabilityIndex,
    recoveryPotentialScore,
  };
}
