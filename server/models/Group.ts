import { Schema, model, Document } from 'mongoose';

interface IGroup extends Document {
  _id: string;
  nombre: string;
  colegioId: string;
}

const groupSchema = new Schema<IGroup>({
  _id: { type: String, required: true },
  nombre: { type: String, required: true },
  colegioId: { type: String, required: true, default: 'COLEGIO_DEMO_2025' },
}, { timestamps: true });

export const Group = model<IGroup>('Group', groupSchema);
