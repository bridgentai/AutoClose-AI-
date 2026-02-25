/**
 * Event-driven recalculation: on grade write we enqueue recalculateStudentCourse.
 * Job loads GradeEvents + Categories, runs pure calculations, writes Snapshot, Forecast, Risk.
 */

import { Types } from 'mongoose';
import {
  GradeEvent,
  Category,
  Course,
  PerformanceSnapshot,
  PerformanceForecast,
  RiskAssessment,
} from '../../models';
import type { ICategory } from '../../models';
import {
  calculateCategoryAverage,
  calculateWeightedFinalAverage,
  calculateCategoryImpact,
  calculateConsistencyIndex,
  generatePerformanceTrend,
  forecastFinalGrade,
  detectAcademicRisk,
  type GradeEventLike,
  type CategoryLike,
  type SnapshotLike,
} from './calculations';
import { runAcademicInsightEngine } from './intelligence/insightEngine';

type StudentId = string;
type CourseId = string;
const jobKey = (studentId: StudentId, courseId: CourseId) => `${studentId}:${courseId}`;

const pending = new Set<string>();
let processing = false;

async function processQueue(): Promise<void> {
  if (processing || pending.size === 0) return;
  processing = true;
  while (pending.size > 0) {
    const key = pending.values().next().value as string;
    pending.delete(key);
    const [studentId, courseId] = key.split(':');
    try {
      await runRecalculation(studentId, courseId);
    } catch (err) {
      console.error('[Grading] Recalculation failed:', key, err);
    }
  }
  processing = false;
}

/**
 * Enqueue recalc for (studentId, courseId). Deduplicated by key.
 */
export function enqueueRecalculateStudentCourse(
  studentId: string,
  courseId: string
): void {
  const key = jobKey(studentId, courseId);
  pending.add(key);
  setImmediate(processQueue);
}

/**
 * Run full recalculation for one student in one course.
 */
export async function runRecalculation(
  studentId: string,
  courseId: string
): Promise<void> {
  const normalizedStudentId = new Types.ObjectId(studentId);
  const normalizedCourseId = new Types.ObjectId(courseId);

  const course = await Course.findById(normalizedCourseId).lean();
  if (!course?.colegioId) return;
  const colegioId = course.colegioId;
  const schemaId = course.gradingSchemaId;
  if (!schemaId) return;

  const [events, categories] = await Promise.all([
    GradeEvent.find({
      studentId: normalizedStudentId,
      courseId: normalizedCourseId,
      colegioId,
    })
      .sort({ recordedAt: 1 })
      .lean(),
    Category.find({ gradingSchemaId: schemaId, colegioId }).sort({ orden: 1 }).lean(),
  ]);

  if (categories.length === 0) return;

  const eventLikes: GradeEventLike[] = events.map((e) => ({
    assignmentId: String(e.assignmentId),
    studentId: String(e.studentId),
    categoryId: String(e.categoryId),
    score: e.score,
    maxScore: e.maxScore,
    normalizedScore: e.normalizedScore,
  }));

  const categoryLikes: CategoryLike[] = categories.map((c) => ({
    _id: String(c._id),
    weight: c.weight,
    riskImpactMultiplier: c.riskImpactMultiplier ?? 1,
  }));

  const categoryAverages: Record<string, number> = {};
  for (const cat of categoryLikes) {
    categoryAverages[cat._id] = calculateCategoryAverage(
      studentId,
      cat._id,
      eventLikes
    );
  }

  const weightedFinal = calculateWeightedFinalAverage(
    studentId,
    courseId,
    categoryLikes,
    categoryAverages
  );

  const categoryImpacts: Record<string, number> = {};
  for (const cat of categoryLikes) {
    categoryImpacts[cat._id] = calculateCategoryImpact(
      studentId,
      cat._id,
      categoryAverages[cat._id] ?? 0,
      cat.weight
    );
  }

  const consistencyIndex = calculateConsistencyIndex(
    studentId,
    courseId,
    eventLikes
  );

  const recentSnapshots = await PerformanceSnapshot.find({
    studentId: normalizedStudentId,
    courseId: normalizedCourseId,
    colegioId,
  })
    .sort({ at: -1 })
    .limit(10)
    .lean();

  const snapshotsForTrend: SnapshotLike[] = recentSnapshots.reverse().map((s) => ({
    at: s.at,
    weightedFinalAverage: s.weightedFinalAverage,
    categoryAverages: s.categoryAverages,
    trendDirection: s.trendDirection,
  }));

  const trend =
    snapshotsForTrend.length >= 2
      ? generatePerformanceTrend(studentId, courseId, snapshotsForTrend)
      : generatePerformanceTrend(studentId, courseId, eventLikes);

  const at = new Date();

  await PerformanceSnapshot.create({
    studentId: normalizedStudentId,
    courseId: normalizedCourseId,
    colegioId,
    at,
    weightedFinalAverage: Math.round(weightedFinal * 100) / 100,
    categoryAverages,
    categoryImpacts,
    consistencyIndex: Math.round(consistencyIndex * 100) / 100,
    trendDirection: trend.direction,
  });

  const forecastResult = forecastFinalGrade(
    eventLikes,
    categoryLikes,
    categoryAverages,
    weightedFinal,
    { passingThreshold: 60 }
  );

  await PerformanceForecast.findOneAndUpdate(
    { studentId: normalizedStudentId, courseId: normalizedCourseId, colegioId },
    {
      $set: {
        generatedAt: at,
        projectedFinalGrade: Math.round(forecastResult.projected * 100) / 100,
        confidenceInterval: forecastResult.confidenceInterval,
        riskProbabilityPercent:
          forecastResult.riskProbability != null
            ? Math.round(forecastResult.riskProbability * 100)
            : undefined,
        method: 'weighted_moving_average',
      },
    },
    { upsert: true, new: true }
  );

  const snapshotForRisk = {
    weightedFinalAverage: weightedFinal,
    consistencyIndex,
  };
  const riskResult = detectAcademicRisk(
    studentId,
    courseId,
    snapshotForRisk,
    {
      projected: forecastResult.projected,
      riskProbability: forecastResult.riskProbability ?? 0,
    },
    { lowMax: 70, mediumMax: 50 }
  );

  const insightInput = {
    snapshot: {
      studentId: normalizedStudentId,
      courseId: normalizedCourseId,
      colegioId,
      at,
      weightedFinalAverage: Math.round(weightedFinal * 100) / 100,
      categoryAverages,
      categoryImpacts,
      consistencyIndex: Math.round(consistencyIndex * 100) / 100,
      trendDirection: trend.direction,
    },
    forecast: {
      studentId: normalizedStudentId,
      courseId: normalizedCourseId,
      colegioId,
      generatedAt: at,
      projectedFinalGrade: forecastResult.projected,
      confidenceInterval: forecastResult.confidenceInterval,
      riskProbabilityPercent:
        forecastResult.riskProbability != null
          ? Math.round(forecastResult.riskProbability * 100)
          : undefined,
      method: 'weighted_moving_average',
    },
    risk: {
      studentId: normalizedStudentId,
      courseId: normalizedCourseId,
      colegioId,
      at,
      level: riskResult.level,
      factors: riskResult.factors,
    },
    categories: categories as ICategory[],
    gradeEvents: events,
  };

  const insights = runAcademicInsightEngine(insightInput);

  await RiskAssessment.create({
    studentId: normalizedStudentId,
    courseId: normalizedCourseId,
    colegioId,
    at,
    level: riskResult.level,
    factors: riskResult.factors,
    academicStabilityIndex: insights.academicStabilityIndex,
    recoveryPotentialScore: insights.recoveryPotentialScore,
  });
}
