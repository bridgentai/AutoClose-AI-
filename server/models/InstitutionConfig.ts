import { Schema, model } from 'mongoose';

interface IInstitutionConfig {
  colegioId: string;
  nombreIA: string;
  logo?: string;
  colorPrimario: string;
  colorSecundario?: string;
  metodologia?: string;
  curriculum?: string;
  createdAt: Date;
  updatedAt: Date;
}

const institutionConfigSchema = new Schema<IInstitutionConfig>({
  colegioId: { type: String, required: true, unique: true },
  nombreIA: { type: String, required: true, default: 'AutoClose AI' },
  logo: { type: String },
  colorPrimario: { type: String, required: true, default: '#9f25b8' },
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

export const InstitutionConfig = model<IInstitutionConfig>('InstitutionConfig', institutionConfigSchema);
