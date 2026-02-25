import { Schema, model, Types } from 'mongoose';

export interface IPerformanceForecast {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  colegioId: string;
  generatedAt: Date;
  projectedFinalGrade: number;
  confidenceInterval: { low: number; high: number };
  riskProbabilityPercent?: number;
  method?: string;
}

const performanceForecastSchema = new Schema<IPerformanceForecast>({
  studentId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  colegioId: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
  projectedFinalGrade: { type: Number, required: true },
  confidenceInterval: {
    low: { type: Number, required: true },
    high: { type: Number, required: true },
  },
  riskProbabilityPercent: { type: Number },
  method: { type: String },
});

performanceForecastSchema.index({ studentId: 1, courseId: 1 });
performanceForecastSchema.index({ colegioId: 1, courseId: 1 });

export const PerformanceForecast = model<IPerformanceForecast>(
  'performance_forecasts',
  performanceForecastSchema
);
