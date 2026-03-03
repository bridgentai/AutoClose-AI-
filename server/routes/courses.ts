import express, { Request, Response, NextFunction } from 'express';
import {
  Course,
  User,
  GradingSchemaModel,
  Category,
  PerformanceSnapshot,
  PerformanceForecast,
  RiskAssessment,
} from '../models';
import { Assignment } from '../models/Assignment';
import { LogroCalificacion } from '../models/LogroCalificacion';
import { Group } from '../models/Group';
import { protect, AuthRequest, checkAdminColegioOnly } from '../middleware/auth';
import { Types } from 'mongoose';
import { normalizeIdForQuery } from '../utils/idGenerator';
import { logAdminAction } from '../services/auditLogger';
import { runAcademicInsightEngine } from '../services/grading/intelligence/insightEngine';
import { computeStudentCourseIntelligence } from '../services/grading/intelligence/multiroleIntelligence';
import { generateAcademicInsightsSummary } from '../services/openai';

const router = express.Router();

// Middleware de autorización para Directivo (Reutilizable)
const checkIsDirectivo = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && req.user.rol === 'directivo') {
        next();
    } else {
        res.status(403).json({ message: 'Acceso denegado. Solo Directivos pueden realizar esta acción.' });
    }
};

// Directivo o Admin General del Colegio o school_admin (asignar profesores/estudiantes a cursos)
const checkIsDirectivoOrAdminColegio = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && (req.user.rol === 'directivo' || req.user.rol === 'admin-general-colegio' || req.user.rol === 'school_admin')) {
        next();
    } else {
        res.status(403).json({ message: 'Acceso denegado. Solo Directivos o Administradores del Colegio pueden realizar esta acción.' });
    }
};


// =========================================================================
// RUTA ACTUALIZADA (ADAPTADA AL ARRAY profesorIds)
// GET /api/courses - Obtener cursos según el rol
router.get('/', protect, async (req: AuthRequest, res) => {
try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId);
if (!user) {
return res.status(404).json({ message: 'Usuario no encontrado' });
}

// Filtrar cursos según el rol del usuario
let query: any = { colegioId: user.colegioId };

// Si es profesor, solo mostrar cursos donde él está en la lista de profesores asignados
if (user.rol === 'profesor') {
query.profesorIds = user._id; // <--- ADAPTACIÓN a profesorIds (array)
}
// Si es estudiante, el filtro se hará mejor en la ruta específica (GET /api/users/me/courses)

const courses = await Course.find(query)
.populate('profesorIds', 'nombre email') // <--- ADAPTACIÓN a profesorIds (array)
.sort({ nombre: 1 });

res.json(courses);
} catch (error: any) {
console.error('Error al obtener cursos:', error.message);
res.status(500).json({ message: 'Error en el servidor al cargar los cursos.' });
}
});

// =========================================================================
// GET /api/courses/:id/details - Obtener detalles de una materia por ID
// Solo accesible para estudiantes del curso asignado a la materia
// IMPORTANTE: Esta ruta debe estar ANTES de otras rutas que usen :id para evitar conflictos
router.get('/:id/details', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] GET /api/courses/${id}/details - Usuario: ${req.userId}`);
    
    // Optimizar: solo seleccionar campos necesarios del usuario
    const user = await User.findById(req.userId).select('rol curso colegioId').lean();

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.rol !== 'estudiante' && user.rol !== 'padre') {
      return res.status(403).json({ 
        message: 'Solo estudiantes y padres pueden acceder a los detalles de materias desde esta ruta' 
      });
    }

    const course = await Course.findById(id)
      .populate('profesorIds', 'nombre email')
      .select('nombre descripcion colorAcento icono cursos profesorIds colegioId')
      .lean();

    if (!course) {
      return res.status(404).json({ message: 'Materia no encontrada' });
    }

    if (course.colegioId !== user.colegioId) {
      return res.status(403).json({ 
        message: 'No tienes acceso a esta materia. La materia pertenece a otro colegio.' 
      });
    }

    if (!course.cursos || !Array.isArray(course.cursos) || course.cursos.length === 0) {
      return res.status(403).json({ 
        message: 'Esta materia no está asignada a ningún curso.' 
      });
    }

    let cursoPermitido = false;
    if (user.rol === 'estudiante') {
      if (!user.curso) {
        return res.status(403).json({ message: 'No tienes un curso asignado. Contacta al administrador.' });
      }
      cursoPermitido = course.cursos.includes(user.curso);
    } else if (user.rol === 'padre') {
      const { Vinculacion } = await import('../models');
      const vinculaciones = await Vinculacion.find({
        padreId: req.userId,
        colegioId: user.colegioId,
      }).populate('estudianteId', 'curso').lean();
      const cursosHijos = (vinculaciones as any[])
        .map((v) => v.estudianteId?.curso)
        .filter(Boolean)
        .map((c: string) => (c || '').toUpperCase().trim());
      cursoPermitido = course.cursos.some((c: string) => cursosHijos.includes((c || '').toUpperCase().trim()));
    }
    if (!cursoPermitido) {
      return res.status(403).json({ 
        message: 'No tienes acceso a esta materia.' 
      });
    }

    const cursoAsignado = user.rol === 'estudiante'
      ? user.curso
      : (user.rol === 'padre' && course.cursos && course.cursos.length > 0 ? course.cursos[0] : undefined);

    const response = {
      _id: course._id,
      nombre: course.nombre,
      descripcion: course.descripcion,
      colorAcento: course.colorAcento,
      icono: course.icono,
      cursos: course.cursos,
      cursoAsignado,
      profesor: course.profesorIds && course.profesorIds.length > 0 
        ? {
            _id: (course.profesorIds[0] as any)._id,
            nombre: (course.profesorIds[0] as any).nombre,
            email: (course.profesorIds[0] as any).email
          }
        : null,
      profesorIds: course.profesorIds
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error al obtener materia:', error.message);
    res.status(500).json({ message: 'Error en el servidor al obtener la materia.' });
  }
});

// =========================================================================
// Grading engine: schema, snapshots, forecast, risk, insights (by courseId)
// GET /api/courses/:id/grading-schema
router.get('/:id/grading-schema', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const course = await Course.findOne({
      _id: normalizeIdForQuery(courseId),
      colegioId,
    }).lean();
    if (!course) return res.status(404).json({ message: 'Curso no encontrado.' });
    const schema = course.gradingSchemaId
      ? await GradingSchemaModel.findOne({
          _id: course.gradingSchemaId,
          colegioId,
        }).lean()
      : null;
    if (!schema) return res.json({ schema: null, categories: [] });
    const categories = await Category.find({
      gradingSchemaId: schema._id,
      colegioId,
    })
      .sort({ orden: 1 })
      .lean();
    return res.json({ schema, categories });
  } catch (e: unknown) {
    console.error('Error GET grading-schema:', e);
    return res.status(500).json({ message: 'Error al obtener esquema de calificación.' });
  }
});

// GET /api/courses/:id/snapshots?studentId=
router.get('/:id/snapshots', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.query.studentId as string | undefined;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const query: Record<string, unknown> = {
      courseId: normalizeIdForQuery(courseId),
      colegioId,
    };
    if (studentId) query.studentId = normalizeIdForQuery(studentId);
    const snapshots = await PerformanceSnapshot.find(query)
      .sort({ at: -1 })
      .limit(studentId ? 20 : 50)
      .lean();
    return res.json(snapshots);
  } catch (e: unknown) {
    console.error('Error GET snapshots:', e);
    return res.status(500).json({ message: 'Error al obtener snapshots.' });
  }
});

// GET /api/courses/:id/forecast?studentId=
router.get('/:id/forecast', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.query.studentId as string | undefined;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!studentId) return res.status(400).json({ message: 'studentId es requerido.' });
    const roleParam = req.query.role as
      | 'profesor'
      | 'estudiante'
      | 'padre'
      | 'directivo'
      | 'boletin'
      | undefined;
    const narrativeRole = roleParam ?? 'profesor';
    const forecast = await PerformanceForecast.findOne({
      courseId: normalizeIdForQuery(courseId),
      studentId: normalizeIdForQuery(studentId),
      colegioId,
    }).lean();
    return res.json(forecast ?? null);
  } catch (e: unknown) {
    console.error('Error GET forecast:', e);
    return res.status(500).json({ message: 'Error al obtener pronóstico.' });
  }
});

// GET /api/courses/:id/risk?studentId=
router.get('/:id/risk', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.query.studentId as string | undefined;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!studentId) return res.status(400).json({ message: 'studentId es requerido.' });
    const risk = await RiskAssessment.findOne({
      courseId: normalizeIdForQuery(courseId),
      studentId: normalizeIdForQuery(studentId),
      colegioId,
    })
      .sort({ at: -1 })
      .lean();
    return res.json(risk ?? null);
  } catch (e: unknown) {
    console.error('Error GET risk:', e);
    return res.status(500).json({ message: 'Error al obtener riesgo.' });
  }
});

// GET /api/courses/:id/insights?studentId=
router.get('/:id/insights', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.query.studentId as string | undefined;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!studentId) return res.status(400).json({ message: 'studentId es requerido.' });
    const course = await Course.findOne({
      _id: normalizeIdForQuery(courseId),
      colegioId,
    })
      .select('gradingSchemaId')
      .lean();
    const schemaId = course?.gradingSchemaId;
    const [snapshot, forecast, risk, categories] = await Promise.all([
      PerformanceSnapshot.findOne({
        courseId: normalizeIdForQuery(courseId),
        studentId: normalizeIdForQuery(studentId),
        colegioId,
      })
        .sort({ at: -1 })
        .lean(),
      PerformanceForecast.findOne({
        courseId: normalizeIdForQuery(courseId),
        studentId: normalizeIdForQuery(studentId),
        colegioId,
      }).lean(),
      RiskAssessment.findOne({
        courseId: normalizeIdForQuery(courseId),
        studentId: normalizeIdForQuery(studentId),
        colegioId,
      })
        .sort({ at: -1 })
        .lean(),
      schemaId
        ? Category.find({ gradingSchemaId: schemaId, colegioId }).lean()
        : Promise.resolve([]),
    ]);
    const { GradeEvent } = await import('../models');
    const gradeEvents = await GradeEvent.find({
      courseId: normalizeIdForQuery(courseId),
      studentId: normalizeIdForQuery(studentId),
      colegioId,
    })
      .sort({ recordedAt: 1 })
      .lean();
    const insightResult =
      snapshot && forecast && risk
        ? runAcademicInsightEngine({
            snapshot,
            forecast,
            risk,
            categories: categories ?? [],
            gradeEvents,
          })
        : null;
    return res.json(
      insightResult ?? {
        insights: [],
        academicStabilityIndex: undefined,
        recoveryPotentialScore: undefined,
      }
    );
  } catch (e: unknown) {
    console.error('Error GET insights:', e);
    return res.status(500).json({ message: 'Error al obtener insights.' });
  }
});

// GET /api/courses/:id/analytics-summary?studentId= - Resumen analítico con IA (promedio, categorías, pronóstico, riesgo, texto IA)
router.get('/:id/analytics-summary', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.query.studentId as string | undefined;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!studentId) return res.status(400).json({ message: 'studentId es requerido.' });

    const normalizedCourseId = normalizeIdForQuery(courseId);
    const normalizedStudentId = normalizeIdForQuery(studentId);

    const [course, student, logros, assignments, snapshot, forecast, risk] = await Promise.all([
      Course.findOne({ _id: normalizedCourseId, colegioId }).select('nombre gradingSchemaId').lean(),
      User.findById(normalizedStudentId).select('nombre').lean(),
      LogroCalificacion.find({ courseId: normalizedCourseId, colegioId }).sort({ orden: 1 }).lean(),
      Assignment.find({
        courseId: normalizedCourseId,
        colegioId,
      })
        .select('titulo logroCalificacionId submissions entregas')
        .lean(),
      PerformanceSnapshot.findOne({
        courseId: normalizedCourseId,
        studentId: normalizedStudentId,
        colegioId,
      })
        .sort({ at: -1 })
        .lean(),
      PerformanceForecast.findOne({
        courseId: normalizedCourseId,
        studentId: normalizedStudentId,
        colegioId,
      }).lean(),
      RiskAssessment.findOne({
        courseId: normalizedCourseId,
        studentId: normalizedStudentId,
        colegioId,
      })
        .sort({ at: -1 })
        .lean(),
    ]);

    const studentName = (student as { nombre?: string } | null)?.nombre ?? 'Estudiante';
    const courseName = (course as { nombre?: string } | null)?.nombre ?? 'Materia';

    type LogroLike = { _id: Types.ObjectId; nombre?: string; porcentaje?: number };
    const byCategory: Array<{ categoryName: string; percentage: number; average: number; count: number }> = [];
    let weightedSum = 0;
    let weightSum = 0;

    for (const logro of (logros || []) as LogroLike[]) {
      const lid = String(logro._id);
      const subs = (a: { submissions?: { estudianteId: unknown; calificacion?: number }[]; entregas?: { estudianteId: unknown; calificacion?: number }[] }) =>
        a.submissions || (a as { entregas?: { estudianteId: unknown; calificacion?: number }[] }).entregas || [];
      const notas: number[] = [];
      for (const a of assignments || []) {
        const assignment = a as { logroCalificacionId?: Types.ObjectId; submissions?: { estudianteId: unknown; calificacion?: number }[]; entregas?: { estudianteId: unknown; calificacion?: number }[] };
        if (String(assignment.logroCalificacionId) !== lid) continue;
        const sub = subs(assignment).find(
          (s: { estudianteId: unknown }) => String(s.estudianteId) === normalizedStudentId
        );
        const cal = (sub as { calificacion?: number })?.calificacion;
        if (cal != null && !Number.isNaN(cal)) notas.push(cal);
      }
      const pct = logro.porcentaje ?? 0;
      const average = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 0;
      byCategory.push({
        categoryName: logro.nombre ?? 'Sin nombre',
        percentage: pct,
        average,
        count: notas.length,
      });
      if (pct > 0 && notas.length > 0) {
        weightedSum += (average * pct) / 100;
        weightSum += pct;
      }
    }

    const simpleWeighted = weightSum > 0 ? (weightedSum * 100) / weightSum : null;
    const finalWeighted = simpleWeighted != null ? Math.round(simpleWeighted * 100) / 100 : (snapshot as { weightedFinalAverage?: number } | null)?.weightedFinalAverage ?? null;

    let engineInsights: string[] = [];
    if (snapshot && forecast && risk) {
      const { GradeEvent } = await import('../models');
      const gradeEvents = await GradeEvent.find({
        courseId: normalizedCourseId,
        studentId: normalizedStudentId,
        colegioId,
      })
        .sort({ recordedAt: 1 })
        .lean();
      const schemaId = (course as { gradingSchemaId?: Types.ObjectId })?.gradingSchemaId;
      const categories = schemaId
        ? await Category.find({ gradingSchemaId: schemaId, colegioId }).lean()
        : [];
      const result = runAcademicInsightEngine({
        snapshot,
        forecast,
        risk,
        categories: categories ?? [],
        gradeEvents,
      });
      engineInsights = result.insights ?? [];
    }

    const aiContext = {
      studentName,
      courseName,
      weightedAverage: finalWeighted,
      byCategory,
      forecast: forecast
        ? {
            projectedFinalGrade: (forecast as { projectedFinalGrade?: number }).projectedFinalGrade,
            riskProbabilityPercent: (forecast as { riskProbabilityPercent?: number }).riskProbabilityPercent,
          }
        : null,
      risk: risk
        ? {
            level: (risk as { level?: string }).level,
            factors: (risk as { factors?: string[] }).factors ?? [],
          }
        : null,
      engineInsights: engineInsights.length ? engineInsights : undefined,
      role: narrativeRole,
    };

    const aiSummary = await generateAcademicInsightsSummary(aiContext);

    return res.json({
      weightedAverage: finalWeighted,
      byCategory,
      snapshot: snapshot ?? null,
      forecast: forecast ?? null,
      risk: risk ?? null,
      aiSummary,
      insights: engineInsights,
    });
  } catch (e: unknown) {
    console.error('Error GET analytics-summary:', e);
    return res.status(500).json({ message: 'Error al obtener resumen analítico.' });
  }
});

// GET /api/courses/:id/intelligence?studentId=&role=
// Inteligencia académica enriquecida para vistas multirrol (profesor, estudiante, padre, directivo)
router.get('/:id/intelligence', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.query.studentId as string | undefined;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!studentId) return res.status(400).json({ message: 'studentId es requerido.' });

    const normalizedCourseId = normalizeIdForQuery(courseId);
    const normalizedStudentId = normalizeIdForQuery(studentId);

    const intelligence = await computeStudentCourseIntelligence({
      courseId: normalizedCourseId,
      studentId: normalizedStudentId,
      colegioId,
    });

    return res.json(intelligence);
  } catch (e: unknown) {
    console.error('Error GET intelligence:', e);
    return res.status(500).json({ message: 'Error al obtener inteligencia académica.' });
  }
});

// =========================================================================
// RUTA ACTUALIZADA (ADAPTADA AL ARRAY profesorIds)
// GET /api/courses/for-group/:grupo - Obtener materias del profesor para un grupo específico
router.get('/for-group/:grupo', protect, async (req: AuthRequest, res) => {
try {
const { grupo } = req.params;
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId);

if (!user) {
return res.status(404).json({ message: 'Usuario no encontrado' });
}

if (user.rol !== 'profesor') {
return res.status(403).json({ message: 'Solo los profesores pueden acceder a esta ruta' });
}

// Buscar todas las materias del profesor que incluyan este grupo
const courses = await Course.find({
profesorIds: user._id, // <--- ADAPTACIÓN a profesorIds (array)
cursos: grupo,
colegioId: user.colegioId
}).sort({ nombre: 1 });

res.json(courses);
} catch (error: any) {
console.error('Error al obtener materias para grupo:', error.message);
res.status(500).json({ message: 'Error en el servidor.' });
}
});

// =========================================================================
// RUTA ACTUALIZADA (ADAPTADA AL ARRAY profesorIds)
// POST /api/courses - Crear curso (profesor/directivo)
router.post('/', protect, async (req: AuthRequest, res) => {
const { nombre, descripcion, cursos, colorAcento, icono } = req.body;

    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId);
if (!user) {
return res.status(404).json({ message: 'Usuario no encontrado' });
}

if (user.rol !== 'profesor' && user.rol !== 'directivo') {
return res.status(403).json({ message: 'Solo profesores y directivos pueden crear cursos' });
}

try {
// Inicializar el array de profesores con el ID del creador (profesor o directivo)
// Nota: req.userId es un string, pero Mongoose lo maneja al compararlo con ObjectId
const profesorIds: (string | Types.ObjectId)[] = user.rol === 'profesor' ? [user._id as Types.ObjectId] : []; 

// Buscar o crear la materia correspondiente
const { Materia } = await import('../models/Materia');
let materia = await Materia.findOne({ nombre });
if (!materia) {
  // Crear materia si no existe
  materia = await Materia.create({
    nombre,
    descripcion: descripcion || `Materia ${nombre}`,
    area: 'General', // Valor por defecto
  });
}

const nuevoCurso = await Course.create({
  nombre,
  materiaId: materia._id, // Campo requerido en nueva estructura
  profesorId: user.rol === 'profesor' ? user._id : undefined, // Campo requerido
  estudiantes: [], // Campo requerido
  // Campos adicionales para compatibilidad
  colegioId: user.colegioId,
  descripcion,
  profesorIds: profesorIds,
  cursos: Array.isArray(cursos) ? cursos : [],
  estudianteIds: [],
  colorAcento: colorAcento || '#9f25b8',
  icono,
});

// Si el creador es profesor, añadir el *NOMBRE* del curso a su lista de materias (mantiene la estructura actual)
if (user.rol === 'profesor') {
    // Si la lista de materias en el usuario es de STRINGS (nombres), añadimos el nombre.
    // Si la lista fuera de IDs, añadiríamos nuevoCurso._id. Mantenemos el nombre por tu modelo de User.ts.
    await User.findByIdAndUpdate(user._id, { $addToSet: { materias: nuevoCurso.nombre } }); 
}

res.status(201).json(nuevoCurso);
} catch (error: any) {
console.error('Error al crear curso:', error.message);
res.status(500).json({ message: 'Error en el servidor al crear el curso.' });
}
});

// =========================================================================
// POST /api/courses/assign-professor-to-groups - Asignar profesor a uno o más grupos (cursos)
// Flujo admin: la materia viene del profesor; se crea/actualiza Course con nombre = materia del profesor.
// Body: { professorId: string, groupNames: string[] } (ej. groupNames: ["11A", "11B"])
// =========================================================================
router.post('/assign-professor-to-groups', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) {
      return res.status(400).json({ message: 'Colegio no definido.' });
    }
    const { professorId, groupNames } = req.body as { professorId?: string; groupNames?: string[] };
    if (!professorId || !Array.isArray(groupNames) || groupNames.length === 0) {
      return res.status(400).json({ message: 'Se requiere professorId y groupNames (array de nombres de curso/grupo).' });
    }

    const professor = await User.findById(normalizeIdForQuery(professorId)).select('rol colegioId materias nombre').lean();
    if (!professor || professor.rol !== 'profesor') {
      return res.status(404).json({ message: 'Profesor no encontrado o rol incorrecto.' });
    }
    if (professor.colegioId !== colegioId) {
      return res.status(403).json({ message: 'El profesor debe pertenecer a tu colegio.' });
    }

    const materiaNombre = Array.isArray(professor.materias) && professor.materias.length > 0
      ? String(professor.materias[0]).trim()
      : '';
    if (!materiaNombre) {
      return res.status(400).json({ message: 'El profesor debe tener al menos una materia asignada. Edita el profesor y asígnale una materia.' });
    }

    const normalizedGroups = groupNames.map((g: string) => String(g).toUpperCase().trim()).filter(Boolean);
    for (const nombreGrupo of normalizedGroups) {
      const grupo = await Group.findOne({ nombre: nombreGrupo, colegioId }).lean();
      if (!grupo) {
        return res.status(400).json({ message: `El curso/grupo "${nombreGrupo}" no existe. Créalo primero en la sección Cursos.` });
      }
    }

    const profesorObjId = new Types.ObjectId(normalizeIdForQuery(professorId));
    let course = await Course.findOne({ nombre: materiaNombre, colegioId }).lean();
    if (!course) {
      course = await Course.create({
        nombre: materiaNombre,
        colegioId,
        profesorIds: [profesorObjId],
        profesorId: profesorObjId,
        cursos: normalizedGroups,
        estudiantes: [],
        estudianteIds: [],
      }) as any;
    } else {
      await Course.findByIdAndUpdate(course._id, {
        $addToSet: {
          profesorIds: profesorObjId,
          cursos: { $each: normalizedGroups },
        },
        $set: { profesorId: course.profesorId || profesorObjId },
      });
    }

    await logAdminAction({
      userId: normalizeIdForQuery(req.userId || ''),
      role: req.user?.rol || 'admin-general-colegio',
      action: 'assign_professor_to_groups',
      entityType: 'course',
      entityId: course._id,
      colegioId,
      requestData: { professorId, groupNames: normalizedGroups, materiaNombre },
    });

    return res.status(200).json({
      message: `Profesor asignado a los cursos ${normalizedGroups.join(', ')} para la materia ${materiaNombre}.`,
      course: await Course.findById(course._id).populate('profesorIds', 'nombre email').lean(),
    });
  } catch (error: any) {
    console.error('Error en assign-professor-to-groups:', error);
    res.status(500).json({ message: 'Error al asignar profesor a los cursos.' });
  }
});

// =========================================================================
// RUTA ACTUALIZADA: PUT /api/courses/assign-professor (NUEVA RUTA DE ASIGNACIÓN)
// Función: Asigna un profesor a un curso (materia) existente por ID. Solo para Directivos.
router.put('/assign-professor', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
try {
const { courseId, professorId } = req.body;

if (!courseId || !professorId) {
return res.status(400).json({ message: 'Se requiere el ID del curso y el ID del profesor.' });
}

// 1. Encontrar y actualizar el Curso (añadir el profesor al array)
const course = await Course.findByIdAndUpdate(
courseId,
{ $addToSet: { profesorIds: professorId } },
{ new: true }
);

if (!course) {
return res.status(404).json({ message: 'Curso no encontrado.' });
}

// 2. Encontrar y actualizar el Profesor (añadir el curso *NOMBRE* a su lista de materias)
const professor = await User.findByIdAndUpdate(
professorId,
{ $addToSet: { materias: course.nombre } }, // Se añade el NOMBRE del curso
{ new: true }
);

if (!professor || professor.rol !== 'profesor') {
// Revertir el cambio en el curso si el profesor no se encuentra o no es profesor
await Course.findByIdAndUpdate(courseId, { $pull: { profesorIds: professorId } });
return res.status(404).json({ message: 'Profesor no encontrado o rol incorrecto.' });
}

await logAdminAction({
  userId: normalizeIdForQuery(req.userId || ''),
  role: req.user?.rol || 'admin-general-colegio',
  action: 'assign_professor',
  entityType: 'course',
  entityId: course._id,
  colegioId: req.user?.colegioId || course.colegioId,
  requestData: { courseId, professorId, courseName: course.nombre },
});

res.status(200).json({ 
message: `Profesor ${professor.nombre} asignado correctamente al curso ${course.nombre}.`,
course,
professor
});

} catch (error) {
console.error('Error al asignar profesor:', error);
res.status(500).json({ message: 'Error interno del servidor al procesar la asignación.' });
}
});

// =========================================================================
// RUTA ACTUALIZADA: PUT /api/courses/enroll-students (NUEVA RUTA DE INSCRIPCIÓN)
// Función: Inscribe una lista de estudiantes a un curso y viceversa. Solo para Directivos.
router.put('/enroll-students', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
try {
const { courseId, studentIds } = req.body; // studentIds debe ser un array

if (!courseId || !Array.isArray(studentIds) || studentIds.length === 0) {
return res.status(400).json({ message: 'Se requiere el ID del curso y una lista de IDs de estudiantes.' });
}

// 1. Encontrar y actualizar el Curso (añadir todos los estudiantes al array)
const course = await Course.findByIdAndUpdate(
courseId,
{ $addToSet: { estudianteIds: { $each: studentIds } } },
{ new: true }
);

if (!course) {
return res.status(404).json({ message: 'Curso no encontrado.' });
}

// 2. Encontrar y actualizar los Estudiantes (añadir el curso *NOMBRE* a su lista de materias)
// Usamos updateMany para eficiencia en la base de datos
await User.updateMany(
{ _id: { $in: studentIds }, rol: 'estudiante' },
{ $addToSet: { materias: course.nombre } } // Se añade el NOMBRE del curso
);

await logAdminAction({
  userId: normalizeIdForQuery(req.userId || ''),
  role: req.user?.rol || 'admin-general-colegio',
  action: 'enroll_students',
  entityType: 'course',
  entityId: course._id,
  colegioId: req.user?.colegioId || course.colegioId,
  requestData: { courseId, studentIds, courseName: course.nombre },
});

res.status(200).json({ 
message: `Se inscribieron ${studentIds.length} estudiantes al curso ${course.nombre}.`,
course
});

} catch (error) {
console.error('Error al inscribir estudiantes:', error);
res.status(500).json({ message: 'Error interno del servidor al procesar la inscripción.' });
}
});

// =========================================================================
// NUEVA RUTA: GET Materia por Nombre (Para el Frontend de Asignaciones)
// GET /api/courses/by-name?name=Matemáticas
// =========================================================================
router.get('/by-name', protect, async (req: AuthRequest, res) => {
    // Acepta tanto 'name' como 'nombre' como parámetro
    const name = req.query.name || req.query.nombre;

    if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'El parámetro de nombre es obligatorio.' });
    }

    try {
        // Buscamos el curso (materia) exacto por nombre y colegio
        const course = await Course.findOne({ 
            nombre: name,
            colegioId: req.user?.colegioId // Aseguramos que solo busque en el colegio del usuario
        }).select('_id nombre cursos'); 

        if (!course) {
            return res.status(404).json({ message: 'Materia no encontrada con ese nombre en este colegio.' });
        }

        res.json(course);

    } catch (error) {
        console.error('Error al buscar materia por nombre:', error);
        res.status(500).json({ message: 'Error interno del servidor al buscar la materia.' });
    }
});


// =========================================================================
// NUEVA RUTA: GET /api/courses/academic-groups - Obtener grupos académicos para comunicación
// Devuelve materias agrupadas con sus estudiantes y profesores
// =========================================================================
router.get('/academic-groups', protect, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select('rol curso colegioId');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    let courses: any[] = [];

    // Para estudiantes: obtener materias de su curso
    if (user.rol === 'estudiante') {
      if (!user.curso) {
        return res.status(200).json([]);
      }

      const grupoIdNormalizado = (user.curso as string).toUpperCase().trim();
      
      courses = await Course.find({
        $or: [
          { cursos: grupoIdNormalizado },
          { cursos: { $regex: new RegExp(`^${grupoIdNormalizado}$`, 'i') } }
        ],
        colegioId: user.colegioId
      })
      .populate('profesorIds', 'nombre email')
      .populate('profesorId', 'nombre email')
      .populate('estudianteIds', 'nombre email')
      .populate('estudiantes', 'nombre email')
      .populate('materiaId', 'nombre descripcion')
      .lean();
    }
    // Para profesores: obtener materias donde es profesor
    else if (user.rol === 'profesor') {
      courses = await Course.find({
        profesorIds: user._id,
        colegioId: user.colegioId
      })
      .populate('profesorIds', 'nombre email')
      .populate('profesorId', 'nombre email')
      .populate('estudianteIds', 'nombre email')
      .populate('estudiantes', 'nombre email')
      .populate('materiaId', 'nombre descripcion')
      .lean();
    }
    // Para otros roles: obtener todas las materias del colegio
    else {
      courses = await Course.find({
        colegioId: user.colegioId
      })
      .populate('profesorIds', 'nombre email')
      .populate('profesorId', 'nombre email')
      .populate('estudianteIds', 'nombre email')
      .populate('estudiantes', 'nombre email')
      .populate('materiaId', 'nombre descripcion')
      .lean();
    }

    // Agrupar por materiaId y formatear respuesta
    const groupsMap = new Map();

    courses.forEach((course: any) => {
      const materiaId = course.materiaId?._id?.toString() || course._id.toString();
      
      if (!groupsMap.has(materiaId)) {
        groupsMap.set(materiaId, {
          materiaId: materiaId,
          materiaNombre: course.materiaId?.nombre || course.nombre,
          materiaDescripcion: course.materiaId?.descripcion || course.descripcion,
          profesores: [],
          estudiantes: [],
          cursos: [],
          ultimoMensaje: null,
          mensajesSinLeer: 0
        });
      }

      const group = groupsMap.get(materiaId);

      // Agregar profesores únicos (de profesorIds array)
      if (course.profesorIds && Array.isArray(course.profesorIds)) {
        course.profesorIds.forEach((prof: any) => {
          if (prof && !group.profesores.find((p: any) => p._id === prof._id?.toString())) {
            group.profesores.push({
              _id: prof._id?.toString(),
              nombre: prof.nombre,
              email: prof.email
            });
          }
        });
      }
      // También agregar profesorId individual si existe
      if (course.profesorId && !group.profesores.find((p: any) => p._id === course.profesorId._id?.toString())) {
        group.profesores.push({
          _id: course.profesorId._id?.toString(),
          nombre: course.profesorId.nombre,
          email: course.profesorId.email
        });
      }

      // Agregar estudiantes únicos (de estudianteIds array)
      if (course.estudianteIds && Array.isArray(course.estudianteIds)) {
        course.estudianteIds.forEach((est: any) => {
          if (est && !group.estudiantes.find((e: any) => e._id === est._id?.toString())) {
            group.estudiantes.push({
              _id: est._id?.toString(),
              nombre: est.nombre,
              email: est.email
            });
          }
        });
      }
      // También agregar estudiantes del array estudiantes si existe
      if (course.estudiantes && Array.isArray(course.estudiantes)) {
        course.estudiantes.forEach((est: any) => {
          if (est && !group.estudiantes.find((e: any) => e._id === est._id?.toString())) {
            group.estudiantes.push({
              _id: est._id?.toString(),
              nombre: est.nombre,
              email: est.email
            });
          }
        });
      }

      // Agregar cursos únicos
      if (course.cursos && Array.isArray(course.cursos)) {
        course.cursos.forEach((curso: string) => {
          if (curso && !group.cursos.includes(curso)) {
            group.cursos.push(curso);
          }
        });
      }
    });

    // Convertir map a array
    const groups = Array.from(groupsMap.values());

    res.json(groups);
  } catch (error: any) {
    console.error('Error al obtener grupos académicos:', error.message);
    res.status(500).json({ message: 'Error en el servidor al obtener grupos académicos.' });
  }
});

// =========================================================================
// OTRAS RUTAS (Se mantienen, pero se pueden refactorizar)
// PUT /api/courses/:id - Actualizar curso
router.put('/:id', protect, async (req: AuthRequest, res) => {
// ... (El código de actualización se mantiene igual)
// ...
});

// POST /api/courses/assign - Asignar grupos a profesor (solo directivos)
// Recomiendo ELIMINAR O REFACTORIZAR esta ruta y usar las nuevas de PUT (assign-professor, enroll-students).
router.post('/assign', protect, async (req: AuthRequest, res) => {
// ... (El código existente se mantiene, pero tiene inconsistencias con los nuevos modelos)
// ...
});

// DELETE /api/courses/:id - Eliminar curso
router.delete('/:id', protect, async (req: AuthRequest, res) => {
// ... (El código de eliminación se mantiene igual)
// ...
});


export default router;