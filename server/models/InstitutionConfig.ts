import { Schema, model } from 'mongoose';

interface IInstitutionConfig {
  colegioId: string;
  nombre: string;
  logoUrl?: string;
  parametros: Record<string, any>;
  // Campos adicionales para compatibilidad
  nombreIA?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  metodologia?: string;
  curriculum?: string;
  createdAt: Date;
  updatedAt: Date;
}

const institutionConfigSchema = new Schema<IInstitutionConfig>({
  colegioId: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  logoUrl: { type: String, required: false, default: '' },
  parametros: { type: Schema.Types.Mixed, default: {} },
  // Campos adicionales para compatibilidad
  nombreIA: { type: String, default: 'MindOS' },
  colorPrimario: { type: String, default: '#9f25b8' },
  colorSecundario: { type: String, default: '#6a0dad' },
  metodologia: { type: String },
  curriculum: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

institutionConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const InstitutionConfig = model<IInstitutionConfig>('config_institucion', institutionConfigSchema);
