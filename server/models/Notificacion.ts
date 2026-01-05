import { Schema, model, Types } from 'mongoose';

interface INotificacion {
  usuarioId: Types.ObjectId;
  titulo: string;
  descripcion: string;
  fecha: Date;
  leido: boolean;
}

const notificacionSchema = new Schema<INotificacion>({
  usuarioId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  leido: { type: Boolean, default: false },
});

// Índices para búsquedas rápidas
notificacionSchema.index({ usuarioId: 1, leido: 1, fecha: -1 });
notificacionSchema.index({ usuarioId: 1, fecha: -1 });

export const Notificacion = model<INotificacion>('notificaciones', notificacionSchema);

