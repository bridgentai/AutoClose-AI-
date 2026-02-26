import { Schema, model, Types } from 'mongoose';

export interface IAttachment {
  tipo: 'pdf' | 'link' | 'imagen' | 'documento' | 'otro';
  nombre: string;
  url: string;
}

export interface IEntrega {
  estudianteId: Types.ObjectId;
  archivoUrl: string;
  fechaEntrega: Date;
  nota?: number;
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
  contenidoDocumento?: string; // Contenido HTML del documento extendido
  cursoId: Types.ObjectId;
  materiaId: Types.ObjectId;
  profesorId: Types.ObjectId;
  fechaEntrega: Date;
  submissions: ISubmission[];
  adjuntos: string[];
  colegioId: string;
  createdAt: Date;
  // Campos adicionales para compatibilidad
  curso?: string;
  courseId?: Types.ObjectId;
  profesorNombre?: string;
  /** Tipo de logro de calificación (ej: Tareas, Exámenes) - usado para ponderar la nota sobre el 100% */
  logroCalificacionId?: Types.ObjectId;
  /** New grading engine: category under GradingSchema (takes precedence when present) */
  categoryId?: Types.ObjectId;
  /** Max score for this assignment (default 100); used for normalization. */
  maxScore?: number;
  /** Whether forecast can adjust for future assignments in this category. */
  predictiveWeightAdjustmentAllowed?: boolean;
  /** Tipo de tarea: "assignment" (entregable) o "reminder" (recordatorio no entregable) */
  type?: 'assignment' | 'reminder';
  /** Si la tarea es calificada (solo para type === "assignment") */
  isGradable?: boolean;
  // Campo legacy para migración gradual
  entregas?: IEntrega[];
}

const entregaSchema = new Schema<IEntrega>({
  estudianteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  archivoUrl: { type: String, required: true },
  fechaEntrega: { type: Date, default: Date.now },
  nota: { type: Number },
}, { _id: true });

const attachmentSchema = new Schema<IAttachment>({
  tipo: { type: String, enum: ['pdf', 'link', 'imagen', 'documento', 'otro'], required: true },
  nombre: { type: String, required: true },
  url: { type: String, required: true },
}, { _id: false });

const submissionSchema = new Schema<ISubmission>({
  estudianteId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
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
  contenidoDocumento: { type: String }, // Contenido HTML del documento extendido
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  materiaId: { type: Schema.Types.ObjectId, ref: 'materias', required: true },
  profesorId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  fechaEntrega: { type: Date, required: true },
  submissions: { type: [submissionSchema], default: [] },
  adjuntos: { type: [String], default: [] },
  colegioId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  // Campos adicionales para compatibilidad
  curso: { type: String },
  courseId: { type: Schema.Types.ObjectId, ref: 'cursos' },
  profesorNombre: { type: String },
  logroCalificacionId: { type: Schema.Types.ObjectId, ref: 'logros_calificacion' },
  categoryId: { type: Schema.Types.ObjectId, ref: 'grading_categories' },
  maxScore: { type: Number, default: 100 },
  predictiveWeightAdjustmentAllowed: { type: Boolean, default: false },
  type: { type: String, enum: ['assignment', 'reminder'], default: 'assignment' },
  isGradable: { type: Boolean, default: true },
  // Campo legacy para migración gradual
  entregas: { type: [entregaSchema], default: [] },
});

// Índices para búsquedas rápidas
assignmentSchema.index({ cursoId: 1, fechaEntrega: 1 });
assignmentSchema.index({ colegioId: 1, cursoId: 1 });
assignmentSchema.index({ profesorId: 1, fechaEntrega: 1 });

export const Assignment = model<IAssignment>('tareas', assignmentSchema);

export type { IAssignment, ISubmission, IAttachment };
