import express from 'express';
import { Asistencia, User, Course, Group, GroupStudent } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';
import { startOfDay, endOfDay } from 'date-fns';

const router = express.Router();

function restrictTo(...roles: string[]) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'No autorizado para esta acción.' });
    }
    next();
  };
}

// GET /api/attendance/curso/:cursoId/estudiantes - Listar estudiantes del curso (para tomar asistencia)
router.get('/curso/:cursoId/estudiantes', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const { cursoId } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const course = await Course.findById(normalizeIdForQuery(cursoId)).select('cursos estudianteIds').lean();
    if (!course) return res.status(404).json({ message: 'Curso no encontrado.' });

    let estudianteIds: unknown[] = course.estudianteIds || [];
    if (estudianteIds.length === 0 && course.cursos?.length) {
      const grupo = await Group.findOne({ nombre: (course.cursos[0] as string).toUpperCase().trim(), colegioId });
      if (grupo) {
        const gs = await GroupStudent.find({ grupoId: grupo._id, colegioId }).select('estudianteId').lean();
        estudianteIds = gs.map((g) => g.estudianteId);
      }
    }

    const students = await User.find({ _id: { $in: estudianteIds }, rol: 'estudiante' })
      .select('_id nombre correo curso')
      .sort({ nombre: 1 })
      .lean();

    return res.json(students);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar estudiantes.' });
  }
});

// GET /api/attendance/curso/:cursoId/fecha/:fecha/status - Indica si ya hay asistencia registrada
router.get('/curso/:cursoId/fecha/:fecha/status', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const { cursoId, fecha } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const dayStart = startOfDay(new Date(fecha));
    const dayEnd = endOfDay(new Date(fecha));
    const count = await Asistencia.countDocuments({
      cursoId: normalizeIdForQuery(cursoId),
      colegioId,
      fecha: { $gte: dayStart, $lte: dayEnd },
    });
    return res.json({ registrado: count > 0, total: count });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al verificar estado.' });
  }
});

// GET /api/attendance/curso/:cursoId/fecha/:fecha - Listar asistencia por curso y fecha (profesor/directivo)
router.get('/curso/:cursoId/fecha/:fecha', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const { cursoId, fecha } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const dayStart = startOfDay(new Date(fecha));
    const dayEnd = endOfDay(new Date(fecha));

    const list = await Asistencia.find({
      cursoId: normalizeIdForQuery(cursoId),
      colegioId,
      fecha: { $gte: dayStart, $lte: dayEnd },
    })
      .populate('estudianteId', 'nombre correo curso')
      .sort({ estudianteId: 1 })
      .lean();

    return res.json(list);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar asistencia.' });
  }
});

// POST /api/attendance - Registrar o actualizar asistencia (profesor/directivo)
router.post('/', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const { cursoId, estudianteId, fecha, estado } = req.body;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!cursoId || !estudianteId || !fecha || !['presente', 'ausente'].includes(estado)) {
      return res.status(400).json({ message: 'Faltan cursoId, estudianteId, fecha o estado (presente|ausente).' });
    }

    const dateOnly = startOfDay(new Date(fecha));

    const doc = await Asistencia.findOneAndUpdate(
      {
        cursoId: normalizeIdForQuery(cursoId),
        estudianteId: normalizeIdForQuery(estudianteId),
        colegioId,
        fecha: { $gte: dateOnly, $lte: endOfDay(dateOnly) },
      },
      { estado, colegioId },
      { upsert: true, new: true }
    )
      .populate('estudianteId', 'nombre correo curso')
      .lean();

    return res.json(doc);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al registrar asistencia.' });
  }
});

// POST /api/attendance/bulk - Registrar asistencia en lote por curso/fecha (profesor/directivo)
router.post('/bulk', protect, restrictTo('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const { cursoId, fecha, horaBloque, grupoId, registros } = req.body as {
      cursoId: string;
      fecha: string;
      horaBloque?: string;
      grupoId?: string;
      registros: { estudianteId: string; estado: 'presente' | 'ausente'; puntualidad?: 'on_time' | 'late' }[];
    };
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!cursoId || !fecha || !Array.isArray(registros)) {
      return res.status(400).json({ message: 'Faltan cursoId, fecha o registros.' });
    }

    const dateOnly = startOfDay(new Date(fecha));
    const ops = registros.map((r) => {
      const filter: Record<string, unknown> = {
        cursoId: normalizeIdForQuery(cursoId),
        estudianteId: normalizeIdForQuery(r.estudianteId),
        colegioId,
        fecha: { $gte: dateOnly, $lte: endOfDay(dateOnly) },
      };
      const update: Record<string, unknown> = { estado: r.estado, colegioId, recordedBy: userId };
      if (r.puntualidad) update.puntualidad = r.puntualidad;
      if (horaBloque) update.horaBloque = horaBloque;
      if (grupoId) update.grupoId = grupoId;
      return {
        updateOne: {
          filter,
          update: { $set: update },
          upsert: true,
        },
      };
    });

    const { Asistencia: AsistenciaModel } = await import('../models');
    await AsistenciaModel.bulkWrite(ops);

    const list = await Asistencia.find({
      cursoId: normalizeIdForQuery(cursoId),
      colegioId,
      fecha: { $gte: dateOnly, $lte: endOfDay(dateOnly) },
    })
      .populate('estudianteId', 'nombre correo curso')
      .sort({ estudianteId: 1 })
      .lean();

    return res.json(list);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al registrar asistencia en lote.' });
  }
});

// GET /api/attendance/estudiante/:estudianteId - Asistencia de un estudiante (padre/directivo/estudiante)
router.get('/estudiante/:estudianteId', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const normalizedEstudiante = normalizeIdForQuery(estudianteId);
    const normalizedUser = normalizeIdForQuery(userId || '');

    const canView =
      rol === 'directivo' ||
      rol === 'admin-general-colegio' ||
      normalizedUser === normalizedEstudiante ||
      (rol === 'padre' && (await canParentViewStudent(normalizedUser, normalizedEstudiante)));

    if (!canView) {
      return res.status(403).json({ message: 'No autorizado a ver esta asistencia.' });
    }

    const { desde, hasta } = req.query;
    const filter: Record<string, unknown> = { estudianteId: normalizedEstudiante, colegioId };
    if (desde) filter.fecha = { ...((filter.fecha as Record<string, Date>) || {}), $gte: new Date(desde as string) };
    if (hasta) filter.fecha = { ...((filter.fecha as Record<string, Date>) || {}), $lte: new Date(hasta as string) };
    if (desde && hasta) filter.fecha = { $gte: new Date(desde as string), $lte: new Date(hasta as string) };

    const list = await Asistencia.find(filter)
      .populate('cursoId', 'nombre')
      .sort({ fecha: -1 })
      .limit(100)
      .lean();

    const total = list.length;
    const presentes = list.filter((a) => a.estado === 'presente').length;
    const porcentaje = total ? Math.round((presentes / total) * 100) : 0;

    return res.json({ list, total, presentes, porcentaje });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener asistencia del estudiante.' });
  }
});

async function canParentViewStudent(parentId: string, studentId: string): Promise<boolean> {
  const { Vinculacion } = await import('../models');
  const v = await Vinculacion.findOne({
    padreId: parentId,
    estudianteId: studentId,
    estado: 'vinculado',
  }).lean();
  return !!v;
}

// GET /api/attendance/resumen/estudiante/:estudianteId - Porcentaje mes actual (para dashboard)
router.get('/resumen/estudiante/:estudianteId', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const normalizedEstudiante = normalizeIdForQuery(estudianteId);
    const normalizedUser = normalizeIdForQuery(userId || '');

    const canView =
      rol === 'directivo' ||
      rol === 'admin-general-colegio' ||
      normalizedUser === normalizedEstudiante ||
      (rol === 'padre' && (await canParentViewStudent(normalizedUser, normalizedEstudiante)));

    if (!canView) {
      return res.status(403).json({ message: 'No autorizado.' });
    }

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const list = await Asistencia.find({
      estudianteId: normalizedEstudiante,
      colegioId,
      fecha: { $gte: startMonth, $lte: endMonth },
    }).lean();

    const total = list.length;
    const presentes = list.filter((a) => a.estado === 'presente').length;
    const porcentaje = total ? Math.round((presentes / total) * 100) : 0;

    return res.json({ porcentaje, total, presentes });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen.' });
  }
});

export default router;
