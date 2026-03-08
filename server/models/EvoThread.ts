import { Schema, model, Types } from 'mongoose';

/** Tipos de hilo en Evo Send */
export type EvoThreadType = 'comunicado_general' | 'curso' | 'asignacion' | 'asistencia' | 'general';

export interface IEvoThread {
  colegioId: string;
  tipo: EvoThreadType;
  asunto: string;
  creadoPor: Types.ObjectId;
  /** Curso asociado (para mensajes por curso o asignación) */
  cursoId?: Types.ObjectId;
  /** Asignación asociada (cuando tipo === 'asignacion') */
  assignmentId?: Types.ObjectId;
  /** Destinatarios del hilo (quién puede ver y responder) */
  recipientIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const evoThreadSchema = new Schema<IEvoThread>({
  colegioId: { type: String, required: true },
  tipo: {
    type: String,
    required: true,
    enum: ['comunicado_general', 'curso', 'asignacion', 'asistencia', 'general'],
  },
  asunto: { type: String, required: true },
  creadoPor: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos' },
  assignmentId: { type: Schema.Types.ObjectId, ref: 'tareas' },
  recipientIds: [{ type: Schema.Types.ObjectId, ref: 'usuarios', default: [] }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

evoThreadSchema.index({ colegioId: 1, updatedAt: -1 });
evoThreadSchema.index({ creadoPor: 1, updatedAt: -1 });
evoThreadSchema.index({ recipientIds: 1, updatedAt: -1 });
evoThreadSchema.index({ assignmentId: 1 }, { sparse: true });
evoThreadSchema.index({ cursoId: 1, tipo: 1 });

export const EvoThread = model<IEvoThread>('evo_threads', evoThreadSchema);
