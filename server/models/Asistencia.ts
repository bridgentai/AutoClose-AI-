import { Schema, model, Types } from 'mongoose';

interface IAsistencia {
  cursoId: Types.ObjectId;
  estudianteId: Types.ObjectId;
  fecha: Date;
  estado: 'presente' | 'ausente';
}

const asistenciaSchema = new Schema<IAsistencia>({
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  estudianteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  fecha: { type: Date, required: true, default: Date.now },
  estado: { 
    type: String, 
    required: true, 
    enum: ['presente', 'ausente'] 
  },
});

// Índices para búsquedas rápidas
asistenciaSchema.index({ cursoId: 1, fecha: -1 });
asistenciaSchema.index({ estudianteId: 1, fecha: -1 });
asistenciaSchema.index({ cursoId: 1, estudianteId: 1, fecha: 1 }, { unique: true });

export const Asistencia = model<IAsistencia>('asistencias', asistenciaSchema);

