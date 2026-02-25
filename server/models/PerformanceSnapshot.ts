import { Schema, model, Types } from 'mongoose';

export type TrendDirection = 'up' | 'down' | 'stable';

export interface IPerformanceSnapshot {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  colegioId: string;
  at: Date;
  weightedFinalAverage: number;
  categoryAverages: Record<string, number>;
  categoryImpacts: Record<string, number>;
  consistencyIndex?: number;
  trendDirection?: TrendDirection;
}

const performanceSnapshotSchema = new Schema<IPerformanceSnapshot>({
  studentId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  colegioId: { type: String, required: true },
  at: { type: Date, default: Date.now },
  weightedFinalAverage: { type: Number, required: true },
  categoryAverages: { type: Schema.Types.Mixed, default: {} },
  categoryImpacts: { type: Schema.Types.Mixed, default: {} },
  consistencyIndex: { type: Number },
  trendDirection: { type: String, enum: ['up', 'down', 'stable'] },
});

performanceSnapshotSchema.index({ studentId: 1, courseId: 1, at: -1 });
performanceSnapshotSchema.index({ courseId: 1, at: -1 });
performanceSnapshotSchema.index({ colegioId: 1, studentId: 1, courseId: 1 });

export const PerformanceSnapshot = model<IPerformanceSnapshot>(
  'performance_snapshots',
  performanceSnapshotSchema
);
