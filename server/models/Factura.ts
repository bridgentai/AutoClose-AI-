import { Schema, model, Types } from 'mongoose';

interface IFactura {
  facturaId: string;
  usuarioId: Types.ObjectId; // padre o responsable del pago
  estudianteId?: Types.ObjectId;
  colegioId: string;
  concepto: string;
  monto: number;
  fecha: Date;
  fechaVencimiento?: Date;
  estado: 'pendiente' | 'pagada' | 'vencida' | 'anulada';
}

const facturaSchema = new Schema<IFactura>({
  facturaId: { type: String, required: true, unique: true },
  usuarioId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  estudianteId: { type: Schema.Types.ObjectId, ref: 'usuarios' },
  colegioId: { type: String, required: true, default: 'COLEGIO_DEMO_2025' },
  concepto: { type: String, required: true, default: 'Pensión' },
  monto: { type: Number, required: true },
  fecha: { type: Date, default: Date.now },
  fechaVencimiento: { type: Date },
  estado: { type: String, required: true, enum: ['pendiente', 'pagada', 'vencida', 'anulada'], default: 'pendiente' },
});

// Índices para búsquedas rápidas
facturaSchema.index({ usuarioId: 1, fecha: -1 });
facturaSchema.index({ colegioId: 1, estado: 1, fecha: -1 });
facturaSchema.index({ estado: 1, fecha: -1 });
// facturaId ya tiene índice único por el unique: true en la definición del campo

export const Factura = model<IFactura>('facturas', facturaSchema);

