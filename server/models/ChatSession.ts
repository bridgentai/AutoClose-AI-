import { Schema, model, Types } from 'mongoose';

interface IChatMessage {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
}

interface IChat {
  cursoId?: Types.ObjectId; // Opcional para permitir chats globales
  participantes: Types.ObjectId[];
  // Campos adicionales para compatibilidad
  colegioId?: string;
  userId?: Types.ObjectId;
  titulo?: string;
  contexto?: {
    tipo: string;
    referenciaId?: string;
  };
  historial?: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>({
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos', required: false }, // Opcional para chats globales
  participantes: [{ type: Schema.Types.ObjectId, ref: 'usuarios', default: [] }],
  // Campos adicionales para compatibilidad
  colegioId: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'usuarios' },
  titulo: { type: String },
  contexto: {
    tipo: { type: String },
    referenciaId: { type: String },
  },
  historial: [{
    emisor: { type: String, enum: ['user', 'ai'] },
    contenido: { type: String },
    timestamp: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

chatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const ChatSession = model<IChat>('chats', chatSchema);
