import { Schema, model, Document } from 'mongoose';

export interface ISection extends Document {
  nombre: string;
  colegioId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const sectionSchema = new Schema<ISection>(
  {
    nombre: { type: String, required: true },
    colegioId: { type: String, required: true },
  },
  { timestamps: true }
);

sectionSchema.index({ colegioId: 1 });

export const Section = model<ISection>('secciones', sectionSchema);
