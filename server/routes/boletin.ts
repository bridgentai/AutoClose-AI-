import express from 'express';
import { Boletin, User, Vinculacion } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// GET /api/boletin/inteligente/:studentId - Boletín Inteligente para un estudiante
// Estructura preparada para Mongo, datos mock temporal
router.get('/inteligente/:studentId', protect, async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    // Solo profesor, directivo o admin-general pueden acceder
    const allowedRoles = ['profesor', 'directivo', 'admin-general-colegio'];
    if (!allowedRoles.includes(rol || '')) {
      return res.status(403).json({ message: 'No autorizado para ver el Boletín Inteligente.' });
    }

    // TODO: Integrar con Mongo - User, Nota, materias reales
    // Por ahora datos mock estructurados para la UI
    const mockStudent = {
      _id: studentId,
      nombre: 'Juan Pérez',
      grado: '10°',
      periodo: 'Periodo 1 - 2024',
    };

    const mockMaterias = [
      { _id: 'm1', nombre: 'Matemáticas', nota: 4.2, tendencia: 0.3, descripcionIA: 'Buen progreso en álgebra. Refuerza geometría espacial.', sparkline: [3.8, 4.0, 4.2, 4.1, 4.2] },
      { _id: 'm2', nombre: 'Español', nota: 4.5, tendencia: -0.1, descripcionIA: 'Comprensión lectora sólida. Mejorar redacción formal.', sparkline: [4.4, 4.6, 4.5, 4.5, 4.5] },
      { _id: 'm3', nombre: 'Ciencias', nota: 4.8, tendencia: 0.2, descripcionIA: 'Excelente desempeño en laboratorios. Destacado en proyectos.', sparkline: [4.5, 4.6, 4.7, 4.8, 4.8] },
      { _id: 'm4', nombre: 'Inglés', nota: 3.9, tendencia: 0.5, descripcionIA: 'Mejora notable en vocabulario. Practicar speaking.', sparkline: [3.2, 3.5, 3.7, 3.8, 3.9] },
      { _id: 'm5', nombre: 'Sociales', nota: 4.1, tendencia: 0.0, descripcionIA: 'Análisis histórico correcto. Profundizar en fuentes.', sparkline: [4.0, 4.1, 4.2, 4.0, 4.1] },
    ];

    const mockEvolucion = [
      { periodo: 'P1', matemáticas: 3.8, español: 4.4, ciencias: 4.5, inglés: 3.2, sociales: 4.0, promedio: 4.0 },
      { periodo: 'P2', matemáticas: 4.0, español: 4.6, ciencias: 4.6, inglés: 3.5, sociales: 4.1, promedio: 4.2 },
      { periodo: 'P3', matemáticas: 4.2, español: 4.5, ciencias: 4.7, inglés: 3.7, sociales: 4.2, promedio: 4.3 },
      { periodo: 'P4', matemáticas: 4.1, español: 4.5, ciencias: 4.8, inglés: 3.8, sociales: 4.0, promedio: 4.2 },
      { periodo: 'Actual', matemáticas: 4.2, español: 4.5, ciencias: 4.8, inglés: 3.9, sociales: 4.1, promedio: 4.3 },
    ];

    const mockCompetencias = {
      pensamientoCritico: 4.2,
      comunicacion: 4.0,
      trabajoEnEquipo: 4.5,
      autonomia: 4.1,
      resolucionProblemas: 4.3,
    };

    const promedioGeneral = mockMaterias.reduce((acc, m) => acc + m.nota, 0) / mockMaterias.length;
    const promedioAnterior = 4.2;
    const tendencia = promedioGeneral - promedioAnterior;
    const riesgo = promedioGeneral >= 4.0 ? 'bajo' : promedioGeneral >= 3.5 ? 'medio' : 'alto';

    return res.json({
      student: mockStudent,
      promedioGeneral: Math.round(promedioGeneral * 10) / 10,
      tendencia,
      riesgo,
      materias: mockMaterias,
      evolucion: mockEvolucion,
      competencias: mockCompetencias,
      escenarioFuturo: {
        materia: 'Matemáticas',
        mejora: 0.3,
        promedioProyectado: 4.5,
      },
      resumenIA: 'El estudiante muestra un rendimiento consistente con tendencia positiva. Las áreas de Matemáticas e Inglés requieren atención focalizada. Destaca en Ciencias y trabaja bien en equipo. Se recomienda reforzar práctica oral en Inglés y ejercicios de geometría.',
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener Boletín Inteligente.' });
  }
});

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
