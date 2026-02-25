import express from 'express';
import { Assignment, User, Course, Nota, Materia } from '../models';
import type { IAssignment, ISubmission } from '../models/Assignment';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';
import { createAssignment as createAssignmentService } from '../services/assignmentService';

const router = express.Router();

// Helper function para calcular el estado de una tarea
export function calculateAssignmentState(
  assignment: IAssignment | any,
  estudianteId?: string
): 'pendiente' | 'entregada' | 'calificada' {
  // Si se proporciona estudianteId, calcular desde perspectiva del estudiante
  if (estudianteId) {
    const submission = assignment.submissions?.find(
      (s: ISubmission | any) => s.estudianteId?.toString() === estudianteId
    );

    if (!submission) {
      return 'pendiente';
    }

    if (submission.calificacion !== undefined && submission.calificacion !== null) {
      return 'calificada';
    }

    return 'entregada';
  }

  // Si no hay estudianteId, calcular estado general (para profesor)
  if (!assignment.submissions || assignment.submissions.length === 0) {
    return 'pendiente';
  }

  // Si todas las submissions tienen calificación, está calificada
  const allGraded = assignment.submissions.every(
    (s: ISubmission | any) => s.calificacion !== undefined && s.calificacion !== null
  );

  if (allGraded) {
    return 'calificada';
  }

  // Si hay al menos una submission sin calificar, está entregada
  return 'entregada';
}

// DEBUG: Ver todas las tareas
router.get('/debug/all', async (req, res) => {
  try {
    const all = await Assignment.find({}).lean();
    console.log('DEBUG: Total assignments in DB:', all.length);
    return res.json({
      total: all.length,
      assignments: all.map((a: any) => ({
        _id: a._id,
        titulo: a.titulo,
        profesorId: a.profesorId,
        profesorIdType: typeof a.profesorId,
        profesorIdStr: String(a.profesorId),
        curso: a.curso,
        fechaEntrega: a.fechaEntrega
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DEBUG: Test profesor query directly
router.get('/debug/profesor/:profesorId/:mes/:year', async (req, res) => {
  try {
    const { profesorId, mes, year } = req.params;
    const mesNum = parseInt(mes);
    const yearNum = parseInt(year);

    const primerDia = new Date(yearNum, mesNum - 1, 1);
    const ultimoDia = new Date(yearNum, mesNum, 0, 23, 59, 59);

    console.log(`DEBUG profesor: ${profesorId}, mes=${mes}, year=${year}`);
    console.log(`Date range: ${primerDia.toISOString()} to ${ultimoDia.toISOString()}`);

    const assignments = await Assignment.find({
      profesorId: profesorId,
      fechaEntrega: { $gte: primerDia, $lte: ultimoDia }
    }).lean();

    console.log(`Found ${assignments.length} assignments`);

    return res.json({
      profesorId,
      mes: mesNum,
      year: yearNum,
      dateRange: { start: primerDia.toISOString(), end: ultimoDia.toISOString() },
      total: assignments.length,
      assignments: assignments.map((a: any) => ({
        _id: a._id,
        titulo: a.titulo,
        profesorId: String(a.profesorId),
        fechaEntrega: a.fechaEntrega
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/assignments - Crear nueva tarea (solo profesores)
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { titulo, descripcion, contenidoDocumento, curso, courseId, fechaEntrega, adjuntos, logroCalificacionId } = req.body;

    if (!titulo || !descripcion || !curso || !fechaEntrega) {
      return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(req.userId || '');

    // Verificar que el usuario es profesor
    const user = await User.findById(normalizedUserId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (user.rol !== 'profesor') {
      return res.status(403).json({ message: 'Solo los profesores pueden crear tareas.' });
    }

    // Validación de seguridad crítica
    if (!courseId) {
      return res.status(400).json({ message: 'El courseId es obligatorio.' });
    }

    // Usar el servicio reutilizable para crear la tarea
    const result = await createAssignmentService({
      titulo,
      descripcion,
      contenidoDocumento,
      curso,
      courseId,
      fechaEntrega,
      adjuntos: adjuntos || [],
      profesorId: normalizedUserId,
      colegioId: user.colegioId,
      logroCalificacionId: logroCalificacionId || undefined,
    });

    if (!result.success) {
      const statusCode = result.error?.includes('no encontrado') ? 404 :
                        result.error?.includes('No puedes asignar') ? 403 :
                        result.error?.includes('obligatorio') ? 400 : 500;
      return res.status(statusCode).json({ message: result.error });
    }

    return res.status(201).json(result.assignment);
  } catch (err: any) {
    console.error('Error al crear tarea:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments - Obtener tareas con query params (courseId, groupId, month, year, estado)
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const { courseId, groupId, month, year, estado } = req.query;

    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(req.userId || '');

    // Obtener el usuario para filtrar por colegio
    const user = await User.findById(normalizedUserId).select('rol curso colegioId').lean();
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Construir query base
    const query: any = {
      colegioId: user.colegioId,
    };

    // Filtrar por courseId y/o groupId (pueden usarse juntos para tabla de notas)
    if (courseId) {
      query.courseId = courseId;
    }
    if (groupId) {
      const grupoIdNormalizado = (groupId as string).toUpperCase().trim();
      query.curso = { $in: [grupoIdNormalizado, grupoIdNormalizado.toLowerCase(), groupId as string] };
    }

    // Filtrar por mes y año si se proporcionan (opcional - sin ellos se traen todas las tareas)
    if (month && year) {
      const mesNum = parseInt(month as string);
      const yearNum = parseInt(year as string);
      const primerDia = new Date(yearNum, mesNum - 1, 1);
      const ultimoDia = new Date(yearNum, mesNum, 0, 23, 59, 59);

      query.fechaEntrega = {
        $gte: primerDia,
        $lte: ultimoDia,
      };
    }

    // Si es estudiante, también filtrar por su curso (normalizado)
    if (user.rol === 'estudiante' && user.curso) {
      const cursoNormalizado = (user.curso as string).toUpperCase().trim();
      // Si ya hay una condición de curso, combinarla con $and
      if (query.curso) {
        const cursoCondition = query.curso;
        query.$and = [
          { curso: cursoCondition },
          { curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase(), user.curso as string] } }
        ];
        delete query.curso;
      } else {
        query.curso = { $in: [cursoNormalizado, cursoNormalizado.toLowerCase(), user.curso as string] };
      }
    }

    // Si es profesor, solo ver las tareas que él creó (su materia): no ver tareas de otros profesores del mismo curso
    if (user.rol === 'profesor') {
      query.profesorId = normalizedUserId;
    }

    // Obtener todas las tareas que coinciden con los filtros
    let assignments = await Assignment.find(query)
      .select('titulo descripcion contenidoDocumento curso courseId fechaEntrega profesorNombre profesorId submissions entregas logroCalificacionId')
      .sort({ fechaEntrega: 1 })
      .lean();

    // Filtrar por estado si se proporciona
    if (estado && (estado === 'pendiente' || estado === 'entregada' || estado === 'calificada')) {
      const estudianteIdForState = user.rol === 'estudiante' ? normalizedUserId : undefined;
      assignments = assignments.filter((assignment: any) => {
        const state = calculateAssignmentState(assignment, estudianteIdForState);
        return state === estado;
      });
    }

    // Si es estudiante, agregar estado a cada tarea
    if (user.rol === 'estudiante') {
      assignments = assignments.map((assignment: any) => {
        const state = calculateAssignmentState(assignment, normalizedUserId);
        return {
          ...assignment,
          estado: state,
        };
      });
    }

    return res.json(assignments);
  } catch (err: any) {
    console.error('Error al obtener tareas:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/assignments/:id - Editar tarea (solo el profesor que la creó)
router.put('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { titulo, descripcion, contenidoDocumento, fechaEntrega, adjuntos } = req.body;

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }

    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(req.userId || '');

    // Verificar que el usuario es el profesor que creó la tarea
    if (assignment.profesorId.toString() !== normalizedUserId) {
      return res.status(403).json({ message: 'No tienes permiso para editar esta tarea.' });
    }

    // Actualizar campos
    if (titulo) assignment.titulo = titulo;
    if (descripcion) assignment.descripcion = descripcion;
    if (contenidoDocumento !== undefined) assignment.contenidoDocumento = contenidoDocumento;
    if (fechaEntrega) assignment.fechaEntrega = new Date(fechaEntrega);
    if (adjuntos !== undefined) assignment.adjuntos = adjuntos;

    await assignment.save();

    return res.json(assignment);
  } catch (err: any) {
    console.error('Error al editar tarea:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/assignments/:id/submit - Enviar entrega de estudiante
router.post('/:id/submit', protect, async (req: AuthRequest, res) => {
  try {
    const { archivos, comentario } = req.body;

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }

    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(req.userId || '');

    // Verificar que el usuario es estudiante
    const user = await User.findById(normalizedUserId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (user.rol !== 'estudiante') {
      return res.status(403).json({ message: 'Solo los estudiantes pueden enviar entregas.' });
    }

    // Verificar que el estudiante pertenece al mismo colegio
    if (user.colegioId !== assignment.colegioId) {
      return res.status(403).json({ message: 'No tienes acceso a esta tarea.' });
    }

    // Verificar que el estudiante pertenece al curso de la tarea (case-insensitive)
    const cursoEstudiante = (user.curso as string)?.toUpperCase().trim();
    const cursoTarea = (assignment.curso as string)?.toUpperCase().trim();
    if (cursoEstudiante !== cursoTarea) {
      return res.status(403).json({ message: 'No perteneces al curso de esta tarea.' });
    }

    // Asegurar que submissions existe
    if (!assignment.submissions) {
      assignment.submissions = [];
    }

    // Verificar si ya existe una submission del estudiante
    const existingSubmissionIndex = assignment.submissions.findIndex(
      (s: ISubmission | any) => s.estudianteId?.toString() === normalizedUserId
    );

    const submission: ISubmission = {
      estudianteId: user._id,
      estudianteNombre: user.nombre,
      archivos: archivos || [],
      comentario,
      fechaEntrega: new Date(),
    };

    if (existingSubmissionIndex >= 0) {
      // Actualizar submission existente (mantener calificación y retroalimentación si existen)
      const existing = assignment.submissions[existingSubmissionIndex];
      assignment.submissions[existingSubmissionIndex] = {
        ...existing,
        ...submission,
        calificacion: existing.calificacion,
        retroalimentacion: existing.retroalimentacion,
      } as ISubmission;
    } else {
      // Nueva submission
      assignment.submissions.push(submission);
    }

    await assignment.save();

    return res.json({ message: 'Entrega enviada exitosamente.', assignment });
  } catch (err: any) {
    console.error('Error al enviar entrega:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/assignments/:id/grade - Calificar tarea (solo profesor creador)
router.put('/:id/grade', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId, calificacion, retroalimentacion, logro } = req.body;

    if (!estudianteId || calificacion === undefined) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: estudianteId y calificacion.' });
    }

    // Validar rango de nota (0-100)
    if (calificacion < 0 || calificacion > 100) {
      return res.status(400).json({ message: 'La calificación debe estar entre 0 y 100.' });
    }

    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(req.userId || '');

    // Verificar que el usuario es profesor
    const user = await User.findById(normalizedUserId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (user.rol !== 'profesor') {
      return res.status(403).json({ message: 'Solo los profesores pueden calificar tareas.' });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }

    // Validar que el profesor es el creador de la tarea
    if (assignment.profesorId.toString() !== normalizedUserId) {
      return res.status(403).json({ message: 'Solo el profesor que creó la tarea puede calificarla.' });
    }

    // Validar que el estudiante tiene una submission
    if (!assignment.submissions || assignment.submissions.length === 0) {
      return res.status(400).json({ message: 'No hay entregas para esta tarea.' });
    }

    const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
    
    // Buscar la submission del estudiante
    const submissionIndex = assignment.submissions.findIndex(
      (s: ISubmission | any) => {
        const sId = s.estudianteId?.toString();
        return sId === normalizedEstudianteId || sId === estudianteId;
      }
    );

    if (submissionIndex === -1) {
      console.error('Submission no encontrada. estudianteId recibido:', estudianteId);
      console.error('normalizedEstudianteId:', normalizedEstudianteId);
      console.error('Submissions disponibles:', assignment.submissions.map((s: any) => ({
        estudianteId: s.estudianteId?.toString(),
        estudianteNombre: s.estudianteNombre
      })));
      return res.status(404).json({ message: 'No se encontró una entrega del estudiante para esta tarea.' });
    }

    // Actualizar la submission usando findByIdAndUpdate para evitar problemas de validación
    const updateQuery: any = {
      $set: {
        [`submissions.${submissionIndex}.calificacion`]: calificacion,
      }
    };

    if (retroalimentacion) {
      updateQuery.$set[`submissions.${submissionIndex}.retroalimentacion`] = retroalimentacion;
    }

    // Usar findByIdAndUpdate con $set para actualizar solo los campos necesarios
    // runValidators: false porque estamos actualizando solo campos específicos del subdocumento
    const updateResult = await Assignment.findByIdAndUpdate(
      assignment._id,
      updateQuery,
      { new: true, runValidators: false }
    );

    if (!updateResult) {
      return res.status(404).json({ message: 'Tarea no encontrada después de actualizar.' });
    }

    // Recargar el assignment para obtener los datos actualizados con todas las relaciones
    const updatedAssignment = await Assignment.findById(req.params.id)
      .select('titulo descripcion contenidoDocumento curso courseId materiaId fechaEntrega profesorId profesorNombre adjuntos submissions entregas colegioId createdAt');
    
    if (!updatedAssignment) {
      return res.status(404).json({ message: 'Tarea no encontrada después de actualizar.' });
    }

    // Crear o actualizar nota automáticamente
    let nota;
    const existingNota = await Nota.findOne({
      tareaId: assignment._id,
      estudianteId: normalizedEstudianteId,
    });

    if (existingNota) {
      // Actualizar nota existente
      existingNota.nota = calificacion;
      if (logro) {
        existingNota.logro = logro;
      }
      existingNota.fecha = new Date();
      await existingNota.save();
      nota = existingNota;
    } else {
      // Crear nueva nota
      const newNota = new Nota({
        tareaId: assignment._id,
        estudianteId: normalizedEstudianteId,
        profesorId: assignment.profesorId,
        nota: calificacion,
        logro: logro || undefined,
        fecha: new Date(),
      });
      await newNota.save();
      nota = newNota;
    }

    return res.json({
      message: 'Tarea calificada exitosamente.',
      assignment: updatedAssignment,
      nota
    });
  } catch (err: any) {
    console.error('Error al calificar tarea:', err);
    console.error('Stack trace:', err.stack);
    return res.status(500).json({ 
      message: 'Error interno del servidor.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// GET /api/assignments/student - Obtener tareas del estudiante autenticado basado en su grupoId
router.get('/student', protect, async (req: AuthRequest, res) => {
  try {
    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId).select('rol curso colegioId').lean();
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (user.rol !== 'estudiante') {
      return res.status(403).json({ message: 'Solo los estudiantes pueden acceder a este endpoint.' });
    }

    if (!user.curso) {
      console.log('Student has no curso assigned');
      return res.json([]);
    }

    const cursoNormalizado = (user.curso as string).toUpperCase().trim();
    console.log(`Student assignments query: curso=${user.curso} (normalized: ${cursoNormalizado}), colegioId=${user.colegioId}`);

    // Buscar todas las tareas del estudiante por curso (sin filtrar por mes; el calendario filtra en cliente)
    const assignments = await Assignment.find({
      curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase(), user.curso as string] },
      colegioId: user.colegioId,
    })
      .select('titulo descripcion curso courseId materiaId fechaEntrega profesorNombre profesorId submissions')
      .populate('materiaId', 'nombre')
      .sort({ fechaEntrega: 1 })
      .lean();

    console.log(`Found ${assignments.length} assignments for student in curso ${user.curso}`);

    // Agregar estado y nombre de materia a cada tarea
    const assignmentsWithState = (assignments as any[]).map((assignment: any) => {
      const state = calculateAssignmentState(assignment, normalizedUserId);
      const materiaNombre = assignment.materiaId?.nombre ?? (assignment.materiaId ? null : null);
      const { materiaId, ...rest } = assignment;
      return {
        ...rest,
        materiaNombre: materiaNombre ?? 'Sin materia',
        estado: state,
      };
    });

    return res.json(assignmentsWithState);
  } catch (err: any) {
    console.error('Error al obtener tareas del estudiante:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/hijo/:estudianteId - Obtener tareas de un hijo (padre/directivo/admin-general-colegio)
router.get('/hijo/:estudianteId', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId).select('rol colegioId').lean();
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    const allowed = user.rol === 'directivo' || user.rol === 'admin-general-colegio';
    if (!allowed && user.rol === 'padre') {
      const { Vinculacion } = await import('../models');
      const v = await Vinculacion.findOne({
        padreId: normalizedUserId,
        estudianteId: normalizeIdForQuery(req.params.estudianteId),
        estado: 'vinculado',
      }).lean();
      if (!v) return res.status(403).json({ message: 'No autorizado a ver las tareas de este estudiante.' });
    } else if (!allowed) {
      return res.status(403).json({ message: 'Solo padre, directivo o administrador pueden acceder.' });
    }

    const estudiante = await User.findById(normalizeIdForQuery(req.params.estudianteId)).select('rol curso colegioId').lean();
    if (!estudiante || estudiante.rol !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (estudiante.colegioId !== user.colegioId) return res.status(403).json({ message: 'No autorizado.' });

    const curso = estudiante.curso as string | undefined;
    if (!curso) return res.json([]);

    const cursoNormalizado = curso.toUpperCase().trim();

    // Mismas tareas que ve el hijo (sin filtro de mes); el calendario filtra por mes en el cliente
    const assignments = await Assignment.find({
      curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase(), curso] },
      colegioId: estudiante.colegioId,
    })
      .select('titulo descripcion curso courseId materiaId fechaEntrega profesorNombre profesorId submissions')
      .populate('materiaId', 'nombre')
      .sort({ fechaEntrega: 1 })
      .lean();

    const normalizedEstudianteId = (estudiante._id ?? req.params.estudianteId).toString();
    const assignmentsWithState = (assignments as any[]).map((assignment: any) => {
      const state = calculateAssignmentState(assignment, normalizedEstudianteId);
      const materiaNombre = assignment.materiaId?.nombre ?? 'Sin materia';
      const { materiaId, ...rest } = assignment;
      return { ...rest, materiaNombre, estado: state };
    });

    return res.json(assignmentsWithState);
  } catch (err: any) {
    console.error('Error al obtener tareas del hijo:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/curso/:curso/:mes/:año - Obtener tareas de un curso en un mes específico
router.get('/curso/:curso/:mes/:año', protect, async (req: AuthRequest, res) => {
  try {
    const { curso, mes, año } = req.params;

    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId).select('colegioId rol').lean();
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const mesNum = parseInt(mes);
    const añoNum = parseInt(año);

    // Obtener primer y último día del mes
    const primerDia = new Date(añoNum, mesNum - 1, 1);
    const ultimoDia = new Date(añoNum, mesNum, 0, 23, 59, 59);

    // Normalizar curso para búsqueda case-insensitive
    const cursoNormalizado = curso.toUpperCase().trim();

    const query: any = {
      $or: [
        { curso: cursoNormalizado },
        { curso: cursoNormalizado.toLowerCase() },
        { curso: curso }
      ],
      colegioId: user.colegioId,
      fechaEntrega: {
        $gte: primerDia,
        $lte: ultimoDia,
      },
    };

    // Si es profesor, solo ver las tareas que él asignó (su materia)
    if (user.rol === 'profesor') {
      query.profesorId = normalizedUserId;
    }

    const assignments = await Assignment.find(query)
      .select('titulo descripcion curso courseId fechaEntrega profesorNombre profesorId')
      .sort({ fechaEntrega: 1 })
      .lean();

    return res.json(assignments);
  } catch (err: any) {
    console.error('Error al obtener tareas:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/profesor/:profesorId/pending-review - Tareas por calificar (estado entregada)
// Debe ir ANTES de la ruta /:mes/:year para evitar conflicto de rutas
router.get('/profesor/:profesorId/pending-review', protect, async (req: AuthRequest, res) => {
  try {
    const { profesorId } = req.params;
    const normalizedProfesorId = normalizeIdForQuery(profesorId);

    // Verificar que el usuario autenticado es el profesor solicitado
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    if (normalizedUserId !== normalizedProfesorId) {
      return res.status(403).json({ message: 'No tienes permiso para consultar estas tareas.' });
    }

    const assignments = await Assignment.find({
      profesorId: normalizedProfesorId,
    })
      .select('titulo descripcion curso courseId fechaEntrega profesorNombre profesorId submissions entregas')
      .sort({ fechaEntrega: 1 })
      .lean();

    // Filtrar solo las que tienen estado "entregada" (por calificar)
    const pendientes = assignments.filter((a: any) => {
      const state = calculateAssignmentState(a);
      return state === 'entregada';
    });

    return res.json(pendientes);
  } catch (err: any) {
    console.error('Error al obtener tareas pendientes de revisión:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/profesor/:profesorId/:mes/:year - Obtener tareas creadas por un profesor en un mes
router.get('/profesor/:profesorId/:mes/:year', protect, async (req: AuthRequest, res) => {
  try {
    const { profesorId, mes, year } = req.params;

    const mesNum = parseInt(mes);
    const yearNum = parseInt(year);

    const primerDia = new Date(yearNum, mesNum - 1, 1);
    const ultimoDia = new Date(yearNum, mesNum, 0, 23, 59, 59);

    // Normalizar profesorId (puede ser categorizado o no)
    const normalizedProfesorId = normalizeIdForQuery(profesorId);

    console.log(`GET profesor assignments: profesorId=${normalizedProfesorId}, mes=${mes}, year=${year}`);
    console.log(`Date range: ${primerDia.toISOString()} to ${ultimoDia.toISOString()}`);

    // Buscar directamente - mongoose hace la conversión automáticamente
    const assignments = await Assignment.find({
      profesorId: normalizedProfesorId,
      fechaEntrega: {
        $gte: primerDia,
        $lte: ultimoDia,
      },
    })
      .select('titulo descripcion curso courseId fechaEntrega profesorNombre profesorId')
      .sort({ fechaEntrega: 1 })
      .lean();

    console.log(`Found ${assignments.length} assignments for profesor ${profesorId}`);

    return res.json(assignments);
  } catch (err: any) {
    console.error('Error al obtener tareas del profesor:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/:id - Obtener una tarea específica
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .select('titulo descripcion contenidoDocumento curso courseId materiaId fechaEntrega profesorId profesorNombre adjuntos submissions entregas colegioId createdAt');

    if (!assignment) {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }

    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId).select('rol colegioId curso').lean();

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Verificar que el usuario pertenece al mismo colegio
    if (user.colegioId !== assignment.colegioId) {
      return res.status(403).json({ message: 'No tienes acceso a esta tarea.' });
    }

    // Si es profesor, solo puede ver tareas que él creó (su materia)
    if (user.rol === 'profesor') {
      const assignmentProfesorId = (assignment as any).profesorId?.toString?.();
      if (assignmentProfesorId !== normalizedUserId) {
        return res.status(403).json({ message: 'No tienes acceso a esta tarea. Solo puedes ver las tareas de tu materia.' });
      }
    }

    // Si es estudiante, verificar que pertenece al curso y agregar estado
    const assignmentObj: any = assignment.toObject();
    
    // Convertir adjuntos de String[] a Attachment[] si es necesario
    if (assignmentObj.adjuntos && Array.isArray(assignmentObj.adjuntos)) {
      // Si los adjuntos son strings, intentar parsearlos como JSON
      assignmentObj.adjuntos = assignmentObj.adjuntos.map((adj: any) => {
        if (typeof adj === 'string') {
          try {
            return JSON.parse(adj);
          } catch {
            // Si no es JSON válido, crear un objeto básico
            return { tipo: 'link', nombre: adj, url: adj };
          }
        }
        return adj;
      });
    }
    
    if (user.rol === 'estudiante') {
      // Verificar que el estudiante pertenece al curso de la tarea
      const cursoEstudiante = (user.curso as string)?.toUpperCase().trim();
      const cursoTarea = (assignment.curso as string)?.toUpperCase().trim();
      if (cursoEstudiante !== cursoTarea) {
        return res.status(403).json({ message: 'No perteneces al curso de esta tarea.' });
      }
      assignmentObj.estado = calculateAssignmentState(assignment, normalizedUserId);
    }

    return res.json(assignmentObj);
  } catch (err: any) {
    console.error('Error al obtener tarea:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// DELETE /api/assignments/:id - Eliminar una tarea (solo el profesor que la creó)
router.delete('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }

    // Normalizar userId
    const normalizedUserId = normalizeIdForQuery(req.userId || '');

    // Verificar que el usuario es el profesor que creó la tarea
    if (assignment.profesorId.toString() !== normalizedUserId) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar esta tarea.' });
    }

    await Assignment.findByIdAndDelete(req.params.id);

    return res.json({ message: 'Tarea eliminada exitosamente.' });
  } catch (err: any) {
    console.error('Error al eliminar tarea:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Función helper para migrar entregas antiguas a submissions
export async function migrateEntregasToSubmissions() {
  try {
    const assignments = await Assignment.find({
      $or: [
        { entregas: { $exists: true, $ne: [] } },
        { submissions: { $exists: false } }
      ]
    });

    let migrated = 0;
    for (const assignment of assignments) {
      // Si tiene entregas pero no submissions, migrar
      if (assignment.entregas && assignment.entregas.length > 0 && (!assignment.submissions || assignment.submissions.length === 0)) {
        const submissions: ISubmission[] = [];
        
        for (const entrega of assignment.entregas) {
          // Buscar el estudiante para obtener el nombre
          const estudiante = await User.findById(entrega.estudianteId);
          
          if (estudiante) {
            submissions.push({
              estudianteId: entrega.estudianteId,
              estudianteNombre: estudiante.nombre,
              archivos: entrega.archivoUrl ? [{
                tipo: 'link' as const,
                nombre: 'Archivo entregado',
                url: entrega.archivoUrl
              }] : [],
              comentario: undefined,
              fechaEntrega: entrega.fechaEntrega,
              calificacion: entrega.nota,
              retroalimentacion: undefined,
            });
          }
        }
        
        assignment.submissions = submissions;
        assignment.entregas = []; // Limpiar entregas antiguas
        await assignment.save();
        migrated++;
      }
    }
    
    console.log(`Migración completada: ${migrated} tareas migradas de entregas a submissions`);
    return { migrated, total: assignments.length };
  } catch (error: any) {
    console.error('Error en migración:', error.message);
    throw error;
  }
}

export default router;
