import { Schema, model, Document } from 'mongoose';

interface IGroup extends Document {
  nombre: string;
  descripcion: string;
  colegioId: string;
  // Campo adicional para compatibilidad
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const groupSchema = new Schema<IGroup>({
  nombre: { type: String, required: true },
  descripcion: { type: String, required: true },
  colegioId: { type: String, required: true, default: 'COLEGIO_DEMO_2025' },
}, { timestamps: true });

export const Group = model<IGroup>('grupos', groupSchema);
