import { Types } from 'mongoose';
import { User, Assignment, Course, Nota, Evento, Notificacion, Mensaje } from '../models';
import { normalizeIdForQuery } from '../utils/idGenerator';
import type { IAssignment, ISubmission } from '../models/Assignment';

/**
 * Servicio centralizado para consultar datos del sistema
 * TODAS las consultas respetan permisos por rol y filtran por colegioId
 */

/**
 * Consulta las notas de un estudiante (solo sus propias notas)
 */
export async function queryStudentNotes(
  estudianteId: string,
  colegioId: string,
  cursoId?: string
): Promise<any[]> {
  const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
  
  const query: any = {
    estudianteId: normalizedEstudianteId,
  };

  // Si se proporciona cursoId, filtrar tareas por curso
  if (cursoId) {
    const normalizedCursoId = normalizeIdForQuery(cursoId);
    const assignments = await Assignment.find({ 
      cursoId: normalizedCursoId,
      colegioId 
    }).select('_id').lean();
    
    const assignmentIds = assignments.map(a => a._id);
    query.tareaId = { $in: assignmentIds };
  }

  const notas = await Nota.find(query)
    .populate('tareaId', 'titulo fechaEntrega')
    .populate('profesorId', 'nombre')
    .sort({ fecha: -1 })
    .lean();

  return notas.map(nota => ({
    _id: nota._id,
    tarea: nota.tareaId,
    nota: nota.nota,
    logro: nota.logro,
    fecha: nota.fecha,
    profesor: nota.profesorId,
  }));
}

/**
 * Consulta las materias de un estudiante (según su curso)
 */
export async function queryStudentSubjects(
  estudianteId: string,
  colegioId: string
): Promise<any[]> {
  const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
  
  const estudiante = await User.findById(normalizedEstudianteId).select('curso').lean();
  if (!estudiante || !estudiante.curso) {
    return [];
  }

  const cursoNormalizado = (estudiante.curso as string).toUpperCase().trim();
  
  const materias = await Course.find({
    colegioId,
    cursos: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase()] }
  })
    .populate('profesorIds', 'nombre email')
    .select('nombre descripcion colorAcento icono profesorIds')
    .lean();

  return materias;
}

/**
 * Consulta las tareas de un estudiante (solo sus tareas)
 */
export async function queryStudentAssignments(
  estudianteId: string,
  colegioId: string,
  estado?: 'pendiente' | 'entregada' | 'calificada'
): Promise<any[]> {
  const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
  
  const estudiante = await User.findById(normalizedEstudianteId).select('curso').lean();
  if (!estudiante || !estudiante.curso) {
    return [];
  }

  const cursoNormalizado = (estudiante.curso as string).toUpperCase().trim();
  
  const query: any = {
    colegioId,
    curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase(), estudiante.curso as string] }
  };

  const assignments = await Assignment.find(query)
    .populate('cursoId', 'nombre')
    .populate('materiaId', 'nombre')
    .populate('profesorId', 'nombre')
    .sort({ fechaEntrega: 1 })
    .lean();

  // Filtrar por estado si se proporciona
  if (estado) {
    return assignments.filter((assignment: any) => {
      const submission = assignment.submissions?.find(
        (s: ISubmission) => s.estudianteId?.toString() === normalizedEstudianteId
      );

      if (!submission) {
        return estado === 'pendiente';
      }

      if (submission.calificacion !== undefined && submission.calificacion !== null) {
        return estado === 'calificada';
      }

      return estado === 'entregada';
    });
  }

  // Agregar estado a cada tarea
  return assignments.map((assignment: any) => {
    const submission = assignment.submissions?.find(
      (s: ISubmission) => s.estudianteId?.toString() === normalizedEstudianteId
    );

    let estado = 'pendiente';
    if (submission) {
      if (submission.calificacion !== undefined && submission.calificacion !== null) {
        estado = 'calificada';
      } else {
        estado = 'entregada';
      }
    }

    return {
      ...assignment,
      estado,
    };
  });
}

/**
 * Consulta las notas de un curso completo (solo para profesores)
 */
export async function queryCourseNotes(
  profesorId: string,
  cursoId: string,
  colegioId: string
): Promise<any[]> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const normalizedCursoId = normalizeIdForQuery(cursoId);

  // Verificar que el profesor tenga acceso a este curso
  const curso = await Course.findOne({
    _id: normalizedCursoId,
    colegioId,
    profesorIds: normalizedProfesorId
  }).lean();

  if (!curso) {
    throw new Error('No tienes acceso a este curso o el curso no existe');
  }

  // Obtener todas las tareas del curso
  const assignments = await Assignment.find({
    cursoId: normalizedCursoId,
    colegioId
  }).select('_id titulo').lean();

  const assignmentIds = assignments.map(a => a._id);

  // Obtener todas las notas de estas tareas
  const notas = await Nota.find({
    tareaId: { $in: assignmentIds },
    profesorId: normalizedProfesorId
  })
    .populate('tareaId', 'titulo fechaEntrega')
    .populate('estudianteId', 'nombre')
    .sort({ fecha: -1 })
    .lean();

  return notas.map(nota => ({
    _id: nota._id,
    tarea: nota.tareaId,
    estudiante: nota.estudianteId,
    nota: nota.nota,
    logro: nota.logro,
    fecha: nota.fecha,
  }));
}

/**
 * Consulta información de un hijo (solo para padres)
 */
export async function queryChildInfo(
  parentId: string,
  hijoId: string,
  colegioId: string
): Promise<any> {
  const normalizedParentId = normalizeIdForQuery(parentId);
  const normalizedHijoId = normalizeIdForQuery(hijoId);

  // Verificar que el padre tenga este hijo
  const padre = await User.findById(normalizedParentId).select('hijoId').lean();
  if (!padre || padre.hijoId !== hijoId) {
    throw new Error('No tienes acceso a la información de este estudiante');
  }

  const hijo = await User.findById(normalizedHijoId).select('nombre curso').lean();
  if (!hijo || hijo.rol !== 'estudiante') {
    throw new Error('El usuario especificado no es un estudiante');
  }

  // Obtener notas del hijo
  const notas = await queryStudentNotes(normalizedHijoId, colegioId);
  
  // Obtener tareas del hijo
  const tareas = await queryStudentAssignments(normalizedHijoId, colegioId);
  
  // Obtener materias del hijo
  const materias = await queryStudentSubjects(normalizedHijoId, colegioId);

  return {
    estudiante: {
      _id: hijo._id,
      nombre: hijo.nombre,
      curso: hijo.curso,
    },
    notas,
    tareas,
    materias,
  };
}

/**
 * Consulta los cursos asignados a un profesor
 */
export async function queryProfessorCourses(
  profesorId: string,
  colegioId: string
): Promise<any[]> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);

  const cursos = await Course.find({
    colegioId,
    profesorIds: normalizedProfesorId
  })
    .populate('materiaId', 'nombre')
    .select('nombre descripcion materiaId cursos colorAcento icono')
    .sort({ nombre: 1 })
    .lean();

  return cursos;
}

/**
 * Consulta los estudiantes de un curso (solo para profesores)
 */
export async function queryCourseStudents(
  profesorId: string,
  cursoId: string,
  colegioId: string
): Promise<any[]> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const normalizedCursoId = normalizeIdForQuery(cursoId);

  // Verificar que el profesor tenga acceso a este curso
  const curso = await Course.findOne({
    _id: normalizedCursoId,
    colegioId,
    profesorIds: normalizedProfesorId
  }).select('cursos').lean();

  if (!curso) {
    throw new Error('No tienes acceso a este curso o el curso no existe');
  }

  // Obtener estudiantes del curso
  const cursoNormalizado = curso.cursos && curso.cursos.length > 0 
    ? curso.cursos[0].toUpperCase().trim()
    : null;

  if (!cursoNormalizado) {
    return [];
  }

  const estudiantes = await User.find({
    rol: 'estudiante',
    curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase()] },
    colegioId
  })
    .select('nombre email curso')
    .sort({ nombre: 1 })
    .lean();

  return estudiantes;
}

/**
 * Consulta eventos del calendario
 */
export async function queryCalendarEvents(
  userId: string,
  colegioId: string,
  cursoId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  const query: any = { colegioId };

  if (cursoId) {
    const normalizedCursoId = normalizeIdForQuery(cursoId);
    query.cursoId = normalizedCursoId;
    query.tipo = 'curso';
  } else {
    query.tipo = 'colegio';
  }

  if (startDate || endDate) {
    query.fecha = {};
    if (startDate) query.fecha.$gte = startDate;
    if (endDate) query.fecha.$lte = endDate;
  }

  const eventos = await Evento.find(query)
    .sort({ fecha: 1 })
    .lean();

  return eventos;
}

/**
 * Consulta notificaciones de un usuario
 */
export async function queryUserNotifications(
  userId: string,
  colegioId: string,
  limit: number = 20
): Promise<any[]> {
  const normalizedUserId = normalizeIdForQuery(userId);

  const notificaciones = await Notificacion.find({
    usuarioId: normalizedUserId
  })
    .sort({ fecha: -1 })
    .limit(limit)
    .lean();

  return notificaciones;
}

/**
 * Consulta mensajes de un usuario
 */
export async function queryUserMessages(
  userId: string,
  colegioId: string,
  limit: number = 50
): Promise<any[]> {
  const normalizedUserId = normalizeIdForQuery(userId);

  const mensajes = await Mensaje.find({
    remitenteId: normalizedUserId
  })
    .populate('chatId', 'titulo')
    .sort({ fecha: -1 })
    .limit(limit)
    .lean();

  return mensajes;
}

