import { Schema, model, Types } from 'mongoose';

export interface ILogroCalificacion {
  nombre: string;
  porcentaje: number;
  courseId: Types.ObjectId;
  profesorId: Types.ObjectId;
  colegioId: string;
  orden?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const logroCalificacionSchema = new Schema<ILogroCalificacion>(
  {
    nombre: { type: String, required: true },
    porcentaje: { type: Number, required: true, min: 0, max: 100 },
    courseId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
    profesorId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
    colegioId: { type: String, required: true },
    orden: { type: Number, default: 0 },
  },
  { timestamps: true }
);

logroCalificacionSchema.index({ courseId: 1 });
logroCalificacionSchema.index({ colegioId: 1, courseId: 1 });

export const LogroCalificacion = model<ILogroCalificacion>('logros_calificacion', logroCalificacionSchema);
