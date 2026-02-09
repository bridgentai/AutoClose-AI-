import { Schema, model, Types } from 'mongoose';

interface IAsistencia {
  cursoId: Types.ObjectId;
  estudianteId: Types.ObjectId;
  fecha: Date;
  estado: 'presente' | 'ausente';
  colegioId: string;
}

const asistenciaSchema = new Schema<IAsistencia>({
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  estudianteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  fecha: { type: Date, required: true, default: Date.now },
  estado: { type: String, required: true, enum: ['presente', 'ausente'] },
  colegioId: { type: String, required: true, default: 'COLEGIO_DEMO_2025' },
});

// Índices para búsquedas rápidas
asistenciaSchema.index({ cursoId: 1, fecha: -1 });
asistenciaSchema.index({ estudianteId: 1, fecha: -1 });
asistenciaSchema.index({ cursoId: 1, estudianteId: 1, fecha: 1 }, { unique: true });
asistenciaSchema.index({ colegioId: 1, fecha: -1 });

export const Asistencia = model<IAsistencia>('asistencias', asistenciaSchema);

