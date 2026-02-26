import { Schema, model, Types } from 'mongoose';

export interface IMaterialFile {
  nombre: string;
  url: string;
  tipo?: string;
}

interface IMaterial {
  titulo: string;
  tipo: string;
  url: string;
  cursoId: Types.ObjectId;
  materiaId: Types.ObjectId;
  /** Múltiples archivos (opcional; si está vacío se usa url) */
  files?: IMaterialFile[];
  /** ID de documento estilo Google (futuro) */
  documentId?: string;
  /** Tareas a las que está vinculado este material */
  linkedAssignments?: Types.ObjectId[];
  colegioId?: string;
  descripcion?: string;
  contenido?: string;
  uploadedBy?: Types.ObjectId;
  createdAt: Date;
}

const materialFileSchema = new Schema<IMaterialFile>({
  nombre: { type: String, required: true },
  url: { type: String, required: true },
  tipo: { type: String },
}, { _id: false });

const materialSchema = new Schema<IMaterial>({
  titulo: { type: String, required: true },
  tipo: { type: String, required: true },
  url: { type: String, default: '' },
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  materiaId: { type: Schema.Types.ObjectId, ref: 'materias', required: true },
  files: { type: [materialFileSchema], default: [] },
  documentId: { type: String },
  linkedAssignments: { type: [Schema.Types.ObjectId], ref: 'tareas', default: [] },
  colegioId: { type: String },
  descripcion: { type: String },
  contenido: { type: String },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'usuarios' },
  createdAt: { type: Date, default: Date.now },
});

export const Material = model<IMaterial>('materiales', materialSchema);
