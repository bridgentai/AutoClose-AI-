import { Schema, model, Types, Document } from 'mongoose';

interface IGroupStudent extends Document {
  grupoId: Types.ObjectId;
  estudianteId: Types.ObjectId;
  // Campos adicionales para compatibilidad
  colegioId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const groupStudentSchema = new Schema<IGroupStudent>(
  {
    grupoId: { 
      type: Schema.Types.ObjectId, 
      ref: 'grupos',
      required: true,
      index: true
    },
    estudianteId: { 
      type: Schema.Types.ObjectId, 
      ref: 'usuarios', 
      required: true,
      index: true
    },
    colegioId: { 
      type: String, 
      default: 'COLEGIO_DEMO_2025',
      index: true
    },
  },
  { 
    timestamps: true,
  }
);

// Índice compuesto único para evitar duplicados
groupStudentSchema.index({ grupoId: 1, estudianteId: 1 }, { unique: true });

export const GroupStudent = model<IGroupStudent>('grupo_estudiantes', groupStudentSchema);

