/**
 * Pure grading calculations. No DB access.
 * All inputs are plain objects; outputs are numbers or plain objects.
 */

export interface GradeEventLike {
  assignmentId: string;
  studentId: string;
  categoryId: string;
  score: number;
  maxScore: number;
  normalizedScore?: number;
}

export interface CategoryLike {
  _id: string;
  weight: number;
  riskImpactMultiplier?: number;
}

export interface SnapshotLike {
  at: Date;
  weightedFinalAverage: number;
  categoryAverages: Record<string, number>;
  trendDirection?: 'up' | 'down' | 'stable';
}

const DEFAULT_SCALE = 100;

function normalizeScore(score: number, maxScore: number, scale = DEFAULT_SCALE): number {
  if (maxScore <= 0) return 0;
  return (score / maxScore) * scale;
}

/**
 * Average of normalized scores in a category for a student.
 */
export function calculateCategoryAverage(
  _studentId: string,
  categoryId: string,
  gradeEvents: GradeEventLike[]
): number {
  const inCategory = gradeEvents.filter((e) => String(e.categoryId) === String(categoryId));
  if (inCategory.length === 0) return 0;
  const normalized = inCategory.map((e) =>
    e.normalizedScore != null ? e.normalizedScore : normalizeScore(e.score, e.maxScore)
  );
  return normalized.reduce((a, b) => a + b, 0) / normalized.length;
}

/**
 * Promedio 0–100: solo categorías presentes en categoryAverages (p. ej. con al menos una nota).
 * N/A no entra; pesos renormalizados.
 */
export function calculateWeightedFinalAverage(
  _studentId: string,
  _courseId: string,
  categories: CategoryLike[],
  categoryAverages: Record<string, number>
): number {
  let total = 0;
  let totalWeight = 0;
  for (const cat of categories) {
    const avg = categoryAverages[String(cat._id)];
    if (avg == null || Number.isNaN(avg)) continue;
    const w = cat.weight;
    if (!Number.isFinite(w) || w <= 0) continue;
    total += (avg * w) / 100;
    totalWeight += w;
  }
  if (totalWeight <= 0) return 0;
  return (total / totalWeight) * 100;
}

/**
 * Contribution of a category to the final (categoryAverage * weight / 100).
 */
export function calculateCategoryImpact(
  _studentId: string,
  _categoryId: string,
  categoryAverage: number,
  weight: number
): number {
  return (categoryAverage * weight) / 100;
}

/**
 * Consistency index 0–1: lower variance in normalized scores => higher consistency.
 */
export function calculateConsistencyIndex(
  _studentId: string,
  _courseId: string,
  gradeEventsOrdered: GradeEventLike[]
): number {
  if (gradeEventsOrdered.length < 2) return 1;
  const scores = gradeEventsOrdered.map((e) =>
    e.normalizedScore != null ? e.normalizedScore : normalizeScore(e.score, e.maxScore)
  );
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 1;
  const maxStd = 50;
  return Math.max(0, 1 - std / maxStd);
}

export interface PerformanceTrendResult {
  direction: 'up' | 'down' | 'stable';
  slope?: number;
  lastN: number;
}

/**
 * Trend from recent snapshots or from ordered grade events (by recordedAt).
 */
export function generatePerformanceTrend(
  _studentId: string,
  _courseId: string,
  snapshotsOrOrderedGrades: SnapshotLike[] | GradeEventLike[]
): PerformanceTrendResult {
  const lastN = snapshotsOrOrderedGrades.length;
  if (lastN < 2) return { direction: 'stable', lastN };

  const values: number[] = [];
  const times: number[] = [];

  if ('weightedFinalAverage' in snapshotsOrOrderedGrades[0]) {
    const snaps = snapshotsOrOrderedGrades as SnapshotLike[];
    snaps.forEach((s, i) => {
      values.push(s.weightedFinalAverage);
      times.push(new Date(s.at).getTime());
    });
  } else {
    const events = snapshotsOrOrderedGrades as GradeEventLike[];
    events.forEach((e, i) => {
      values.push(
        e.normalizedScore != null ? e.normalizedScore : normalizeScore(e.score, e.maxScore)
      );
      times.push(i);
    });
  }

  const n = values.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += times[i];
    sumY += values[i];
    sumXY += times[i] * values[i];
    sumX2 += times[i] * times[i];
  }
  const slope =
    n * sumX2 - sumX * sumX !== 0
      ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      : 0;

  const direction: 'up' | 'down' | 'stable' =
    slope > 0.0001 ? 'up' : slope < -0.0001 ? 'down' : 'stable';
  return { direction, slope, lastN };
}

export interface ForecastOptions {
  passingThreshold?: number;
  futureWeightRemaining?: number;
}

export interface ForecastResult {
  projected: number;
  confidenceInterval: { low: number; high: number };
  riskProbability: number;
}

/**
 * Projected final grade using weighted moving average and simple regression.
 */
export function forecastFinalGrade(
  gradeEventsOrdered: GradeEventLike[],
  categories: CategoryLike[],
  categoryAverages: Record<string, number>,
  weightedFinal: number,
  options: ForecastOptions = {}
): ForecastResult {
  const { passingThreshold = 60, futureWeightRemaining = 0 } = options;

  if (gradeEventsOrdered.length === 0) {
    return {
      projected: 0,
      confidenceInterval: { low: 0, high: 100 },
      riskProbability: 1,
    };
  }

  const scores = gradeEventsOrdered.map((e) =>
    e.normalizedScore != null ? e.normalizedScore : normalizeScore(e.score, e.maxScore)
  );
  const n = scores.length;
  let wma = 0;
  let weightSum = 0;
  for (let i = 0; i < n; i++) {
    const w = i + 1;
    wma += scores[i] * w;
    weightSum += w;
  }
  const projected = weightSum > 0 ? wma / weightSum : weightedFinal;

  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const halfWidth = Math.min(15, Math.max(2, std * 1.5));
  const confidenceInterval = {
    low: Math.max(0, projected - halfWidth),
    high: Math.min(100, projected + halfWidth),
  };

  const riskProbability =
    projected >= passingThreshold ? 0 : Math.min(1, (passingThreshold - projected) / 50);

  return { projected, confidenceInterval, riskProbability };
}

export interface RiskResult {
  level: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface RiskThresholds {
  lowMax?: number;
  mediumMax?: number;
}

/**
 * Academic risk from snapshot, forecast, and optional thresholds.
 */
export function detectAcademicRisk(
  _studentId: string,
  _courseId: string,
  snapshot: { weightedFinalAverage: number; consistencyIndex?: number },
  forecast: { projected: number; riskProbability: number },
  thresholds: RiskThresholds = {}
): RiskResult {
  const { lowMax = 70, mediumMax = 50 } = thresholds;
  const factors: string[] = [];
  const avg = snapshot.weightedFinalAverage;
  const proj = forecast.projected;

  if (avg < lowMax) factors.push('below_target_average');
  if (proj < lowMax) factors.push('projected_below_target');
  if (forecast.riskProbability > 0.5) factors.push('high_risk_probability');
  if (
    snapshot.consistencyIndex != null &&
    snapshot.consistencyIndex < 0.5
  ) {
    factors.push('volatile_performance');
  }

  let level: 'low' | 'medium' | 'high' = 'low';
  if (avg < mediumMax || proj < mediumMax || factors.length >= 3) level = 'high';
  else if (avg < lowMax || proj < lowMax || factors.length >= 1) level = 'medium';

  return { level, factors };
}
