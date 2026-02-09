import express from 'express';
import { Boletin, User, Vinculacion } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// GET /api/boletin - Listar boletines según rol (estudiante/padre: los suyos o de hijos; directivo/profesor: del colegio o sus cursos)
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    let filter: Record<string, unknown> = { colegioId };

    if (rol === 'directivo' || rol === 'admin-general-colegio') {
      // Todos los boletines del colegio
    } else if (rol === 'profesor') {
      const { Course } = await import('../models/Course');
      const taught = await Course.find({ profesorIds: normalizeIdForQuery(userId), colegioId }).select('_id').lean();
      const ids = taught.map((c) => c._id);
      if (ids.length) filter.cursoId = { $in: ids };
      else return res.json([]);
    } else if (rol === 'estudiante') {
      filter['resumen.estudianteId'] = normalizeIdForQuery(userId);
    } else if (rol === 'padre') {
      const vincs = await Vinculacion.find({ padreId: normalizeIdForQuery(userId), estado: 'vinculado' })
        .select('estudianteId')
        .lean();
      const estudianteIds = vincs.map((v) => v.estudianteId);
      if (estudianteIds.length === 0) return res.json([]);
      filter['resumen.estudianteId'] = { $in: estudianteIds };
    } else {
      return res.status(403).json({ message: 'Rol no autorizado para ver boletines.' });
    }

    const list = await Boletin.find(filter)
      .populate('cursoId', 'nombre')
      .populate('generadoPor', 'nombre')
      .sort({ fecha: -1 })
      .limit(50)
      .lean();

    return res.json(list);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar boletines.' });
  }
});

// GET /api/boletin/:id - Un boletín (solo si el usuario tiene permiso)
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const doc = await Boletin.findOne({ _id: normalizeIdForQuery(id), colegioId })
      .populate('cursoId', 'nombre')
      .populate('generadoPor', 'nombre')
      .lean();

    if (!doc) return res.status(404).json({ message: 'Boletín no encontrado.' });

    const normalizedUser = normalizeIdForQuery(userId);
    if (rol === 'directivo' || rol === 'admin-general-colegio') {
      return res.json(doc);
    }
    if (rol === 'profesor') {
      const { Course } = await import('../models/Course');
      const course = await Course.findOne({
        _id: doc.cursoId,
        profesorIds: normalizedUser,
        colegioId,
      }).lean();
      if (course) return res.json(doc);
    }
    if (rol === 'estudiante') {
      const hasMe = (doc.resumen || []).some(
        (r: { estudianteId?: unknown }) => (r.estudianteId as unknown as string)?.toString() === normalizedUser
      );
      if (hasMe) return res.json(doc);
    }
    if (rol === 'padre') {
      const vincs = await Vinculacion.find({ padreId: normalizedUser, estado: 'vinculado' }).select('estudianteId').lean();
      const allowedIds = new Set(vincs.map((v) => (v.estudianteId as unknown as string)?.toString()));
      const hasChild = (doc.resumen || []).some((r: { estudianteId?: unknown }) =>
        allowedIds.has((r.estudianteId as unknown as string)?.toString())
      );
      if (hasChild) return res.json(doc);
    }

    return res.status(403).json({ message: 'No autorizado a ver este boletín.' });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener boletín.' });
  }
});

export default router;
