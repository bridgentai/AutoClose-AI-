import { Schema, model, Types } from 'mongoose';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface IRiskAssessment {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  colegioId: string;
  at: Date;
  level: RiskLevel;
  factors: string[];
  academicStabilityIndex?: number;
  recoveryPotentialScore?: number;
}

const riskAssessmentSchema = new Schema<IRiskAssessment>({
  studentId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  colegioId: { type: String, required: true },
  at: { type: Date, default: Date.now },
  level: { type: String, enum: ['low', 'medium', 'high'], required: true },
  factors: { type: [String], default: [] },
  academicStabilityIndex: { type: Number },
  recoveryPotentialScore: { type: Number },
});

riskAssessmentSchema.index({ studentId: 1, courseId: 1, at: -1 });
riskAssessmentSchema.index({ colegioId: 1, courseId: 1 });

export const RiskAssessment = model<IRiskAssessment>(
  'risk_assessments',
  riskAssessmentSchema
);
