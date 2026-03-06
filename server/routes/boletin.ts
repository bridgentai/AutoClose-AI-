import express from 'express';
import { Types } from 'mongoose';
import { Boletin, User, Vinculacion, Group, GroupStudent, Assignment, Nota, Course, LogroCalificacion } from '../models';
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

// POST /api/boletin/generar-por-curso - Crear boletines/reportes académicos para un curso completo (cada estudiante con su resumen personalizado)
// Solo directivo o admin-general-colegio. Genera un solo documento Boletin con resumen por estudiante (todas las materias).
router.post('/generar-por-curso', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (rol !== 'directivo' && rol !== 'admin-general-colegio') {
      return res.status(403).json({ message: 'Solo directivos o administradores pueden generar boletines por curso.' });
    }

    const { grupoId, grupoNombre, periodo } = req.body as { grupoId?: string; grupoNombre?: string; periodo?: string };
    const nombreOId = grupoNombre || grupoId;
    if (!nombreOId) {
      return res.status(400).json({ message: 'Indica el curso/grupo (grupoId o grupoNombre).' });
    }

    const grupoNombreNorm = (nombreOId as string).toUpperCase().trim();
    const isObjectId = /^[a-fA-F0-9]{24}$/.test((nombreOId as string).trim());
    const groupQuery: any = { colegioId };
    if (isObjectId) {
      groupQuery.$or = [
        { nombre: grupoNombreNorm },
        { nombre: (nombreOId as string).trim() },
        { _id: normalizeIdForQuery(nombreOId as string) },
      ];
    } else {
      groupQuery.$or = [
        { nombre: grupoNombreNorm },
        { nombre: (nombreOId as string).trim() },
      ];
    }
    const grupo = await Group.findOne(groupQuery).lean();
    if (!grupo) {
      return res.status(404).json({ message: 'Curso/grupo no encontrado.' });
    }

    const groupStudents = await GroupStudent.find({
      grupoId: grupo._id,
      colegioId,
    })
      .select('estudianteId')
      .lean();
    const nombreGrupoForQuery = (grupo as { nombre: string }).nombre;
    const idsFromGroupStudent = new Set(
      groupStudents
        .map((gs) => (gs as { estudianteId: Types.ObjectId }).estudianteId?.toString())
        .filter(Boolean)
    );
    // Incluir también estudiantes con User.curso = este grupo (misma lógica que GET /api/groups/:id/students)
    const usuariosConCurso = await User.find({
      rol: 'estudiante',
      colegioId,
      $or: [
        { curso: grupoNombreNorm },
        { curso: nombreGrupoForQuery },
        { curso: nombreGrupoForQuery.toLowerCase() },
      ],
    }).select('_id').lean();
    usuariosConCurso.forEach((u) => idsFromGroupStudent.add((u as any)._id.toString()));
    const estudianteIds = [...idsFromGroupStudent];
    if (estudianteIds.length === 0) {
      return res.status(400).json({ message: 'El curso no tiene estudiantes asignados.' });
    }

    const nombreGrupo = (grupo as { nombre: string }).nombre;
    const assignments = await Assignment.find({
      colegioId,
      $or: [
        { curso: grupoNombreNorm },
        { curso: nombreGrupo },
        { curso: nombreGrupo.toLowerCase() },
      ],
    })
      .select('_id courseId cursoId logroCalificacionId')
      .lean();

    const assignmentIds = assignments.map((a) => a._id);
    const assignmentToCourse: Record<string, string> = {};
    const assignmentToLogro: Record<string, string> = {};
    assignments.forEach((a: any) => {
      const cid = (a.courseId || a.cursoId)?.toString();
      if (cid) assignmentToCourse[a._id.toString()] = cid;
      const lid = (a.logroCalificacionId as Types.ObjectId)?.toString?.();
      if (lid) assignmentToLogro[a._id.toString()] = lid;
    });

    const logrosByCourse = await LogroCalificacion.find({ courseId: { $in: [...new Set(Object.values(assignmentToCourse))] }, colegioId })
      .select('_id courseId nombre porcentaje')
      .lean();
    const logroInfo: Record<string, { courseId: string; porcentaje: number }> = {};
    logrosByCourse.forEach((l: any) => {
      logroInfo[l._id.toString()] = { courseId: (l.courseId as Types.ObjectId).toString(), porcentaje: l.porcentaje ?? 0 };
    });

    const notas = await Nota.find({
      tareaId: { $in: assignmentIds },
      estudianteId: { $in: estudianteIds },
    }).lean();

    type ByCourse = { sum: number; count: number };
    type ByLogro = { sum: number; count: number };
    const byStudentCourse: Record<string, Record<string, ByCourse>> = {};
    const byStudentLogro: Record<string, Record<string, ByLogro>> = {};
    for (const n of notas) {
      const sid = (n as any).estudianteId?.toString();
      const tid = (n as any).tareaId?.toString();
      const cid = tid ? assignmentToCourse[tid] : null;
      const lid = tid ? assignmentToLogro[tid] : null;
      const notaVal = (n as any).nota ?? 0;
      if (!sid || !cid) continue;
      if (!byStudentCourse[sid]) byStudentCourse[sid] = {};
      if (!byStudentCourse[sid][cid]) byStudentCourse[sid][cid] = { sum: 0, count: 0 };
      if (lid && logroInfo[lid]) {
        if (!byStudentLogro[sid]) byStudentLogro[sid] = {};
        if (!byStudentLogro[sid][lid]) byStudentLogro[sid][lid] = { sum: 0, count: 0 };
        byStudentLogro[sid][lid].sum += notaVal;
        byStudentLogro[sid][lid].count += 1;
      } else {
        byStudentCourse[sid][cid].sum += notaVal;
        byStudentCourse[sid][cid].count += 1;
      }
    }

    let allCourseIds = [...new Set(Object.values(assignmentToCourse))];
    const coursesFromGroup = await Course.find({
      colegioId,
      $or: [
        { cursos: grupoNombreNorm },
        { cursos: nombreGrupo },
        { cursos: nombreGrupo.toLowerCase() },
      ],
    })
      .select('_id nombre')
      .lean();
    const allCourseIdsSet = new Set(allCourseIds);
    coursesFromGroup.forEach((c: any) => allCourseIdsSet.add(c._id.toString()));
    allCourseIds = [...allCourseIdsSet];

    const courses = await Course.find({ _id: { $in: allCourseIds }, colegioId }).select('_id nombre').lean();
    const courseNames: Record<string, string> = {};
    courses.forEach((c: any) => {
      courseNames[c._id.toString()] = c.nombre || 'Materia';
    });

    const students = await User.find({
      _id: { $in: estudianteIds },
      rol: 'estudiante',
    })
      .select('_id nombre')
      .lean();

    const periodoText = periodo || `Reporte ${(grupo as { nombre: string }).nombre} - ${new Date().toLocaleDateString('es')}`;

    const firstCourse = await Course.findOne({
      colegioId,
      $or: [{ cursos: grupoNombreNorm }, { cursos: (grupo as { nombre: string }).nombre }],
    })
      .select('_id')
      .lean();
    let cursoIdRef = firstCourse?._id || (courses[0] as any)?._id;
    if (!cursoIdRef) {
      const anyCourse = await Course.findOne({ colegioId }).select('_id').lean();
      cursoIdRef = anyCourse?._id;
    }
    if (!cursoIdRef) {
      return res.status(400).json({
        message: 'No hay cursos configurados en el colegio. Crea al menos una materia/curso primero.',
      });
    }

    const logrosPorCurso: Record<string, { _id: string; porcentaje: number }[]> = {};
    for (const l of logrosByCourse) {
      const cid = (l as any).courseId?.toString();
      if (!cid) continue;
      if (!logrosPorCurso[cid]) logrosPorCurso[cid] = [];
      logrosPorCurso[cid].push({ _id: (l as any)._id.toString(), porcentaje: (l as any).porcentaje ?? 0 });
    }

    const boletinIds: string[] = [];
    for (const s of students) {
      const sid = (s as any)._id.toString();
      const byCourse = byStudentCourse[sid] || {};
      const byLogro = byStudentLogro[sid] || {};
      const materias = allCourseIds.map((materiaId) => {
        let promedio = 0;
        let cantidadNotas = 0;
        const logrosMateria = logrosPorCurso[materiaId] || [];
        if (logrosMateria.length > 0) {
          let ponderado = 0;
          for (const logro of logrosMateria) {
            const data = byLogro[logro._id];
            const avg = data && data.count > 0 ? data.sum / data.count : 0;
            ponderado += avg * (logro.porcentaje / 100);
            cantidadNotas += data?.count ?? 0;
          }
          promedio = Math.round(ponderado * 100) / 100;
        } else {
          const data = byCourse[materiaId];
          promedio = data && data.count > 0 ? Math.round((data.sum / data.count) * 100) / 100 : 0;
          cantidadNotas = data?.count ?? 0;
        }
        return {
          materiaId,
          nombre: courseNames[materiaId] || 'Materia',
          promedio,
          cantidadNotas,
        };
      });
      const materiasConNotas = materias.filter((m) => m.cantidadNotas > 0);
      const promedioGeneral =
        materiasConNotas.length > 0
          ? Math.round(
              (materiasConNotas.reduce((acc, m) => acc + m.promedio, 0) / materiasConNotas.length) * 100
            ) / 100
          : 0;
      const nombreEstudiante = (s as any).nombre || 'Estudiante';
      const resumenEstudiante = [{
        estudianteId: (s as any)._id,
        nombre: nombreEstudiante,
        promedioGeneral,
        materias,
      }];

      const periodoIndividual = periodo
        ? `${periodo} - ${nombreEstudiante}`
        : `Boletín ${nombreEstudiante} - ${(grupo as { nombre: string }).nombre} - ${new Date().toLocaleDateString('es')}`;

      const boletin = await Boletin.create({
        colegioId,
        cursoId: cursoIdRef,
        periodo: periodoIndividual,
        grupoNombre: (grupo as { nombre: string }).nombre,
        grupoId: grupo._id,
        generadoPor: new Types.ObjectId(userId),
        resumen: resumenEstudiante,
      });
      boletinIds.push(boletin._id.toString());
    }

    return res.status(201).json({
      message: `Se crearon ${boletinIds.length} boletines (uno por estudiante) para el curso ${(grupo as { nombre: string }).nombre}.`,
      boletinIds,
      estudiantes: boletinIds.length,
      periodo: periodoText,
    });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('Error al generar boletines por curso:', err.message, err.stack);
    const detail = process.env.NODE_ENV !== 'production' ? err.message : undefined;
    return res.status(500).json({
      message: detail || 'Error al generar boletines por curso.',
      error: detail,
    });
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

// GET /api/boletin/:id/pdf - Versión imprimible/PDF del boletín (misma autorización que GET :id)
router.get('/:id/pdf', protect, async (req: AuthRequest, res) => {
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
    let allowed = false;
    if (rol === 'directivo' || rol === 'admin-general-colegio' || rol === 'school_admin') allowed = true;
    if (rol === 'profesor') {
      const { Course } = await import('../models/Course');
      const course = await Course.findOne({
        _id: doc.cursoId,
        profesorIds: normalizedUser,
        colegioId,
      }).lean();
      if (course) allowed = true;
    }
    if (rol === 'estudiante') {
      const hasMe = (doc.resumen || []).some(
        (r: { estudianteId?: unknown }) => (r.estudianteId as unknown as string)?.toString() === normalizedUser
      );
      if (hasMe) allowed = true;
    }
    if (rol === 'padre') {
      const vincs = await Vinculacion.find({ padreId: normalizedUser, estado: 'vinculado' }).select('estudianteId').lean();
      const allowedIds = new Set(vincs.map((v) => (v.estudianteId as unknown as string)?.toString()));
      const hasChild = (doc.resumen || []).some((r: { estudianteId?: unknown }) =>
        allowedIds.has((r.estudianteId as unknown as string)?.toString())
      );
      if (hasChild) allowed = true;
    }
    if (!allowed) return res.status(403).json({ message: 'No autorizado a ver este boletín.' });

    const periodo = doc.periodo || 'Boletín';
    const cursoNombre = (doc.cursoId as { nombre?: string })?.nombre || (doc as { grupoNombre?: string }).grupoNombre || '';
    const resumen = (doc.resumen || []) as { nombre: string; promedioGeneral: number; materias: { nombre: string; promedio: number; cantidadNotas?: number }[] }[];
    const isIndividual = resumen.length === 1;
    const fecha = new Date((doc as { fecha?: Date }).fecha || Date.now()).toLocaleDateString('es');

    let html: string;
    if (isIndividual && resumen[0]) {
      const r = resumen[0];
      const prom = r.promedioGeneral ?? 0;
      const materiasRows = (r.materias || []).map(
        (m) => {
          const nota = (m.cantidadNotas ?? 0) > 0 ? (m.promedio ?? 0).toFixed(1) : 'Sin nota';
          return `<tr><td>${m.nombre}</td><td style="text-align:center">${nota}</td></tr>`;
        }
      ).join('') + `<tr style="font-weight:bold;background:#e8f4fc"><td>Promedio general</td><td style="text-align:center">${prom.toFixed(1)}</td></tr>`;
      const fortalezas = prom >= 4 ? 'Análisis crítico, Buen desempeño general' : prom >= 3.5 ? 'Esfuerzo constante, Áreas de oportunidad' : 'Refuerzo recomendado, Seguimiento personalizado';
      const areasMejora = prom >= 4 ? 'Mantener consistencia' : 'Organización del tiempo, Práctica adicional';
      const recomendacion = prom >= 4.5 ? 'Excelente desempeño. Continúa así.' : prom >= 4 ? 'Refuerza la práctica en las materias con menor promedio.' : 'Refuerza la práctica en resolución de problemas y lectura diaria.';
      const proyeccion = prom >= 4 ? (prom + 0.2).toFixed(1) : (prom + 0.3).toFixed(1);

      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Boletín - ${r.nombre}</title>
<style>
*{box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;margin:0;padding:0;background:#fff;color:#0a2540}
.banner{background:linear-gradient(135deg,#0a2540,#1e3c72);color:#fff;padding:1rem 1.5rem;text-align:center}
.banner h1{margin:0;font-size:1.5rem;font-weight:700}
.banner .sub{margin-top:0.25rem;opacity:0.9;font-size:0.9rem}
.container{max-width:900px;margin:0 auto;padding:1.5rem}
.title{text-align:center;color:#1e3c72;font-size:1.75rem;margin:0 0 1.5rem}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.card h3{color:#00c8ff;font-size:0.9rem;margin:0 0 0.75rem;font-weight:600}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
@media(max-width:600px){.grid{grid-template-columns:1fr}}
.metric-big{font-size:2.5rem;font-weight:700;color:#00c8ff;text-align:center}
.table{width:100%;border-collapse:collapse}
.table th,.table td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}
.table th{background:#00c8ff;color:#fff;font-weight:600}
.table td:last-child{text-align:center}
.footer{margin-top:2rem;padding-top:1.5rem;border-top:1px solid #e2e8f0}
.firma{display:inline-block;width:45%;margin:0.5rem 2% 0 0;text-align:center}
.firma .line{border-bottom:1px solid #0a2540;height:2.5rem;margin-bottom:0.25rem}
.firma .name{font-weight:600;color:#1e3c72}
.firma .role{font-size:0.85rem;color:#64748b}
.wave{height:8px;background:linear-gradient(90deg,#00c8ff,#1e3c72);margin-top:2rem;border-radius:0 0 8px 8px}
.print-hint{margin-top:1rem;color:#64748b;font-size:0.85rem;text-align:center}
</style>
</head><body>
<div class="banner">
  <h1>MindOS</h1>
  <div class="sub">BOLETÍN ACADÉMICO INTELIGENTE</div>
</div>
<div class="container">
  <h2 class="title">${r.nombre} · Grado ${cursoNombre || '—'} · ${periodo}</h2>

  <div class="card" style="background:linear-gradient(135deg,#f0f9ff,#e8f4fc);border-color:#00c8ff40">
    <div class="metric-big">${prom.toFixed(1)}</div>
    <div style="text-align:center;color:#1e3c72;font-weight:600">Promedio General</div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Notas por materia</h3>
      <table class="table"><thead><tr><th>Materia</th><th>Nota</th></tr></thead><tbody>${materiasRows}</tbody></table>
    </div>
    <div class="card">
      <h3>Perfil académico</h3>
      <p style="margin:0 0 0.5rem"><strong>Fortalezas:</strong> ${fortalezas}</p>
      <p style="margin:0 0 0.5rem"><strong>Áreas de mejora:</strong> ${areasMejora}</p>
      <p style="margin:0"><strong>Índice de bienestar:</strong> <span style="color:#22c55e">●</span> Estable</p>
    </div>
    <div class="card">
      <h3>Recomendación</h3>
      <p style="margin:0;font-size:0.95rem">${recomendacion}</p>
    </div>
    <div class="card">
      <h3>Proyección</h3>
      <p style="margin:0 0 0.5rem">De mantenerse así, podría finalizar el período con un promedio:</p>
      <div class="metric-big" style="font-size:2rem">${proyeccion}</div>
    </div>
    <div class="card">
      <h3>Apoyo desde casa</h3>
      <ul style="margin:0;padding-left:1.25rem;font-size:0.95rem">
        <li>Supervisar tareas diarias</li>
        <li>Fomentar hábitos de estudio</li>
        <li>Mantener comunicación con el docente</li>
      </ul>
    </div>
    <div class="card">
      <h3>Logros del período</h3>
      <p style="margin:0;font-size:0.95rem">Participación activa en las actividades del curso.</p>
    </div>
  </div>

  <div class="footer">
    <div class="firma"><div class="line"></div><div class="name">_________________________</div><div class="role">Directora Académica</div></div>
    <div class="firma"><div class="line"></div><div class="name">_________________________</div><div class="role">Coordinador(a) de Grado</div></div>
  </div>
</div>
<div class="wave"></div>
<p class="print-hint">MindOS · Use "Imprimir" (Ctrl+P) y "Guardar como PDF" para exportar.</p>
</body></html>`;
    } else {
      const rows = resumen.map(
        (r) => `<tr><td>${r.nombre}</td><td>${(r.promedioGeneral ?? 0).toFixed(1)}</td><td>${(r.materias || []).map((m) => `${m.nombre}: ${(m.promedio ?? 0).toFixed(1)}`).join(', ')}</td></tr>`
      ).join('');
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${periodo}</title>
<style>body{font-family:system-ui,sans-serif;padding:1rem;max-width:800px;margin:0 auto} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#00c8ff;color:#fff}</style>
</head><body>
<h1>${periodo}</h1>
<p>${cursoNombre} · ${fecha}</p>
<table><thead><tr><th>Estudiante</th><th>Promedio</th><th>Materias</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin-top:2rem;color:#666;font-size:0.9rem">MindOS · Use "Imprimir" y "Guardar como PDF" para exportar.</p>
</body></html>`;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="boletin-${periodo.replace(/\s/g, '-')}.html"`);
    return res.send(html);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al generar boletín para PDF.' });
  }
});

export default router;
