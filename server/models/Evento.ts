import { Schema, model, Types } from 'mongoose';

interface IEvento {
  titulo: string;
  descripcion: string;
  fecha: Date;
  tipo: 'curso' | 'colegio';
  cursoId?: Types.ObjectId;
}

const eventoSchema = new Schema<IEvento>({
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  fecha: { type: Date, required: true },
  tipo: { 
    type: String, 
    required: true, 
    enum: ['curso', 'colegio'] 
  },
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos' },
});

// Índices para búsquedas rápidas
eventoSchema.index({ fecha: -1 });
eventoSchema.index({ tipo: 1, fecha: -1 });
eventoSchema.index({ cursoId: 1, fecha: -1 });

export const Evento = model<IEvento>('eventos', eventoSchema);

