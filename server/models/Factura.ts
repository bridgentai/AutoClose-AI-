import { Schema, model, Types } from 'mongoose';

interface IFactura {
  facturaId: string;
  usuarioId: Types.ObjectId;
  monto: number;
  fecha: Date;
  estado: string;
}

const facturaSchema = new Schema<IFactura>({
  facturaId: { type: String, required: true, unique: true },
  usuarioId: { type: Schema.Types.ObjectId, ref: 'usuarios', required: true },
  monto: { type: Number, required: true },
  fecha: { type: Date, default: Date.now },
  estado: { type: String, required: true },
});

// Índices para búsquedas rápidas
facturaSchema.index({ usuarioId: 1, fecha: -1 });
facturaSchema.index({ estado: 1, fecha: -1 });
facturaSchema.index({ facturaId: 1 });

export const Factura = model<IFactura>('facturas', facturaSchema);

