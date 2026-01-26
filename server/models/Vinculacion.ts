import { Schema, model, Document, Types } from 'mongoose';

export interface IVinculacion extends Document {
  padreId: Types.ObjectId;
  estudianteId: Types.ObjectId;
  colegioId: string;
  createdAt: Date;
  updatedAt: Date;
}

const vinculacionSchema = new Schema<IVinculacion>(
  {
    padreId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true, index: true },
    estudianteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true, index: true },
    colegioId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

vinculacionSchema.index({ padreId: 1, estudianteId: 1 }, { unique: true });

export const Vinculacion = model<IVinculacion>('vinculaciones', vinculacionSchema);
