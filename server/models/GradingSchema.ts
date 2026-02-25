import { Schema, model, Types } from 'mongoose';

export interface IGradingSchema {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  colegioId: string;
  nombre?: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gradingSchemaSchema = new Schema<IGradingSchema>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
    colegioId: { type: String, required: true },
    nombre: { type: String },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

gradingSchemaSchema.index({ courseId: 1, isActive: 1 });
gradingSchemaSchema.index({ colegioId: 1, courseId: 1 });

export const GradingSchemaModel = model<IGradingSchema>('grading_schemas', gradingSchemaSchema);
