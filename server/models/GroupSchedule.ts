import { Schema, model, Types } from 'mongoose';

/** Slot key: "dia-periodo" (ej. "1-3") -> courseId (ObjectId) */
export interface IGroupSchedule {
  colegioId: string;
  grupoId: string;
  /** Mapa de "dia-periodo" a courseId. Ej: { "1-1": ObjectId, "2-3": ObjectId } */
  slots: Record<string, Types.ObjectId>;
  updatedAt: Date;
}

const groupScheduleSchema = new Schema<IGroupSchedule>({
  colegioId: { type: String, required: true },
  grupoId: { type: String, required: true },
  slots: { type: Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});

groupScheduleSchema.index({ colegioId: 1, grupoId: 1 }, { unique: true });

export const GroupSchedule = model<IGroupSchedule>('group_schedules', groupScheduleSchema);
