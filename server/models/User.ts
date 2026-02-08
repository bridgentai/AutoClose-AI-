import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { generateUserId } from '../utils/idGenerator';

interface IUser {
  nombre: string;
  correo: string;
  password: string;
  rol: 'estudiante' | 'profesor' | 'directivo' | 'padre' | 'administrador' | 'administrador-general' | 'admin-general-colegio' | 'transporte' | 'tesoreria' | 'nutricion' | 'cafeteria' | 'asistente' | 'school_admin' | 'super_admin';
  colegioId: string;
  estado: 'pending' | 'active' | 'suspended' | 'pendiente_vinculacion' | 'vinculado'; // Estado del usuario
  configuraciones: Record<string, any>;
  // Campos adicionales para compatibilidad
  email?: string;
  curso?: string;
  materias?: string[];
  hijoId?: string;
  codigoUnico?: string;
  /** Código interno (matrícula / código profesor) para referencia; no único. */
  codigoInterno?: string;
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
  // Unicidad por (correo, colegioId) para multi-tenant: mismo email permitido en otro colegio
  correo: { type: String, required: true, lowercase: true },
  password: { type: String, required: true },
  rol: { 
    type: String, 
    required: true, 
    enum: ['estudiante', 'profesor', 'directivo', 'padre', 'administrador', 'administrador-general', 'admin-general-colegio', 'transporte', 'tesoreria', 'nutricion', 'cafeteria', 'asistente', 'school_admin', 'super_admin'] 
  },
  // ⚠️ SEGURIDAD: En producción, considerar hacer colegioId opcional para super_admin
  // Por ahora, super_admin usa 'GLOBAL_ADMIN' como valor especial
  colegioId: { 
    type: String, 
    required: true, 
    default: 'COLEGIO_DEMO_2025' 
  },
  estado: { 
    type: String, 
    enum: ['pending', 'active', 'suspended', 'pendiente_vinculacion', 'vinculado'],
    default: 'active' // Por defecto activo para mantener compatibilidad
  },
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
  codigoInterno: { type: String, required: false },
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

// Unicidad de email por colegio (multi-tenant)
userSchema.index({ correo: 1, colegioId: 1 }, { unique: true });

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
