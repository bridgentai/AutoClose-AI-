import { Schema, model, Document, Types } from 'mongoose';

interface IGroup extends Document {
  nombre: string;
  descripcion: string;
  colegioId: string;
  /** junior-school | middle-school | high-school (legacy) */
  seccion?: string;
  /** Referencia a la sección (módulo Crear Sección) */
  sectionId?: Types.ObjectId;
  _id?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const groupSchema = new Schema<IGroup>({
  nombre: { type: String, required: true },
  descripcion: { type: String, required: true },
  colegioId: { type: String, required: true, default: 'COLEGIO_DEMO_2025' },
  seccion: { type: String, enum: ['junior-school', 'middle-school', 'high-school'], required: false },
  sectionId: { type: Schema.Types.ObjectId, ref: 'secciones', required: false },
}, { timestamps: true });

export const Group = model<IGroup>('grupos', groupSchema);
