import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { generateUserId } from '../utils/idGenerator';

interface IUser {
  nombre: string;
  correo: string;
  password: string;
  rol: 'estudiante' | 'profesor' | 'directivo' | 'padre' | 'administrador' | 'administrador-general' | 'transporte' | 'tesoreria' | 'nutricion' | 'cafeteria' | 'asistente';
  colegioId: string;
  estado: string;
  configuraciones: Record<string, any>;
  // Campos adicionales para compatibilidad
  email?: string;
  curso?: string;
  materias?: string[];
  hijoId?: string;
  codigoUnico?: string;
  telefono?: string;
  celular?: string;
  direccion?: string;
  barrio?: string;
  ciudad?: string;
  fechaNacimiento?: Date;
  seccion?: 'junior-school' | 'middle-school' | 'high-school'; // Para asistentes
  createdAt: Date;
  // NUEVO: ID categorizado por rol
  userId?: string; // ID categorizado (ej: "PROF-507f1f77bcf86cd799439011")
  matchPassword(enteredPassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  nombre: { type: String, required: true },
  correo: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  rol: { 
    type: String, 
    required: true, 
    enum: ['estudiante', 'profesor', 'directivo', 'padre', 'administrador', 'administrador-general', 'transporte', 'tesoreria', 'nutricion', 'cafeteria', 'asistente'] 
  },
  colegioId: { type: String, required: true, default: 'COLEGIO_DEMO_2025' },
  estado: { type: String, default: 'activo' },
  configuraciones: { type: Schema.Types.Mixed, default: {} },
  // Campos adicionales para compatibilidad
  email: { type: String },
  curso: { type: String },
  materias: { type: [String], default: [] },
  hijoId: { type: String },
  codigoUnico: { 
    type: String, 
    unique: true, 
    sparse: true,
    required: false,
  },
  telefono: { type: String },
  celular: { type: String },
  direccion: { type: String },
  barrio: { type: String },
  ciudad: { type: String },
  fechaNacimiento: { type: Date },
  seccion: { 
    type: String, 
    enum: ['junior-school', 'middle-school', 'high-school'],
    required: false 
  },
  createdAt: { type: Date, default: Date.now },
  // NUEVO: ID categorizado por rol
  userId: { 
    type: String, 
    unique: true, 
    sparse: true,
    index: true 
  },
});

userSchema.pre('save', async function(next) {
  // Sincronizar email con correo para compatibilidad
  if (this.email && !this.correo) {
    this.correo = this.email;
  }
  if (this.correo && !this.email) {
    this.email = this.correo;
  }
  
  // Generar userId categorizado si no existe y tenemos rol
  if (!this.userId && this.rol && this._id) {
    try {
      const categorizedId = generateUserId(this.rol, this._id);
      this.userId = categorizedId.fullId;
    } catch (error: any) {
      console.error('Error al generar userId categorizado:', error.message);
      // Continuar sin userId si hay error (para compatibilidad)
    }
  }
  
  // Hash de password
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = model<IUser>('usuarios', userSchema);
