import { Schema, model, Types } from 'mongoose';

interface IMateria {
  nombre: string;
  descripcion: string;
  area: string;
}

const materiaSchema = new Schema<IMateria>({
  nombre: { type: String, required: true },
  descripcion: { type: String, required: true },
  area: { type: String, required: true },
});

export const Materia = model<IMateria>('materias', materiaSchema);

