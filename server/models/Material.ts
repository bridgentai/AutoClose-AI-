import { Schema, model } from 'mongoose';

interface IMaterial {
  colegioId: string;
  cursoId: Schema.Types.ObjectId;
  titulo: string;
  descripcion?: string;
  tipo: 'pdf' | 'documento' | 'video' | 'enlace' | 'otro';
  url?: string;
  contenido?: string;
  uploadedBy: Schema.Types.ObjectId;
  createdAt: Date;
}

const materialSchema = new Schema<IMaterial>({
  colegioId: { type: String, required: true },
  cursoId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  titulo: { type: String, required: true },
  descripcion: { type: String },
  tipo: { 
    type: String, 
    required: true, 
    enum: ['pdf', 'documento', 'video', 'enlace', 'otro'] 
  },
  url: { type: String },
  contenido: { type: String }, // Para contexto de IA
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Material = model<IMaterial>('Material', materialSchema);
