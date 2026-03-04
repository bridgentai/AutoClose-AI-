import { Schema, model, Types } from 'mongoose';

/** Slot key: "dia-periodo" (ej. "1-3") -> grupoId (string, ej. "11H") */
export interface IProfessorSchedule {
  colegioId: string;
  profesorId: string;
  /** Mapa de "dia-periodo" a grupoId. Ej: { "1-1": "11H", "2-3": "10A" } */
  slots: Record<string, string>;
  updatedAt: Date;
}

const professorScheduleSchema = new Schema<IProfessorSchedule>({
  colegioId: { type: String, required: true },
  profesorId: { type: String, required: true },
  slots: { type: Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});

professorScheduleSchema.index({ colegioId: 1, profesorId: 1 }, { unique: true });

export const ProfessorSchedule = model<IProfessorSchedule>('professor_schedules', professorScheduleSchema);
