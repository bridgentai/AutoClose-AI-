import { Schema, model, Types } from 'mongoose';

interface IMensaje {
  chatId?: Types.ObjectId;
  conversationId?: Types.ObjectId;
  remitenteId: Types.ObjectId;
  texto: string;
  adjuntos: string[];
  fecha: Date;
  leido: boolean;
}

const mensajeSchema = new Schema<IMensaje>({
  chatId: { type: Schema.Types.ObjectId, ref: 'chats' },
  conversationId: { type: Schema.Types.ObjectId, ref: 'conversaciones' },
  remitenteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  texto: { type: String, required: true },
  adjuntos: { type: [String], default: [] },
  fecha: { type: Date, default: Date.now },
  leido: { type: Boolean, default: false },
});

mensajeSchema.index({ conversationId: 1, fecha: -1 });
mensajeSchema.index({ chatId: 1, fecha: -1 });
mensajeSchema.index({ remitenteId: 1, fecha: -1 });

export const Mensaje = model<IMensaje>('mensajes', mensajeSchema);

