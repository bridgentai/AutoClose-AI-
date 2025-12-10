import { Schema, model, Types } from 'mongoose';

export interface IAttachment {
  tipo: 'pdf' | 'link' | 'imagen' | 'documento' | 'otro';
  nombre: string;
  url: string;
}

export interface ISubmission {
  estudianteId: Types.ObjectId;
  estudianteNombre: string;
  archivos: IAttachment[];
  comentario?: string;
  fechaEntrega: Date;
  calificacion?: number;
  retroalimentacion?: string;
}

export interface IAssignment {
  titulo: string;
  descripcion: string;
  curso: string; // ej: "11H", "10A"
  courseId?: Types.ObjectId; // Referencia al Course (materia como Matemáticas, Física)
  fechaEntrega: Date;
  profesorId: Types.ObjectId;
  profesorNombre: string;
  colegioId: string;
  adjuntos: IAttachment[];
  entregas: ISubmission[];
  createdAt: Date;
}

const attachmentSchema = new Schema<IAttachment>({
  tipo: { type: String, enum: ['pdf', 'link', 'imagen', 'documento', 'otro'], required: true },
  nombre: { type: String, required: true },
  url: { type: String, required: true },
}, { _id: false });

const submissionSchema = new Schema<ISubmission>({
  estudianteId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  estudianteNombre: { type: String, required: true },
  archivos: [attachmentSchema],
  comentario: { type: String },
  fechaEntrega: { type: Date, default: Date.now },
  calificacion: { type: Number },
  retroalimentacion: { type: String },
}, { _id: true });

const assignmentSchema = new Schema<IAssignment>({
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  curso: { type: String, required: true },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
  fechaEntrega: { type: Date, required: true },
  profesorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  profesorNombre: { type: String, required: true },
  colegioId: { type: String, required: true },
  adjuntos: { type: [attachmentSchema], default: [] },
  entregas: { type: [submissionSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

// Índice para búsquedas rápidas por curso y fecha
assignmentSchema.index({ curso: 1, fechaEntrega: 1 });
assignmentSchema.index({ colegioId: 1, curso: 1 });

export const Assignment = model<IAssignment>('Assignment', assignmentSchema);
