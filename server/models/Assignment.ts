import { Schema, model, Types } from 'mongoose';

export interface IAssignment {
  titulo: string;
  descripcion: string;
  curso: string; // ej: "11H", "10A"
  fechaEntrega: Date;
  profesorId: Types.ObjectId;
  profesorNombre: string;
  colegioId: string;
  createdAt: Date;
}

const assignmentSchema = new Schema<IAssignment>({
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  curso: { type: String, required: true },
  fechaEntrega: { type: Date, required: true },
  profesorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  profesorNombre: { type: String, required: true },
  colegioId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Índice para búsquedas rápidas por curso y fecha
assignmentSchema.index({ curso: 1, fechaEntrega: 1 });
assignmentSchema.index({ colegioId: 1, curso: 1 });

export const Assignment = model<IAssignment>('Assignment', assignmentSchema);
