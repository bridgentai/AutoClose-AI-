import { Schema, model, Types } from 'mongoose';

interface IConversacion {
  colegioId: string;
  asunto: string;
  participanteIds: Types.ObjectId[];
  tipo: 'colegio-padre' | 'profesor-padre' | 'directivo-padre';
  materiaId?: Types.ObjectId;
  creadoPor: Types.ObjectId;
  createdAt: Date;
}

const conversacionSchema = new Schema<IConversacion>({
  colegioId: { type: String, required: true },
  asunto: { type: String, required: true },
  participanteIds: [{ type: Schema.Types.ObjectId, ref: 'usuarios', required: true }],
  tipo: { type: String, required: true, enum: ['colegio-padre', 'profesor-padre', 'directivo-padre'] },
  materiaId: { type: Schema.Types.ObjectId, ref: 'cursos' },
  creadoPor: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  createdAt: { type: Date, default: Date.now },
});

conversacionSchema.index({ colegioId: 1, createdAt: -1 });
conversacionSchema.index({ participanteIds: 1, createdAt: -1 });

export const Conversacion = model<IConversacion>('conversaciones', conversacionSchema);
