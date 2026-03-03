import { Types } from 'mongoose';
import {
  PerformanceSnapshot,
  PerformanceForecast,
  RiskAssessment,
  Assignment,
  GradeEvent,
  Asistencia,
} from '../../../models';

interface ComputeIntelligenceParams {
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  colegioId: string;
}

export interface GroupComparisonStats {
  groupAverage: number | null;
  groupStdDev: number | null;
  percentile: number | null;
  rank: number | null;
  totalStudents: number;
}

export interface CommitmentIndex {
  attendanceRate: number | null;
  punctualityRate: number | null;
  onTimeRate: number | null;
  tasksCompletionRate: number | null;
  commitmentIndex: number | null;
}

export interface StudentCourseIntelligence {
  snapshot: unknown | null;
  forecast: unknown | null;
  risk: unknown | null;
  groupComparison: GroupComparisonStats;
  commitment: CommitmentIndex;
}

function computeMean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function computeStdDev(values: number[], mean: number): number | null {
  if (values.length === 0) return null;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

async function computeGroupComparison(
  courseId: Types.ObjectId,
  studentId: Types.ObjectId,
  colegioId: string
): Promise<GroupComparisonStats> {
  const snapshots = await PerformanceSnapshot.find({
    courseId,
    colegioId,
  })
    .sort({ at: -1 })
    .lean();

  const latestByStudent = new Map<string, typeof snapshots[number]>();
  for (const snap of snapshots) {
    const key = String(snap.studentId);
    if (!latestByStudent.has(key)) {
      latestByStudent.set(key, snap);
    }
  }

  const values: number[] = [];
  let currentValue: number | null = null;
  const targetKey = String(studentId);

  latestByStudent.forEach((snap, key) => {
    const v = snap.weightedFinalAverage;
    if (typeof v === 'number' && !Number.isNaN(v)) {
      values.push(v);
      if (key === targetKey) {
        currentValue = v;
      }
    }
  });

  const totalStudents = values.length;
  if (totalStudents === 0 || currentValue == null) {
    return {
      groupAverage: null,
      groupStdDev: null,
      percentile: null,
      rank: null,
      totalStudents,
    };
  }

  const mean = computeMean(values)!;
  const stdDev = computeStdDev(values, mean);

  const numBelowOrEqual = values.filter((v) => v <= currentValue!).length;
  const numAbove = values.filter((v) => v > currentValue!).length;

  const percentile = (numBelowOrEqual / totalStudents) * 100;
  const rank = numAbove + 1;

  return {
    groupAverage: mean,
    groupStdDev: stdDev,
    percentile,
    rank,
    totalStudents,
  };
}

async function computeCommitment(
  courseId: Types.ObjectId,
  studentId: Types.ObjectId,
  colegioId: string
): Promise<CommitmentIndex> {
  const [asistencias, gradeEvents, assignments] = await Promise.all([
    Asistencia.find({ cursoId: courseId, estudianteId: studentId, colegioId }).lean(),
    GradeEvent.find({ courseId, studentId, colegioId }).lean(),
    Assignment.find({ courseId, colegioId }).select('_id').lean(),
  ]);

  const totalSessions = asistencias.length;
  const presentSessions = asistencias.filter((a) => a.estado === 'presente').length;
  const lateSessions = asistencias.filter((a) => a.puntualidad === 'late').length;
  const onTimeSessions = presentSessions - lateSessions;

  const attendanceRate =
    totalSessions > 0 ? presentSessions / totalSessions : null;
  const punctualityRate =
    totalSessions > 0 ? (totalSessions - lateSessions) / totalSessions : null;
  const onTimeRate = presentSessions > 0 ? onTimeSessions / presentSessions : null;

  const totalAssignments = assignments.length;
  const tasksCompletionRate =
    totalAssignments > 0
      ? Math.min(1, gradeEvents.length / totalAssignments)
      : null;

  const parts: number[] = [];
  if (attendanceRate != null) parts.push(attendanceRate);
  if (punctualityRate != null) parts.push(punctualityRate);
  if (tasksCompletionRate != null) parts.push(tasksCompletionRate);

  const commitmentIndex =
    parts.length > 0 ? parts.reduce((acc, v) => acc + v, 0) / parts.length : null;

  return {
    attendanceRate,
    punctualityRate,
    onTimeRate,
    tasksCompletionRate,
    commitmentIndex,
  };
}

export async function computeStudentCourseIntelligence(
  params: ComputeIntelligenceParams
): Promise<StudentCourseIntelligence> {
  const { courseId, studentId, colegioId } = params;

  const [snapshot, forecast, risk, groupComparison, commitment] = await Promise.all([
    PerformanceSnapshot.findOne({
      courseId,
      studentId,
      colegioId,
    })
      .sort({ at: -1 })
      .lean(),
    PerformanceForecast.findOne({
      courseId,
      studentId,
      colegioId,
    })
      .sort({ generatedAt: -1 })
      .lean(),
    RiskAssessment.findOne({
      courseId,
      studentId,
      colegioId,
    })
      .sort({ at: -1 })
      .lean(),
    computeGroupComparison(courseId, studentId, colegioId),
    computeCommitment(courseId, studentId, colegioId),
  ]);

  return {
    snapshot,
    forecast,
    risk,
    groupComparison,
    commitment,
  };
}

