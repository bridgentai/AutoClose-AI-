import { Schema, model, Types } from 'mongoose';

/** Tipo de contenido del mensaje */
export type EvoMessageContentType = 'texto' | 'asignacion' | 'asistencia' | 'notificacion';

/** Prioridad del mensaje */
export type EvoMessagePrioridad = 'normal' | 'alta' | 'urgente';

export interface IEvoMessage {
  threadId: Types.ObjectId;
  remitenteId: Types.ObjectId;
  rolRemitente: string;
  contenido: string;
  tipo: EvoMessageContentType;
  prioridad: EvoMessagePrioridad;
  /** Link a asignación (cuando tipo === 'asignacion') */
  assignmentId?: Types.ObjectId;
  /** IDs de usuarios que han leído el mensaje */
  leidoPor: Types.ObjectId[];
  adjuntos: string[];
  fecha: Date;
  createdAt: Date;
}

const evoMessageSchema = new Schema<IEvoMessage>({
  threadId: { type: Schema.Types.ObjectId, ref: 'evo_threads', required: true },
  remitenteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  rolRemitente: { type: String, required: true },
  contenido: { type: String, required: true },
  tipo: {
    type: String,
    required: true,
    enum: ['texto', 'asignacion', 'asistencia', 'notificacion'],
    default: 'texto',
  },
  prioridad: {
    type: String,
    enum: ['normal', 'alta', 'urgente'],
    default: 'normal',
  },
  assignmentId: { type: Schema.Types.ObjectId, ref: 'tareas' },
  leidoPor: [{ type: Schema.Types.ObjectId, ref: 'usuarios', default: [] }],
  adjuntos: { type: [String], default: [] },
  fecha: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

evoMessageSchema.index({ threadId: 1, fecha: 1 });
evoMessageSchema.index({ remitenteId: 1, fecha: -1 });
evoMessageSchema.index({ assignmentId: 1 }, { sparse: true });

export const EvoMessage = model<IEvoMessage>('evo_messages', evoMessageSchema);
