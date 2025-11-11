import { Schema, model } from 'mongoose';

interface IChatMessage {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
}

interface IChatSession {
  colegioId: string;
  userId: Schema.Types.ObjectId;
  titulo: string;
  contexto: {
    tipo: string;
    referenciaId?: string;
  };
  historial: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>({
  colegioId: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  titulo: { type: String, required: true },
  contexto: {
    tipo: { type: String, required: true },
    referenciaId: { type: String },
  },
  historial: [{
    emisor: { type: String, enum: ['user', 'ai'], required: true },
    contenido: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

chatSessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const ChatSession = model<IChatSession>('ChatSession', chatSessionSchema);
