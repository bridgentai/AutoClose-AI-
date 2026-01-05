import { Schema, model } from 'mongoose';

interface ICodigoInstitucion {
  colegioId: string;
  codigo: string;
  rolAsignado: string;
}

const codigoInstitucionSchema = new Schema<ICodigoInstitucion>({
  colegioId: { type: String, required: true },
  codigo: { type: String, required: true },
  rolAsignado: { type: String, required: true },
});

// Índice único para evitar códigos duplicados por colegio
codigoInstitucionSchema.index({ colegioId: 1, codigo: 1 }, { unique: true });
codigoInstitucionSchema.index({ codigo: 1 });

export const CodigoInstitucion = model<ICodigoInstitucion>('codigos_institucion', codigoInstitucionSchema);

