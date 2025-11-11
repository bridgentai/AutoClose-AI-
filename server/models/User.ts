import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

interface IUser {
  nombre: string;
  email: string;
  password: string;
  rol: 'estudiante' | 'profesor' | 'directivo' | 'padre';
  curso?: string;
  colegioId: string;
  hijoId?: string;
  createdAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  rol: { 
    type: String, 
    required: true, 
    enum: ['estudiante', 'profesor', 'directivo', 'padre'] 
  },
  curso: { type: String },
  colegioId: { type: String, required: true, default: 'default_colegio' },
  hijoId: { type: String }, // Para padres
  createdAt: { type: Date, default: Date.now },
});

// Hash password antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar password
userSchema.methods.matchPassword = async function(enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = model<IUser>('User', userSchema);
