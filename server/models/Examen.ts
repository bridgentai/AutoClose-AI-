import { Schema, model, Types } from 'mongoose';

interface IExamen {
  titulo: string;
  cursoId: Types.ObjectId;
  materiaId: Types.ObjectId;
  preguntas: Record<string, any>[];
  resultados: Record<string, any>[];
}

const examenSchema = new Schema<IExamen>({
  titulo: { type: String, required: true },
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  materiaId: { type: Schema.Types.ObjectId, ref: 'materias', required: true },
  preguntas: { type: [Schema.Types.Mixed], default: [] },
  resultados: { type: [Schema.Types.Mixed], default: [] },
});

// Índices para búsquedas rápidas
examenSchema.index({ cursoId: 1, materiaId: 1 });

export const Examen = model<IExamen>('examenes', examenSchema);

