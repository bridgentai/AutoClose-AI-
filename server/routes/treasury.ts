import express from 'express';
import { Factura, Pago, User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

function restrictTo(...roles: string[]) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'No autorizado para esta acción.' });
    }
    next();
  };
}

function generateFacturaId(): string {
  return `F-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// GET /api/treasury/stats - KPIs tesorería (admin-general-colegio, directivo, tesoreria)
router.get('/stats', protect, restrictTo('admin-general-colegio', 'directivo', 'tesoreria', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId === 'GLOBAL_ADMIN' ? undefined : req.user?.colegioId;
    if (!colegioId && req.user?.rol !== 'super_admin') return res.status(401).json({ message: 'No autorizado.' });

    const filter = colegioId ? { colegioId } : {};
    const [pendientes, pagadas, facturasMes, pagosMes] = await Promise.all([
      Factura.countDocuments({ ...filter, estado: 'pendiente' }),
      Factura.countDocuments({ ...filter, estado: 'pagada' }),
      Factura.countDocuments({
        ...filter,
        fecha: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      }),
      Pago.aggregate([
        { $match: { ...filter, estado: 'completado' } },
        {
          $match: {
            fecha: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
        },
        { $group: { _id: null, total: { $sum: '$monto' } } },
      ]),
    ]);

    const ingresosMes = (pagosMes[0]?.total ?? 0) as number;
    const totalFacturado = await Factura.aggregate([
      { $match: { ...filter, estado: 'pendiente' } },
      { $group: { _id: null, total: { $sum: '$monto' } } },
    ]);
    const totalPendienteCobro = (totalFacturado[0]?.total ?? 0) as number;

    return res.json({
      pagosPendientes: pendientes,
      facturasEmitidasMes: facturasMes,
      ingresosMes,
      padresConDeuda: await Factura.distinct('usuarioId', { ...filter, estado: 'pendiente' }).then((arr) => arr.length),
      totalPendienteCobro,
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener estadísticas.' });
  }
});

// GET /api/treasury/facturas - Listar facturas (padre: propias; tesoreria/directivo: todas del colegio)
router.get('/facturas', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const filter: Record<string, unknown> = { colegioId };
    if (rol === 'padre') filter.usuarioId = normalizeIdForQuery(userId || '');

    const list = await Factura.find(filter)
      .populate('usuarioId', 'nombre correo')
      .populate('estudianteId', 'nombre curso')
      .sort({ fecha: -1 })
      .limit(100)
      .lean();

    return res.json(list);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar facturas.' });
  }
});

// POST /api/treasury/facturas - Crear factura (tesoreria, admin-general-colegio, directivo)
router.post('/facturas', protect, restrictTo('admin-general-colegio', 'directivo', 'tesoreria', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const { usuarioId, estudianteId, concepto, monto, fechaVencimiento } = req.body;
    const colegioId = req.user?.colegioId === 'GLOBAL_ADMIN' ? (req.body.colegioId || 'COLEGIO_DEMO_2025') : req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!usuarioId || !concepto || monto == null) {
      return res.status(400).json({ message: 'Faltan usuarioId, concepto o monto.' });
    }

    let facturaId = generateFacturaId();
    while (await Factura.findOne({ facturaId })) {
      facturaId = generateFacturaId();
    }

    const factura = await Factura.create({
      facturaId,
      usuarioId: normalizeIdForQuery(usuarioId),
      estudianteId: estudianteId ? normalizeIdForQuery(estudianteId) : undefined,
      colegioId,
      concepto,
      monto: Number(monto),
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : undefined,
      estado: 'pendiente',
    });

    const populated = await Factura.findById(factura._id)
      .populate('usuarioId', 'nombre correo')
      .populate('estudianteId', 'nombre curso')
      .lean();

    return res.status(201).json(populated);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear factura.' });
  }
});

// PATCH /api/treasury/facturas/:id - Actualizar estado factura (anulada, etc.)
router.patch('/facturas/:id', protect, restrictTo('admin-general-colegio', 'directivo', 'tesoreria', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!['pendiente', 'pagada', 'vencida', 'anulada'].includes(estado)) {
      return res.status(400).json({ message: 'Estado inválido.' });
    }

    const factura = await Factura.findOneAndUpdate(
      { _id: normalizeIdForQuery(id), colegioId },
      { $set: { estado } },
      { new: true }
    )
      .populate('usuarioId', 'nombre correo')
      .populate('estudianteId', 'nombre curso')
      .lean();

    if (!factura) return res.status(404).json({ message: 'Factura no encontrada.' });
    return res.json(factura);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al actualizar factura.' });
  }
});

// GET /api/treasury/pagos - Listar pagos
router.get('/pagos', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const filter: Record<string, unknown> = { colegioId };
    if (rol === 'padre') filter.usuarioId = normalizeIdForQuery(userId || '');

    const list = await Pago.find(filter)
      .populate('usuarioId', 'nombre correo')
      .populate('facturaId')
      .sort({ fecha: -1 })
      .limit(100)
      .lean();

    return res.json(list);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar pagos.' });
  }
});

// POST /api/treasury/pagos - Registrar pago (y marcar factura como pagada si aplica)
router.post('/pagos', protect, restrictTo('admin-general-colegio', 'directivo', 'tesoreria', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const { usuarioId, facturaId, monto, metodo } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!usuarioId || monto == null) {
      return res.status(400).json({ message: 'Faltan usuarioId o monto.' });
    }

    const pago = await Pago.create({
      usuarioId: normalizeIdForQuery(usuarioId),
      facturaId: facturaId ? normalizeIdForQuery(facturaId) : undefined,
      colegioId,
      monto: Number(monto),
      metodo: metodo || 'efectivo',
      estado: 'completado',
    });

    if (facturaId) {
      await Factura.findOneAndUpdate(
        { _id: normalizeIdForQuery(facturaId), colegioId },
        { $set: { estado: 'pagada' } }
      );
    }

    const populated = await Pago.findById(pago._id)
      .populate('usuarioId', 'nombre correo')
      .populate('facturaId')
      .lean();

    return res.status(201).json(populated);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al registrar pago.' });
  }
});

export default router;
