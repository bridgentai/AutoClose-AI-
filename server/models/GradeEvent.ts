import { Schema, model, Types } from 'mongoose';

export interface IGradeEvent {
  _id: Types.ObjectId;
  assignmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  categoryId: Types.ObjectId;
  colegioId: string;
  score: number;
  maxScore: number;
  normalizedScore?: number;
  recordedAt: Date;
  recordedBy: Types.ObjectId;
  version?: number;
}

const gradeEventSchema = new Schema<IGradeEvent>({
  assignmentId: { type: Schema.Types.ObjectId, ref: 'tareas', required: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'grading_categories', required: true },
  colegioId: { type: String, required: true },
  score: { type: Number, required: true },
  maxScore: { type: Number, required: true },
  normalizedScore: { type: Number },
  recordedAt: { type: Date, default: Date.now },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  version: { type: Number },
});

gradeEventSchema.index({ studentId: 1, courseId: 1, assignmentId: 1 }, { unique: true });
gradeEventSchema.index({ courseId: 1, categoryId: 1 });
gradeEventSchema.index({ studentId: 1, courseId: 1, recordedAt: -1 });
gradeEventSchema.index({ colegioId: 1, recordedAt: -1 });

export const GradeEvent = model<IGradeEvent>('grade_events', gradeEventSchema);
