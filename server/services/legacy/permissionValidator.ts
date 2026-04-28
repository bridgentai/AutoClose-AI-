import { Types } from 'mongoose';
import { User, Assignment, Course } from '../../models';
import { normalizeIdForQuery } from '../../utils/idGenerator';

/**
 * Servicio centralizado para validar permisos de acciones
 * Validaciones MUY específicas según rol y contexto
 */

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Valida si un estudiante puede consultar sus propias notas
 */
export async function canQueryOwnNotes(
  userId: string,
  targetUserId: string,
  colegioId: string
): Promise<PermissionResult> {
  const normalizedUserId = normalizeIdForQuery(userId);
  const normalizedTargetUserId = normalizeIdForQuery(targetUserId);

  // El estudiante solo puede ver sus propias notas
  if (normalizedUserId !== normalizedTargetUserId) {
    return {
      allowed: false,
      reason: 'Solo puedes consultar tus propias notas. No puedes ver notas de otros estudiantes.'
    };
  }

  const user = await User.findById(normalizedUserId).select('rol colegioId').lean();
  if (!user || user.rol !== 'estudiante') {
    return {
      allowed: false,
      reason: 'Solo los estudiantes pueden consultar sus propias notas.'
    };
  }

  // ⚠️ SEGURIDAD: super_admin tiene acceso global, no está limitado por colegioId
  // En producción, considerar logging de auditoría para accesos de super_admin
  if (user.rol !== 'super_admin' && user.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'No tienes acceso a información de otro colegio.'
    };
  }

  return { allowed: true };
}

/**
 * Valida si un profesor puede consultar notas de un curso
 */
export async function canQueryCourseNotes(
  profesorId: string,
  cursoId: string,
  colegioId: string
): Promise<PermissionResult> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const normalizedCursoId = normalizeIdForQuery(cursoId);

  const profesor = await User.findById(normalizedProfesorId).select('rol colegioId').lean();
  if (!profesor || profesor.rol !== 'profesor') {
    return {
      allowed: false,
      reason: 'Solo los profesores pueden consultar notas de cursos completos.'
    };
  }

  if (profesor.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'No tienes acceso a información de otro colegio.'
    };
  }

  // Verificar que el profesor tenga acceso a este curso
  const curso = await Course.findOne({
    _id: normalizedCursoId,
    colegioId,
    profesorIds: normalizedProfesorId
  }).lean();

  if (!curso) {
    return {
      allowed: false,
      reason: 'No tienes acceso a este curso. Solo puedes consultar notas de tus cursos asignados.'
    };
  }

  return { allowed: true };
}

/**
 * Valida si un padre puede consultar información de su hijo
 */
export async function canQueryChildInfo(
  parentId: string,
  hijoId: string,
  colegioId: string
): Promise<PermissionResult> {
  const normalizedParentId = normalizeIdForQuery(parentId);
  const normalizedHijoId = normalizeIdForQuery(hijoId);

  const padre = await User.findById(normalizedParentId).select('rol colegioId hijoId').lean();
  if (!padre || padre.rol !== 'padre') {
    return {
      allowed: false,
      reason: 'Solo los padres pueden consultar información de sus hijos.'
    };
  }

  if (padre.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'No tienes acceso a información de otro colegio.'
    };
  }

  // Verificar que el padre tenga este hijo
  if (padre.hijoId !== hijoId) {
    return {
      allowed: false,
      reason: 'Solo puedes consultar información de tu hijo. No puedes acceder a información de otros estudiantes.'
    };
  }

  const hijo = await User.findById(normalizedHijoId).select('rol colegioId').lean();
  if (!hijo || hijo.rol !== 'estudiante') {
    return {
      allowed: false,
      reason: 'El usuario especificado no es un estudiante.'
    };
  }

  if (hijo.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'El estudiante pertenece a otro colegio.'
    };
  }

  return { allowed: true };
}

/**
 * Valida si un profesor puede crear una tarea en un curso
 */
export async function canCreateAssignment(
  profesorId: string,
  cursoId: string,
  colegioId: string
): Promise<PermissionResult> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const normalizedCursoId = normalizeIdForQuery(cursoId);

  const profesor = await User.findById(normalizedProfesorId).select('rol colegioId').lean();
  if (!profesor || profesor.rol !== 'profesor') {
    return {
      allowed: false,
      reason: 'Solo los profesores pueden crear tareas.'
    };
  }

  if (profesor.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'No tienes acceso a información de otro colegio.'
    };
  }

  // Verificar que el profesor tenga acceso a este curso
  const curso = await Course.findOne({
    _id: normalizedCursoId,
    colegioId,
    profesorIds: normalizedProfesorId
  }).lean();

  if (!curso) {
    return {
      allowed: false,
      reason: 'No tienes acceso a este curso. Solo puedes crear tareas en tus cursos asignados.'
    };
  }

  return { allowed: true };
}

/**
 * Valida si un profesor puede calificar una tarea
 */
export async function canGrade(
  profesorId: string,
  assignmentId: string,
  colegioId: string
): Promise<PermissionResult> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const normalizedAssignmentId = normalizeIdForQuery(assignmentId);

  const profesor = await User.findById(normalizedProfesorId).select('rol colegioId').lean();
  if (!profesor || profesor.rol !== 'profesor') {
    return {
      allowed: false,
      reason: 'Solo los profesores pueden calificar tareas.'
    };
  }

  if (profesor.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'No tienes acceso a información de otro colegio.'
    };
  }

  // Verificar que la tarea pertenezca a un curso del profesor
  const assignment = await Assignment.findById(normalizedAssignmentId)
    .populate('cursoId')
    .lean();

  if (!assignment) {
    return {
      allowed: false,
      reason: 'La tarea no existe.'
    };
  }

  if (assignment.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'La tarea pertenece a otro colegio.'
    };
  }

  if (assignment.profesorId.toString() !== normalizedProfesorId) {
    return {
      allowed: false,
      reason: 'Solo puedes calificar tareas que hayas creado o que pertenezcan a tus cursos asignados.'
    };
  }

  return { allowed: true };
}

/**
 * Valida si un estudiante puede entregar una tarea
 */
export async function canSubmitAssignment(
  estudianteId: string,
  assignmentId: string,
  colegioId: string
): Promise<PermissionResult> {
  const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
  const normalizedAssignmentId = normalizeIdForQuery(assignmentId);

  const estudiante = await User.findById(normalizedEstudianteId).select('rol colegioId curso').lean();
  if (!estudiante || estudiante.rol !== 'estudiante') {
    return {
      allowed: false,
      reason: 'Solo los estudiantes pueden entregar tareas.'
    };
  }

  if (estudiante.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'No tienes acceso a información de otro colegio.'
    };
  }

  // Verificar que la tarea sea del curso del estudiante
  const assignment = await Assignment.findById(normalizedAssignmentId).lean();

  if (!assignment) {
    return {
      allowed: false,
      reason: 'La tarea no existe.'
    };
  }

  if (assignment.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'La tarea pertenece a otro colegio.'
    };
  }

  // Verificar que el estudiante pertenezca al curso de la tarea
  const cursoNormalizado = estudiante.curso ? (estudiante.curso as string).toUpperCase().trim() : null;
  const assignmentCurso = assignment.curso ? (assignment.curso as string).toUpperCase().trim() : null;

  if (!cursoNormalizado || !assignmentCurso || cursoNormalizado !== assignmentCurso) {
    return {
      allowed: false,
      reason: 'Solo puedes entregar tareas de tu curso.'
    };
  }

  return { allowed: true };
}

/**
 * Valida si un usuario puede enviar un comentario
 */
export async function canSendComment(
  userId: string,
  targetUserId: string,
  context: 'assignment' | 'note' | 'general',
  colegioId: string
): Promise<PermissionResult> {
  const normalizedUserId = normalizeIdForQuery(userId);
  const normalizedTargetUserId = normalizeIdForQuery(targetUserId);

  const user = await User.findById(normalizedUserId).select('rol colegioId').lean();
  if (!user) {
    return {
      allowed: false,
      reason: 'Usuario no encontrado.'
    };
  }

  // ⚠️ SEGURIDAD: super_admin tiene acceso global, no está limitado por colegioId
  // En producción, considerar logging de auditoría para accesos de super_admin
  if (user.rol !== 'super_admin' && user.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'No tienes acceso a información de otro colegio.'
    };
  }

  const targetUser = await User.findById(normalizedTargetUserId).select('rol colegioId').lean();
  if (!targetUser || targetUser.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'El usuario destino no existe o pertenece a otro colegio.'
    };
  }

  // Validaciones según contexto
  if (context === 'assignment' && user.rol === 'estudiante') {
    // Estudiante puede comentar en sus propias tareas
    if (normalizedUserId !== normalizedTargetUserId) {
      return {
        allowed: false,
        reason: 'Solo puedes comentar en tus propias tareas.'
      };
    }
  }

  if (context === 'note' && user.rol === 'estudiante') {
    return {
      allowed: false,
      reason: 'Los estudiantes no pueden enviar comentarios sobre notas.'
    };
  }

  return { allowed: true };
}

/**
 * Valida si un profesor o directivo puede crear un boletín
 */
export async function canCreateBoletin(
  userId: string,
  cursoId: string,
  colegioId: string
): Promise<PermissionResult> {
  const normalizedUserId = normalizeIdForQuery(userId);
  const normalizedCursoId = normalizeIdForQuery(cursoId);

  const user = await User.findById(normalizedUserId).select('rol colegioId').lean();
  if (!user) {
    return {
      allowed: false,
      reason: 'Usuario no encontrado.'
    };
  }

  // ⚠️ SEGURIDAD: super_admin puede crear boletines para cualquier colegio
  if (user.rol !== 'profesor' && user.rol !== 'directivo' && user.rol !== 'school_admin' && user.rol !== 'super_admin') {
    return {
      allowed: false,
      reason: 'Solo los profesores y directivos pueden crear boletines.'
    };
  }

  // ⚠️ SEGURIDAD: super_admin tiene acceso global, no está limitado por colegioId
  // En producción, considerar logging de auditoría para accesos de super_admin
  if (user.rol !== 'super_admin' && user.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'No tienes acceso a información de otro colegio.'
    };
  }

  // Si es profesor, verificar que tenga acceso al curso
  if (user.rol === 'profesor') {
    const curso = await Course.findOne({
      _id: normalizedCursoId,
      colegioId,
      profesorIds: normalizedUserId
    }).lean();

    if (!curso) {
      return {
        allowed: false,
        reason: 'Solo puedes crear boletines de tus cursos asignados.'
      };
    }
  }

  return { allowed: true };
}

/**
 * Valida si un usuario puede modificar una fecha de una tarea
 */
export async function canModifyDate(
  userId: string,
  assignmentId: string,
  colegioId: string
): Promise<PermissionResult> {
  const normalizedUserId = normalizeIdForQuery(userId);
  const normalizedAssignmentId = normalizeIdForQuery(assignmentId);

  const user = await User.findById(normalizedUserId).select('rol colegioId').lean();
  // ⚠️ SEGURIDAD: super_admin puede modificar fechas de tareas de cualquier colegio
  if (!user || (user.rol !== 'profesor' && user.rol !== 'directivo' && user.rol !== 'school_admin' && user.rol !== 'super_admin')) {
    return {
      allowed: false,
      reason: 'Solo los profesores y directivos pueden modificar fechas de tareas.'
    };
  }

  // ⚠️ SEGURIDAD: super_admin tiene acceso global, no está limitado por colegioId
  // En producción, considerar logging de auditoría para accesos de super_admin
  if (user.rol !== 'super_admin' && user.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'No tienes acceso a información de otro colegio.'
    };
  }

  const assignment = await Assignment.findById(normalizedAssignmentId).lean();

  if (!assignment) {
    return {
      allowed: false,
      reason: 'La tarea no existe.'
    };
  }

  if (assignment.colegioId !== colegioId) {
    return {
      allowed: false,
      reason: 'La tarea pertenece a otro colegio.'
    };
  }

  // Si es profesor, verificar que sea el creador de la tarea
  if (user.rol === 'profesor' && assignment.profesorId.toString() !== normalizedUserId) {
    return {
      allowed: false,
      reason: 'Solo puedes modificar fechas de tareas que hayas creado.'
    };
  }

  return { allowed: true };
}

