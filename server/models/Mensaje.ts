import { Schema, model, Types } from 'mongoose';

interface IMensaje {
  chatId: Types.ObjectId;
  remitenteId: Types.ObjectId;
  texto: string;
  adjuntos: string[];
  fecha: Date;
}

const mensajeSchema = new Schema<IMensaje>({
  chatId: { type: Schema.Types.ObjectId, ref: 'chats', required: true },
  remitenteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  texto: { type: String, required: true },
  adjuntos: { type: [String], default: [] },
  fecha: { type: Date, default: Date.now },
});

// Índices para búsquedas rápidas
mensajeSchema.index({ chatId: 1, fecha: -1 });
mensajeSchema.index({ remitenteId: 1, fecha: -1 });

export const Mensaje = model<IMensaje>('mensajes', mensajeSchema);

