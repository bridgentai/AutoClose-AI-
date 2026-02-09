import { Schema, model, Types } from 'mongoose';

interface IMateriaResumen {
  materiaId: string;
  nombre: string;
  promedio: number;
  cantidadNotas: number;
}

interface IEstudianteResumen {
  estudianteId: Types.ObjectId;
  nombre: string;
  promedioGeneral: number;
  materias: IMateriaResumen[];
}

interface IBoletin {
  colegioId: string;
  cursoId: Types.ObjectId;
  periodo: string;
  grupoNombre?: string;
  generadoPor: Types.ObjectId;
  fecha: Date;
  resumen: IEstudianteResumen[];
}

const boletinSchema = new Schema<IBoletin>({
  colegioId: { type: String, required: true },
  cursoId: { type: Schema.Types.ObjectId, ref: 'cursos', required: true },
  periodo: { type: String, required: true },
  grupoNombre: { type: String },
  generadoPor: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  fecha: { type: Date, default: Date.now },
  resumen: {
    type: [{
      estudianteId: Schema.Types.ObjectId,
      nombre: String,
      promedioGeneral: Number,
      materias: [{
        materiaId: String,
        nombre: String,
        promedio: Number,
        cantidadNotas: Number,
      }],
    }],
    default: [],
  },
});

boletinSchema.index({ colegioId: 1, cursoId: 1, periodo: 1 });
boletinSchema.index({ colegioId: 1, fecha: -1 });

export const Boletin = model<IBoletin>('boletines', boletinSchema);
