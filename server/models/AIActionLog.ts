import { Schema, model, Types } from 'mongoose';

export interface IAIActionLog {
  userId: Types.ObjectId;
  role: string;
  action: string; // ej: "query_notes", "create_assignment", "grade_assignment"
  entityType: string; // ej: "assignment", "note", "message", "course"
  entityId?: Types.ObjectId;
  cursoId?: Types.ObjectId;
  colegioId: string;
  timestamp: Date;
  result: 'success' | 'denied' | 'error';
  error?: string;
  requestData?: Record<string, any>; // Datos de la solicitud para auditoría
}

const aiActionLogSchema = new Schema<IAIActionLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  role: { type: String, required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId },
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos' },
  colegioId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  result: { 
    type: String, 
    enum: ['success', 'denied', 'error'], 
    required: true 
  },
  error: { type: String },
  requestData: { type: Schema.Types.Mixed },
});

// Índices para búsquedas rápidas
aiActionLogSchema.index({ userId: 1, timestamp: -1 });
aiActionLogSchema.index({ role: 1, timestamp: -1 });
aiActionLogSchema.index({ action: 1, timestamp: -1 });
aiActionLogSchema.index({ colegioId: 1, timestamp: -1 });
aiActionLogSchema.index({ result: 1, timestamp: -1 });

export const AIActionLog = model<IAIActionLog>('ai_action_logs', aiActionLogSchema);

