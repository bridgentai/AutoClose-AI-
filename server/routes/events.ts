import express from 'express';
import { Evento, Course } from '../models';
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

// GET /api/events - Listar eventos (todos los roles; filtro por colegio, opcional curso y rango)
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const { desde, hasta, tipo, cursoId } = req.query;
    const filter: Record<string, unknown> = { colegioId };

    if (tipo === 'curso' || tipo === 'colegio') filter.tipo = tipo;
    if (cursoId) filter.cursoId = normalizeIdForQuery(cursoId as string);
    if (desde && hasta) {
      filter.fecha = {
        $gte: new Date(desde as string),
        $lte: new Date(hasta as string),
      };
    } else if (desde) filter.fecha = { $gte: new Date(desde as string) };
    else if (hasta) filter.fecha = { $lte: new Date(hasta as string) };

    const list = await Evento.find(filter)
      .populate('cursoId', 'nombre')
      .populate('creadoPor', 'nombre')
      .sort({ fecha: 1 })
      .lean();

    return res.json(list);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar eventos.' });
  }
});

// GET /api/events/:id - Un evento
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const evento = await Evento.findOne({ _id: normalizeIdForQuery(id), colegioId })
      .populate('cursoId', 'nombre')
      .populate('creadoPor', 'nombre')
      .lean();

    if (!evento) return res.status(404).json({ message: 'Evento no encontrado.' });
    return res.json(evento);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener evento.' });
  }
});

// POST /api/events - Crear evento (directivo, admin-general-colegio, profesor si tipo curso)
router.post('/', protect, restrictTo('directivo', 'admin-general-colegio', 'profesor'), async (req: AuthRequest, res) => {
  try {
    const { titulo, descripcion, fecha, tipo, cursoId } = req.body;
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!titulo || !fecha || !['curso', 'colegio'].includes(tipo)) {
      return res.status(400).json({ message: 'Faltan titulo, fecha o tipo (curso|colegio).' });
    }
    if (tipo === 'curso' && !cursoId) {
      return res.status(400).json({ message: 'cursoId requerido para evento de tipo curso.' });
    }

    const evento = await Evento.create({
      titulo,
      descripcion: descripcion || '',
      fecha: new Date(fecha),
      tipo,
      cursoId: tipo === 'curso' ? normalizeIdForQuery(cursoId) : undefined,
      colegioId,
      creadoPor: userId,
    });

    const populated = await Evento.findById(evento._id)
      .populate('cursoId', 'nombre')
      .populate('creadoPor', 'nombre')
      .lean();

    return res.status(201).json(populated);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear evento.' });
  }
});

// PUT /api/events/:id - Actualizar evento
router.put('/:id', protect, restrictTo('directivo', 'admin-general-colegio', 'profesor'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, fecha, tipo, cursoId } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const update: Record<string, unknown> = {};
    if (titulo != null) update.titulo = titulo;
    if (descripcion != null) update.descripcion = descripcion;
    if (fecha != null) update.fecha = new Date(fecha);
    if (tipo != null) update.tipo = tipo;
    if (cursoId != null) update.cursoId = tipo === 'curso' ? normalizeIdForQuery(cursoId) : undefined;

    const evento = await Evento.findOneAndUpdate(
      { _id: normalizeIdForQuery(id), colegioId },
      { $set: update },
      { new: true }
    )
      .populate('cursoId', 'nombre')
      .populate('creadoPor', 'nombre')
      .lean();

    if (!evento) return res.status(404).json({ message: 'Evento no encontrado.' });
    return res.json(evento);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al actualizar evento.' });
  }
});

// DELETE /api/events/:id - Eliminar evento
router.delete('/:id', protect, restrictTo('directivo', 'admin-general-colegio', 'profesor'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const deleted = await Evento.findOneAndDelete({ _id: normalizeIdForQuery(id), colegioId });
    if (!deleted) return res.status(404).json({ message: 'Evento no encontrado.' });
    return res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al eliminar evento.' });
  }
});

export default router;
