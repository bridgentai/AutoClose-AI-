import { Schema, model, Types } from 'mongoose';

/** Estado de puntualidad: a tiempo o tarde */
export type PuntualidadEstado = 'on_time' | 'late';

/** Estado de asistencia: presente o ausente */
export type PresenciaEstado = 'presente' | 'ausente';

interface IAsistencia {
  /** ID de la materia (Course) */
  cursoId: Types.ObjectId;
  /** ID del grupo (ej. '11H') - para filtros por grupo */
  grupoId?: string;
  estudianteId: Types.ObjectId;
  fecha: Date;
  /** Hora del bloque (ej. '7:00') - para Registro por bloque horario */
  horaBloque?: string;
  /** Estado de puntualidad: a tiempo | tarde */
  puntualidad?: PuntualidadEstado;
  /** Estado de asistencia: presente | ausente */
  estado: PresenciaEstado;
  colegioId: string;
  /** Usuario que registró (profesor/directivo) */
  recordedBy?: Types.ObjectId;
}

const asistenciaSchema = new Schema<IAsistencia>({
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  grupoId: { type: String },
  estudianteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  fecha: { type: Date, required: true, default: Date.now },
  horaBloque: { type: String },
  puntualidad: { type: String, enum: ['on_time', 'late'] },
  estado: { type: String, required: true, enum: ['presente', 'ausente'] },
  colegioId: { type: String, required: true, default: 'COLEGIO_DEMO_2025' },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'usuarios' },
});

// Índices para búsquedas rápidas
asistenciaSchema.index({ cursoId: 1, fecha: -1 });
asistenciaSchema.index({ grupoId: 1, fecha: -1 });
asistenciaSchema.index({ estudianteId: 1, fecha: -1 });
asistenciaSchema.index({ cursoId: 1, estudianteId: 1, fecha: 1 }, { unique: true });
asistenciaSchema.index({ colegioId: 1, fecha: -1 });

export const Asistencia = model<IAsistencia>('asistencias', asistenciaSchema);

