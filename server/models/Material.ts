import { Schema, model, Types } from 'mongoose';

interface IMaterial {
  titulo: string;
  tipo: string;
  url: string;
  cursoId: Types.ObjectId;
  materiaId: Types.ObjectId;
  // Campos adicionales para compatibilidad
  colegioId?: string;
  descripcion?: string;
  contenido?: string;
  uploadedBy?: Types.ObjectId;
  createdAt: Date;
}

const materialSchema = new Schema<IMaterial>({
  titulo: { type: String, required: true },
  tipo: { type: String, required: true },
  url: { type: String, required: true },
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  materiaId: { type: Schema.Types.ObjectId, ref: 'materias', required: true },
  // Campos adicionales para compatibilidad
  colegioId: { type: String },
  descripcion: { type: String },
  contenido: { type: String },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'usuarios' },
  createdAt: { type: Date, default: Date.now },
});

export const Material = model<IMaterial>('materiales', materialSchema);
