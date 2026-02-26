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
 * Resumen de notas de todos los cursos del profesor (solo sus materias y sus estudiantes).
 * Limitado por tamaño para no saturar el contexto del chat.
 */
const NOTAS_PROFESOR_LIMIT_PER_COURSE = 50;
const NOTAS_PROFESOR_MAX_COURSES = 20;

export async function queryProfessorNotesSummary(
  profesorId: string,
  colegioId: string
): Promise<{ materiaNombre: string; grupo: string; notas: { estudianteNombre: string; tareaTitulo: string; nota: number; fecha?: string }[] }[]> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const cursos = await Course.find({
    colegioId,
    profesorIds: normalizedProfesorId,
  })
    .select('_id nombre cursos')
    .limit(NOTAS_PROFESOR_MAX_COURSES)
    .lean();

  const result: { materiaNombre: string; grupo: string; notas: { estudianteNombre: string; tareaTitulo: string; nota: number; fecha?: string }[] }[] = [];

  for (const curso of cursos) {
    const courseId = (curso as any)._id.toString();
    const notas = await queryCourseNotes(profesorId, courseId, colegioId);
    const grupo = Array.isArray((curso as any).cursos) ? (curso as any).cursos[0] : '';
    const materiaNombre = (curso as any).nombre ?? 'Materia';

    const limited = notas.slice(0, NOTAS_PROFESOR_LIMIT_PER_COURSE).map((n: any) => ({
      estudianteNombre: n.estudiante?.nombre ?? 'Estudiante',
      tareaTitulo: n.tarea?.titulo ?? 'Tarea',
      nota: n.nota ?? 0,
      fecha: n.fecha ? new Date(n.fecha).toISOString().split('T')[0] : undefined,
    }));

    if (limited.length > 0) {
      result.push({ materiaNombre, grupo: grupo || courseId, notas: limited });
    }
  }

  return result;
}

/**
 * Busca cursos del profesor que incluyan el grupo (compatible con profesorId o profesorIds y varias formas de escribir el grupo).
 */
async function findCoursesByProfessorAndGroup(
  profesorId: string,
  groupName: string,
  colegioId: string
): Promise<{ _id: any }[]> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');
  const groupVariants = [groupNorm, groupNorm.toLowerCase(), groupName.trim(), groupName.trim().toUpperCase()].filter(Boolean);
  const escaped = groupNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const groupRegex = new RegExp(`^\\s*${escaped}\\s*$`, 'i');

  const profesorCondition = /^[0-9a-fA-F]{24}$/.test(normalizedProfesorId)
    ? {
        $or: [
          { profesorIds: normalizedProfesorId },
          { profesorId: normalizedProfesorId },
          { profesorIds: new Types.ObjectId(normalizedProfesorId) },
          { profesorId: new Types.ObjectId(normalizedProfesorId) },
        ],
      }
    : {
        $or: [
          { profesorIds: normalizedProfesorId },
          { profesorId: normalizedProfesorId },
        ],
      };

  const courses = await Course.find({
    colegioId,
    $and: [
      profesorCondition,
      {
        $or: [
          { cursos: { $in: groupVariants } },
          { cursos: groupRegex },
        ],
      },
    ],
  })
    .select('_id')
    .lean();

  return courses as { _id: any }[];
}

/**
 * Obtiene un courseId para el grupo del profesor (para enlaces a notas/tareas).
 */
export async function queryCourseIdByGroupForProfessor(
  profesorId: string,
  groupName: string,
  colegioId: string
): Promise<{ courseId: string; group: string } | null> {
  const courses = await findCoursesByProfessorAndGroup(profesorId, groupName, colegioId);
  if (!courses.length) return null;
  const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');
  const courseId = courses[0]._id?.toString?.() ?? courses[0]._id;
  return courseId ? { courseId, group: groupNorm } : null;
}

/**
 * Obtiene el estudiante con mejor promedio en un grupo (solo materias del profesor).
 * Usado para respuestas estructuradas del chat (top_student_card).
 */
export async function queryTopStudentInGroup(
  profesorId: string,
  groupName: string,
  colegioId: string
): Promise<{ studentName: string; studentId: string; average: number; group: string; ranking: number; ctaRoute: string } | null> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');

  const courses = await findCoursesByProfessorAndGroup(profesorId, groupName, colegioId);
  if (!courses.length) return null;

  const courseIds = courses.map((c: any) => c._id);
  const assignments = await Assignment.find({
    cursoId: { $in: courseIds },
    colegioId,
  })
    .select('_id')
    .lean();
  const assignmentIds = assignments.map((a: any) => a._id);
  if (!assignmentIds.length) return null;

  const studentsInGroup = await User.find({
    rol: 'estudiante',
    colegioId,
    $or: [
      { curso: groupNorm },
      { curso: groupNorm.toLowerCase() },
      { curso: { $regex: new RegExp(`^${groupNorm}$`, 'i') } },
    ],
  })
    .select('_id nombre')
    .lean();
  const studentIds = studentsInGroup.map((s: any) => s._id);
  if (!studentIds.length) return null;

  const notas = await Nota.find({
    tareaId: { $in: assignmentIds },
    estudianteId: { $in: studentIds },
    profesorId: normalizedProfesorId,
  })
    .select('estudianteId nota')
    .lean();

  const sumByStudent: Record<string, { sum: number; count: number }> = {};
  for (const n of notas) {
    const id = (n as any).estudianteId?.toString?.() ?? (n as any).estudianteId;
    if (!id) continue;
    if (!sumByStudent[id]) sumByStudent[id] = { sum: 0, count: 0 };
    sumByStudent[id].sum += (n as any).nota ?? 0;
    sumByStudent[id].count += 1;
  }

  const averages = Object.entries(sumByStudent)
    .filter(([, v]) => v.count > 0)
    .map(([estudianteId, v]) => ({ estudianteId, average: v.sum / v.count }));
  if (!averages.length) return null;

  averages.sort((a, b) => b.average - a.average);
  const top = averages[0];
  const student = studentsInGroup.find((s: any) => s._id.toString() === top.estudianteId);
  const studentName = (student as any)?.nombre ?? 'Estudiante';

  const firstCourseId = courseIds[0]?.toString?.() ?? (courseIds[0] as any);
  const ctaRoute = firstCourseId ? `/profesor/cursos/${firstCourseId}/notas` : `/profesor/cursos/${groupNorm}/notas`;
  return {
    studentName,
    studentId: top.estudianteId,
    average: Math.round(top.average * 10) / 10,
    group: groupNorm,
    ranking: 1,
    ctaRoute,
  };
}

/**
 * Tareas de un grupo para el profesor (vista resumen para chat tasks_overview).
 */
export async function queryAssignmentsOverviewByGroup(
  profesorId: string,
  groupName: string,
  colegioId: string
): Promise<{ group: string; tasks: { title: string; dueDate: string; status: string }[]; ctaRoute: string } | null> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');

  const courses = await findCoursesByProfessorAndGroup(profesorId, groupName, colegioId);
  if (!courses.length) return null;

  const courseIds = courses.map((c: any) => c._id);
  const assignments = await Assignment.find({
    cursoId: { $in: courseIds },
    colegioId,
    profesorId: normalizedProfesorId,
  })
    .select('titulo fechaEntrega submissions')
    .sort({ fechaEntrega: 1 })
    .limit(20)
    .lean();

  const tasks = assignments.map((a: any) => ({
    title: a.titulo ?? 'Tarea',
    dueDate: a.fechaEntrega ? new Date(a.fechaEntrega).toISOString().split('T')[0] : '',
    status: Array.isArray(a.submissions) && a.submissions.length > 0 ? 'Entregado' : 'Pendiente',
  }));

  const firstCourseId = courseIds[0]?.toString?.() ?? (courseIds[0] as any);
  const ctaRoute = firstCourseId
    ? `/profesor/cursos/${firstCourseId}/tareas`
    : `/profesor/academia/tareas`;

  return { group: groupNorm, tasks, ctaRoute };
}

/**
 * Tendencia de notas del profesor por mes (para gráfico grade_trend_analysis).
 */
export async function queryGradeTrendForProfessor(
  profesorId: string,
  colegioId: string,
  monthsBack: number = 6
): Promise<{ period: string; average: number; count: number }[]> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);

  const docs = await Nota.aggregate([
    { $match: { profesorId: normalizedProfesorId, fecha: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$fecha' } },
        average: { $avg: '$nota' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return docs.map((d: any) => ({
    period: d._id,
    average: Math.round((d.average ?? 0) * 10) / 10,
    count: d.count ?? 0,
  }));
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

