import { Schema, model, Types } from 'mongoose';

interface IPago {
  usuarioId: Types.ObjectId;
  facturaId?: Types.ObjectId;
  colegioId: string;
  monto: number;
  fecha: Date;
  estado: 'pendiente' | 'completado' | 'fallido';
  metodo: string;
}

const pagoSchema = new Schema<IPago>({
  usuarioId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  facturaId: { type: Schema.Types.ObjectId, ref: 'facturas' },
  colegioId: { type: String, required: true, default: 'COLEGIO_DEMO_2025' },
  monto: { type: Number, required: true },
  fecha: { type: Date, default: Date.now },
  estado: { type: String, required: true, enum: ['pendiente', 'completado', 'fallido'], default: 'completado' },
  metodo: { type: String, required: true, default: 'efectivo' },
});

// Índices para búsquedas rápidas
pagoSchema.index({ usuarioId: 1, fecha: -1 });
pagoSchema.index({ colegioId: 1, fecha: -1 });
pagoSchema.index({ facturaId: 1 });
pagoSchema.index({ estado: 1, fecha: -1 });

export const Pago = model<IPago>('pagos', pagoSchema);

