import { Schema, model } from 'mongoose';

interface ICourse {
  colegioId: string;
  nombre: string;
  descripcion?: string;
  profesorId: Schema.Types.ObjectId;
  cursos: string[]; // ["10A", "11B"]
  colorAcento?: string;
  icono?: string;
  createdAt: Date;
}

const courseSchema = new Schema<ICourse>({
  colegioId: { type: String, required: true },
  nombre: { type: String, required: true },
  descripcion: { type: String },
  profesorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  cursos: [{ type: String }],
  colorAcento: { type: String, default: '#9f25b8' },
  icono: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const Course = model<ICourse>('Course', courseSchema);
