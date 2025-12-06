import { Schema, model, Types } from 'mongoose'; // <-- ¡Importamos Types!

interface ICourse {
colegioId: string;
nombre: string;
descripcion?: string;
profesorIds: Types.ObjectId[]; // CAMBIO: Array de IDs para varios profesores
cursos: string[]; // ["10A", "11B"]
  estudianteIds: Types.ObjectId[]; // NUEVO CAMPO: Array de IDs para estudiantes inscritos
colorAcento?: string;
icono?: string;
createdAt: Date;
}

const courseSchema = new Schema<ICourse>({
colegioId: { type: String, required: true },
nombre: { type: String, required: true },
descripcion: { type: String },
profesorIds: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }], // CAMBIO APLICADO
cursos: [{ type: String }],
  estudianteIds: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }], // NUEVO CAMPO APLICADO
colorAcento: { type: String, default: '#9f25b8' },
icono: { type: String },
createdAt: { type: Date, default: Date.now },
});

export const Course = model<ICourse>('Course', courseSchema);