import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { User, Nota, Vinculacion, Asistencia } from '../models';
import { Course } from '../models/Course';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// GET /api/reports/estudiante/:id/resumen - Resumen de un estudiante (notas, asistencia). Directivo, admin, el propio estudiante o padre del estudiante.
router.get('/estudiante/:id/resumen', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = normalizeIdForQuery(req.params.id);
    const userId = normalizeIdForQuery(req.userId || '');
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const estudiante = await User.findById(estudianteId).select('nombre email curso rol colegioId').lean();
    if (!estudiante || estudiante.colegioId !== colegioId) return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (estudiante.rol !== 'estudiante') return res.status(400).json({ message: 'El usuario no es un estudiante.' });

    const canView =
      rol === 'directivo' ||
      rol === 'admin-general-colegio' ||
      rol === 'school_admin' ||
      userId === estudianteId ||
      (rol === 'padre' && (await Vinculacion.findOne({ padreId: userId, estudianteId, colegioId }).lean()));

    if (!canView) return res.status(403).json({ message: 'No autorizado a ver este resumen.' });

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const asistencias = await Asistencia.find({
      estudianteId,
      colegioId,
      fecha: { $gte: startMonth, $lte: endMonth },
    }).lean();
    const totalAsist = asistencias.length;
    const presentes = asistencias.filter((a) => a.estado === 'presente').length;
    const porcentajeAsistencia = totalAsist ? Math.round((presentes / totalAsist) * 100) : 0;

    const notas = await Nota.find({ estudianteId })
      .populate('tareaId', 'titulo courseId')
      .lean();
    const promedioGeneral =
      notas.length > 0
        ? notas.reduce((acc, n) => acc + (n.nota ?? 0), 0) / notas.length
        : null;

    return res.json({
      estudiante: {
        _id: estudiante._id,
        nombre: estudiante.nombre,
        email: estudiante.email,
        curso: estudiante.curso,
      },
      asistencia: {
        porcentaje: porcentajeAsistencia,
        total: totalAsist,
        presentes,
        mes: now.getMonth() + 1,
        anio: now.getFullYear(),
      },
      notas: {
        cantidad: notas.length,
        promedioGeneral: promedioGeneral != null ? Math.round(promedioGeneral * 10) / 10 : null,
        detalle: notas.slice(0, 20).map((n: any) => ({
          tarea: n.tareaId?.titulo,
          nota: n.nota,
          fecha: n.fecha,
        })),
      },
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen del estudiante.' });
  }
});

// GET /api/reports/cursos/resumen - Resumen por curso (estudiantes, % asistencia mes, notas). Solo directivo y admin.
router.get('/cursos/resumen', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (rol !== 'directivo' && rol !== 'admin-general-colegio' && rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo directivos y administradores pueden ver el resumen de cursos.' });
    }

    const courses = await Course.find({ colegioId })
      .select('nombre cursos estudianteIds')
      .lean();

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const resumenCursos = await Promise.all(
      courses.map(async (course) => {
        const estudianteIds = (course.estudianteIds || []).map((id: any) => id?.toString?.() || id);
        let porcentajeAsistencia = 0;
        let promedioNotas: number | null = null;

        if (estudianteIds.length > 0) {
          const asistencias = await Asistencia.find({
            estudianteId: { $in: estudianteIds },
            colegioId,
            fecha: { $gte: startMonth, $lte: endMonth },
          }).lean();
          const totalReg = asistencias.length;
          const presentes = asistencias.filter((a) => a.estado === 'presente').length;
          porcentajeAsistencia = totalReg ? Math.round((presentes / totalReg) * 100) : 0;

          const notas = await Nota.find({ estudianteId: { $in: estudianteIds } }).lean();
          if (notas.length > 0) {
            const sum = notas.reduce((acc, n) => acc + (n.nota ?? 0), 0);
            promedioNotas = Math.round((sum / notas.length) * 10) / 10;
          }
        }

        return {
          _id: course._id,
          nombre: course.nombre,
          cursos: course.cursos,
          cantidadEstudiantes: estudianteIds.length,
          asistenciaMesPorcentaje: porcentajeAsistencia,
          promedioNotas,
        };
      })
    );

    return res.json({ cursos: resumenCursos });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen de cursos.' });
  }
});

export default router;
