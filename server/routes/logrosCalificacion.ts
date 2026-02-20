import express from 'express';
import { LogroCalificacion, Course } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// GET /api/logros-calificacion?courseId=xxx - Listar logros de una materia (solo profesor asignado)
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.query.courseId as string;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!courseId) {
      return res.status(400).json({ message: 'courseId es requerido.' });
    }

    const normalizedCourseId = normalizeIdForQuery(courseId);
    const course = await Course.findOne({
      _id: normalizedCourseId,
      profesorIds: normalizeIdForQuery(userId),
      colegioId,
    }).lean();

    if (!course) {
      return res.status(403).json({ message: 'No tienes acceso a esta materia.' });
    }

    const logros = await LogroCalificacion.find({
      courseId: normalizedCourseId,
      colegioId,
    })
      .sort({ orden: 1, createdAt: 1 })
      .lean();

    const totalPorcentaje = logros.reduce((sum, l) => sum + (l.porcentaje || 0), 0);

    return res.json({
      logros,
      totalPorcentaje,
      completo: Math.abs(totalPorcentaje - 100) < 0.01,
    });
  } catch (e: unknown) {
    console.error('Error al listar logros:', e);
    return res.status(500).json({ message: 'Error al listar logros de calificación.' });
  }
});

// POST /api/logros-calificacion - Crear logro (solo profesor asignado)
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { nombre, porcentaje, courseId, orden } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!nombre || porcentaje == null || !courseId) {
      return res.status(400).json({ message: 'nombre, porcentaje y courseId son requeridos.' });
    }

    const pct = parseFloat(String(porcentaje));
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ message: 'El porcentaje debe estar entre 0 y 100.' });
    }

    const normalizedCourseId = normalizeIdForQuery(courseId);
    const course = await Course.findOne({
      _id: normalizedCourseId,
      profesorIds: normalizeIdForQuery(userId),
      colegioId,
    }).lean();

    if (!course) {
      return res.status(403).json({ message: 'No tienes acceso a esta materia.' });
    }

    const existentes = await LogroCalificacion.find({
      courseId: normalizedCourseId,
      colegioId,
    }).lean();

    const totalActual = existentes.reduce((sum, l) => sum + (l.porcentaje || 0), 0);
    const nuevoTotal = totalActual + pct;

    if (nuevoTotal > 100.01) {
      return res.status(400).json({
        message: `Los logros deben sumar 100%. Actual: ${totalActual.toFixed(0)}%, nuevo total sería ${nuevoTotal.toFixed(0)}%.`,
        totalActual: Math.round(totalActual),
        disponible: Math.round(100 - totalActual),
      });
    }

    const logro = await LogroCalificacion.create({
      nombre: String(nombre).trim(),
      porcentaje: pct,
      courseId: normalizedCourseId,
      profesorId: userId,
      colegioId,
      orden: orden != null ? parseInt(String(orden), 10) : existentes.length,
    });

    return res.status(201).json(logro);
  } catch (e: unknown) {
    console.error('Error al crear logro:', e);
    return res.status(500).json({ message: 'Error al crear logro de calificación.' });
  }
});

// PUT /api/logros-calificacion/:id - Actualizar logro
router.put('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { nombre, porcentaje, orden } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const logro = await LogroCalificacion.findOne({
      _id: normalizeIdForQuery(id),
      colegioId,
    }).lean();

    if (!logro) {
      return res.status(404).json({ message: 'Logro no encontrado.' });
    }

    const course = await Course.findOne({
      _id: logro.courseId,
      profesorIds: normalizeIdForQuery(userId),
      colegioId,
    }).lean();

    if (!course) {
      return res.status(403).json({ message: 'No tienes acceso a esta materia.' });
    }

    const updates: Record<string, unknown> = {};
    if (nombre !== undefined) updates.nombre = String(nombre).trim();
    if (orden !== undefined) updates.orden = parseInt(String(orden), 10);

    if (porcentaje != null) {
      const pct = parseFloat(String(porcentaje));
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ message: 'El porcentaje debe estar entre 0 y 100.' });
      }
      updates.porcentaje = pct;
    }

    const existentes = await LogroCalificacion.find({
      courseId: logro.courseId,
      colegioId,
      _id: { $ne: logro._id },
    }).lean();

    const totalOtros = existentes.reduce((sum, l) => sum + (l.porcentaje || 0), 0);
    const nuevoPct = updates.porcentaje ?? logro.porcentaje;
    const nuevoTotal = totalOtros + (nuevoPct as number);

    if (nuevoTotal > 100.01) {
      return res.status(400).json({
        message: `Los logros deben sumar 100%. El nuevo total sería ${nuevoTotal.toFixed(0)}%.`,
      });
    }

    const updated = await LogroCalificacion.findByIdAndUpdate(
      normalizeIdForQuery(id),
      { $set: updates },
      { new: true }
    ).lean();

    return res.json(updated);
  } catch (e: unknown) {
    console.error('Error al actualizar logro:', e);
    return res.status(500).json({ message: 'Error al actualizar logro.' });
  }
});

// DELETE /api/logros-calificacion/:id - Eliminar logro
router.delete('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const logro = await LogroCalificacion.findOne({
      _id: normalizeIdForQuery(id),
      colegioId,
    }).lean();

    if (!logro) {
      return res.status(404).json({ message: 'Logro no encontrado.' });
    }

    const course = await Course.findOne({
      _id: logro.courseId,
      profesorIds: normalizeIdForQuery(userId),
      colegioId,
    }).lean();

    if (!course) {
      return res.status(403).json({ message: 'No tienes acceso a esta materia.' });
    }

    await LogroCalificacion.findByIdAndDelete(normalizeIdForQuery(id));

    return res.json({ message: 'Logro eliminado.' });
  } catch (e: unknown) {
    console.error('Error al eliminar logro:', e);
    return res.status(500).json({ message: 'Error al eliminar logro.' });
  }
});

export default router;
