import { Schema, model, Types } from 'mongoose';

interface IPago {
  usuarioId: Types.ObjectId;
  monto: number;
  fecha: Date;
  estado: string;
  metodo: string;
}

const pagoSchema = new Schema<IPago>({
  usuarioId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  monto: { type: Number, required: true },
  fecha: { type: Date, default: Date.now },
  estado: { type: String, required: true },
  metodo: { type: String, required: true },
});

// Índices para búsquedas rápidas
pagoSchema.index({ usuarioId: 1, fecha: -1 });
pagoSchema.index({ estado: 1, fecha: -1 });

export const Pago = model<IPago>('pagos', pagoSchema);

