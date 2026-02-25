import { Schema, model, Types } from 'mongoose';

export type EvaluationType = 'formative' | 'summative' | 'behavioral' | 'cognitive';

export interface ICategory {
  _id: Types.ObjectId;
  gradingSchemaId: Types.ObjectId;
  nombre: string;
  weight: number;
  orden: number;
  evaluationType: EvaluationType;
  riskImpactMultiplier: number;
  colegioId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    gradingSchemaId: { type: Schema.Types.ObjectId, ref: 'grading_schemas', required: true },
    nombre: { type: String, required: true },
    weight: { type: Number, required: true, min: 0, max: 100 },
    orden: { type: Number, default: 0 },
    evaluationType: {
      type: String,
      enum: ['formative', 'summative', 'behavioral', 'cognitive'],
      default: 'summative',
    },
    riskImpactMultiplier: { type: Number, default: 1.0, min: 0.5, max: 2.0 },
    colegioId: { type: String, required: true },
  },
  { timestamps: true }
);

categorySchema.index({ gradingSchemaId: 1 });
categorySchema.index({ colegioId: 1, gradingSchemaId: 1 });

export const Category = model<ICategory>('grading_categories', categorySchema);
