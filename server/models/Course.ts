import { Schema, model, Types } from 'mongoose';

interface ICourse {
  nombre: string;
  /** Opcional cuando la materia viene del profesor (flujo admin: asignar profesor a grupos). */
  materiaId?: Types.ObjectId;
  estudiantes: Types.ObjectId[];
  profesorId?: Types.ObjectId;
  // Campos adicionales para compatibilidad
  colegioId?: string;
  descripcion?: string;
  profesorIds?: Types.ObjectId[];
  cursos?: string[];
  estudianteIds?: Types.ObjectId[];
  colorAcento?: string;
  icono?: string;
  createdAt: Date;
  /** Optional grading schema (new engine); when set, categories and GradeEvents are used. */
  gradingSchemaId?: Types.ObjectId;
}

const courseSchema = new Schema<ICourse>({
  nombre: { type: String, required: true },
  materiaId: { type: Schema.Types.ObjectId, ref: 'materias', required: false },
  estudiantes: [{ type: Schema.Types.ObjectId, ref: 'usuarios', default: [] }],
  profesorId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: false },
  // Campos adicionales para compatibilidad
  colegioId: { type: String },
  descripcion: { type: String },
  profesorIds: [{ type: Schema.Types.ObjectId, ref: 'usuarios', default: [] }],
  cursos: [{ type: String }],
  estudianteIds: [{ type: Schema.Types.ObjectId, ref: 'usuarios', default: [] }],
  colorAcento: { type: String, default: '#9f25b8' },
  icono: { type: String },
  createdAt: { type: Date, default: Date.now },
  gradingSchemaId: { type: Schema.Types.ObjectId, ref: 'grading_schemas' },
});

export const Course = model<ICourse>('cursos', courseSchema);