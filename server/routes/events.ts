import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import {
  findEventsByInstitutionWithDetails,
  findEventByIdWithDetails,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../repositories/eventRepository.js';

const router = express.Router();

function restrictTo(...roles: string[]) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'No autorizado para esta acción.' });
    }
    next();
  };
}

function toEventResponse(row: {
  id: string;
  title: string;
  description: string | null;
  date: string;
  type: string;
  group_id: string | null;
  created_by_id: string | null;
  group_name?: string | null;
  created_by_name?: string | null;
}) {
  return {
    _id: row.id,
    id: row.id,
    titulo: row.title,
    descripcion: row.description ?? '',
    fecha: row.date,
    tipo: row.type,
    cursoId: row.group_id ? { _id: row.group_id, nombre: row.group_name ?? '' } : null,
    creadoPor: row.created_by_id ? { _id: row.created_by_id, nombre: row.created_by_name ?? '' } : null,
  };
}

router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const { desde, hasta, tipo, cursoId } = req.query;
    const list = await findEventsByInstitutionWithDetails(colegioId, {
      fromDate: desde as string,
      toDate: hasta as string,
      type: tipo as string,
      groupId: cursoId as string,
    });
    return res.json(list.map(toEventResponse));
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar eventos.' });
  }
});

router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const evento = await findEventByIdWithDetails(id);
    if (!evento || evento.institution_id !== colegioId) return res.status(404).json({ message: 'Evento no encontrado.' });
    return res.json(toEventResponse(evento));
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener evento.' });
  }
});

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

    const created = await createEvent({
      institution_id: colegioId,
      title: titulo,
      description: descripcion || null,
      date: fecha,
      type: tipo,
      group_id: tipo === 'curso' ? cursoId : null,
      created_by_id: userId,
    });
    const withDetails = await findEventByIdWithDetails(created.id);
    return res.status(201).json(withDetails ? toEventResponse(withDetails) : toEventResponse(created));
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear evento.' });
  }
});

router.put('/:id', protect, restrictTo('directivo', 'admin-general-colegio', 'profesor'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, fecha, tipo, cursoId } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const updates: { title?: string; description?: string; date?: string; type?: string; group_id?: string | null } = {};
    if (titulo != null) updates.title = titulo;
    if (descripcion != null) updates.description = descripcion;
    if (fecha != null) updates.date = fecha;
    if (tipo != null) updates.type = tipo;
    if (cursoId != null) updates.group_id = tipo === 'curso' ? cursoId : null;
    const evento = await updateEvent(id, colegioId, updates);
    if (!evento) return res.status(404).json({ message: 'Evento no encontrado.' });
    const withDetails = await findEventByIdWithDetails(id);
    return res.json(withDetails ? toEventResponse(withDetails) : toEventResponse(evento));
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al actualizar evento.' });
  }
});

router.delete('/:id', protect, restrictTo('directivo', 'admin-general-colegio', 'profesor'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const ok = await deleteEvent(id, colegioId);
    if (!ok) return res.status(404).json({ message: 'Evento no encontrado.' });
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al eliminar evento.' });
  }
});

export default router;
