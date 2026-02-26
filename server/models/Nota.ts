import { Schema, model, Types } from 'mongoose';

interface INota {
  tareaId: Types.ObjectId;
  estudianteId: Types.ObjectId;
  profesorId: Types.ObjectId;
  nota: number;
  logro?: string;
  /** Ref al logro de calificación (para promedio ponderado) */
  logroId?: Types.ObjectId;
  /** Si la nota fue editada manualmente (sobrescribe valor automático) */
  manualOverride?: boolean;
  fecha: Date;
  updatedAt?: Date;
}

const notaSchema = new Schema<INota>({
  tareaId: { type: Schema.Types.ObjectId, ref: 'tareas', required: true },
  estudianteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  profesorId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  nota: { type: Number, required: true },
  logro: { type: String },
  logroId: { type: Schema.Types.ObjectId, ref: 'logros_calificacion' },
  manualOverride: { type: Boolean, default: false },
  fecha: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Índices para búsquedas rápidas
notaSchema.index({ tareaId: 1, estudianteId: 1 });
notaSchema.index({ estudianteId: 1, fecha: -1 });

export const Nota = model<INota>('notas', notaSchema);

export type { INota };

