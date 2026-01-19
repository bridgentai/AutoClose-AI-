import { Types } from 'mongoose';
import { Assignment, Nota, Notificacion, User, Course } from '../models';
import { normalizeIdForQuery } from '../utils/idGenerator';
import * as permissionValidator from './permissionValidator';
import * as dataQuery from './dataQuery';
import * as syncService from './syncService';
import { logAIAction } from './auditLogger';
import type { ISubmission, IAttachment } from '../models/Assignment';
import { createAssignment as createAssignmentService } from './assignmentService';

/**
 * Servicio que ejecuta acciones propuestas por el AI
 * Valida permisos, ejecuta acción real, registra auditoría y dispara sincronización
 */

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * Ejecuta una acción según el nombre de la función y sus parámetros
 */
export async function executeAction(
  functionName: string,
  parameters: Record<string, any>,
  userId: string,
  role: string,
  colegioId: string
): Promise<ActionResult> {
  try {
    // Ejecutar la acción según el nombre de la función
    switch (functionName) {
      // ========== CONSULTAS ==========
      case 'consultar_notas_estudiante':
        return await executeQueryStudentNotes(parameters, userId, colegioId);
      
      case 'consultar_notas_curso':
        return await executeQueryCourseNotes(parameters, userId, colegioId);
      
      case 'consultar_materias':
        return await executeQuerySubjects(parameters, userId, role, colegioId);
      
      case 'consultar_tareas':
        return await executeQueryAssignments(parameters, userId, role, colegioId);
      
      case 'consultar_informacion_hijo':
        return await executeQueryChildInfo(parameters, userId, colegioId);
      
      case 'consultar_calendario':
        return await executeQueryCalendar(parameters, userId, colegioId);
      
      case 'consultar_notificaciones':
        return await executeQueryNotifications(parameters, userId, colegioId);
      
      case 'consultar_estudiantes_curso':
        return await executeQueryCourseStudents(parameters, userId, colegioId);

      // ========== ACCIONES ==========
      case 'asignar_tarea':
        return await executeCreateAssignment(parameters, userId, colegioId);
      
      case 'entregar_tarea':
        return await executeSubmitAssignment(parameters, userId, colegioId);
      
      case 'calificar_tarea':
        return await executeGradeAssignment(parameters, userId, colegioId);
      
      case 'subir_nota':
        return await executeCreateNote(parameters, userId, colegioId);
      
      case 'modificar_fecha_tarea':
        return await executeModifyAssignmentDate(parameters, userId, colegioId);
      
      case 'enviar_comentario':
        return await executeSendComment(parameters, userId, colegioId);
      
      case 'crear_boletin':
        return await executeCreateBoletin(parameters, userId, colegioId);

      case 'crear_permiso':
        return await executeCreatePermiso(parameters, userId, colegioId);

      default:
        return {
          success: false,
          error: `Función desconocida: ${functionName}`
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error al ejecutar la acción'
    };
  }
}

// ========== FUNCIONES DE CONSULTA ==========

async function executeQueryStudentNotes(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { estudianteId } = params;
  
  // Validar permisos
  const permission = await permissionValidator.canQueryOwnNotes(userId, estudianteId, colegioId);
  if (!permission.allowed) {
    await logAIAction({
      userId,
      role: 'estudiante',
      action: 'consultar_notas_estudiante',
      entityType: 'note',
      entityId: estudianteId,
      colegioId,
      result: 'denied',
      error: permission.reason,
      requestData: params
    });
    return { success: false, error: permission.reason };
  }

  const notas = await dataQuery.queryStudentNotes(estudianteId, colegioId);
  
  await logAIAction({
    userId,
    role: 'estudiante',
    action: 'consultar_notas_estudiante',
    entityType: 'note',
    colegioId,
    result: 'success',
    requestData: params
  });

  return {
    success: true,
    data: notas,
    message: `Se encontraron ${notas.length} notas`
  };
}

async function executeQueryCourseNotes(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { cursoId } = params;
  
  const permission = await permissionValidator.canQueryCourseNotes(userId, cursoId, colegioId);
  if (!permission.allowed) {
    await logAIAction({
      userId,
      role: 'profesor',
      action: 'consultar_notas_curso',
      entityType: 'note',
      cursoId,
      colegioId,
      result: 'denied',
      error: permission.reason,
      requestData: params
    });
    return { success: false, error: permission.reason };
  }

  const notas = await dataQuery.queryCourseNotes(userId, cursoId, colegioId);
  
  await logAIAction({
    userId,
    role: 'profesor',
    action: 'consultar_notas_curso',
    entityType: 'note',
    cursoId,
    colegioId,
    result: 'success',
    requestData: params
  });

  return {
    success: true,
    data: notas,
    message: `Se encontraron ${notas.length} notas del curso`
  };
}

async function executeQuerySubjects(
  params: any,
  userId: string,
  role: string,
  colegioId: string
): Promise<ActionResult> {
  if (role === 'estudiante') {
    const materias = await dataQuery.queryStudentSubjects(userId, colegioId);
    return {
      success: true,
      data: materias,
      message: `Tienes ${materias.length} materias asignadas`
    };
  } else if (role === 'profesor') {
    const cursos = await dataQuery.queryProfessorCourses(userId, colegioId);
    return {
      success: true,
      data: cursos,
      message: `Tienes ${cursos.length} cursos asignados`
    };
  }
  
  return { success: false, error: 'Rol no soportado para esta consulta' };
}

async function executeQueryAssignments(
  params: any,
  userId: string,
  role: string,
  colegioId: string
): Promise<ActionResult> {
  const { estado, cursoId } = params;
  
  if (role === 'estudiante') {
    const tareas = await dataQuery.queryStudentAssignments(userId, colegioId, estado);
    
    await logAIAction({
      userId,
      role: 'estudiante',
      action: 'consultar_tareas',
      entityType: 'assignment',
      colegioId,
      result: 'success',
      requestData: params
    });
    
    return {
      success: true,
      data: tareas,
      message: `Tienes ${tareas.length} tareas${estado ? ` ${estado}` : ''}`
    };
  } else if (role === 'profesor') {
    // Para profesores, consultar tareas de sus cursos
    const normalizedProfesorId = normalizeIdForQuery(userId);
    const query: any = {
      colegioId,
      profesorId: normalizedProfesorId
    };

    // Si se proporciona cursoId, filtrar por ese curso
    if (cursoId) {
      const normalizedCursoId = normalizeIdForQuery(cursoId);
      query.cursoId = normalizedCursoId;
    }

    const assignments = await Assignment.find(query)
      .populate('cursoId', 'nombre')
      .populate('materiaId', 'nombre')
      .sort({ fechaEntrega: 1 })
      .lean();

    // Filtrar por estado si se proporciona
    let tareas = assignments;
    if (estado) {
      tareas = assignments.filter((assignment: any) => {
        if (estado === 'pendiente') {
          // Pendiente: no hay submissions o todas están sin entregar
          return !assignment.submissions || assignment.submissions.length === 0;
        } else if (estado === 'entregada') {
          // Entregada: hay submissions pero no todas están calificadas
          return assignment.submissions && assignment.submissions.length > 0 && 
                 assignment.submissions.some((s: any) => (s.calificacion === undefined || s.calificacion === null));
        } else if (estado === 'calificada') {
          // Calificada: todas las submissions tienen calificación
          return assignment.submissions && assignment.submissions.length > 0 && 
                 assignment.submissions.every((s: any) => s.calificacion !== undefined && s.calificacion !== null);
        }
        return true;
      });
    }

    await logAIAction({
      userId,
      role: 'profesor',
      action: 'consultar_tareas',
      entityType: 'assignment',
      cursoId,
      colegioId,
      result: 'success',
      requestData: params
    });

    return {
      success: true,
      data: tareas,
      message: `Se encontraron ${tareas.length} tareas${estado ? ` ${estado}` : ''}`
    };
  }
  
  return { success: false, error: 'Rol no soportado para esta consulta' };
}

async function executeQueryChildInfo(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { hijoId } = params;
  
  const permission = await permissionValidator.canQueryChildInfo(userId, hijoId, colegioId);
  if (!permission.allowed) {
    await logAIAction({
      userId,
      role: 'padre',
      action: 'consultar_informacion_hijo',
      entityType: 'student',
      entityId: hijoId,
      colegioId,
      result: 'denied',
      error: permission.reason,
      requestData: params
    });
    return { success: false, error: permission.reason };
  }

  const info = await dataQuery.queryChildInfo(userId, hijoId, colegioId);
  
  await logAIAction({
    userId,
    role: 'padre',
    action: 'consultar_informacion_hijo',
    entityType: 'student',
    entityId: hijoId,
    colegioId,
    result: 'success',
    requestData: params
  });

  return {
    success: true,
    data: info,
    message: 'Información del estudiante obtenida correctamente'
  };
}

async function executeQueryCalendar(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { cursoId, startDate, endDate } = params;
  
  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;
  
  const eventos = await dataQuery.queryCalendarEvents(userId, colegioId, cursoId, start, end);
  
  return {
    success: true,
    data: eventos,
    message: `Se encontraron ${eventos.length} eventos`
  };
}

async function executeQueryNotifications(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { limit = 20 } = params;
  
  const notificaciones = await dataQuery.queryUserNotifications(userId, colegioId, limit);
  
  return {
    success: true,
    data: notificaciones,
    message: `Tienes ${notificaciones.length} notificaciones`
  };
}

async function executeQueryCourseStudents(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { cursoId } = params;
  
  const estudiantes = await dataQuery.queryCourseStudents(userId, cursoId, colegioId);
  
  return {
    success: true,
    data: estudiantes,
    message: `El curso tiene ${estudiantes.length} estudiantes`
  };
}

// ========== FUNCIONES DE ACCIÓN ==========

async function executeCreateAssignment(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { titulo, descripcion, cursoId, materiaId, grupo, fechaEntrega, adjuntos } = params;
  
  const normalizedProfesorId = normalizeIdForQuery(userId);
  let finalCursoId = cursoId;
  let grupoFinal = grupo;

  // Si se proporciona un grupo pero no cursoId, buscar el curso del profesor que incluye ese grupo
  if (grupo && !cursoId) {
    const grupoNormalizado = grupo.toUpperCase().trim();
    
    // Buscar el curso del profesor que incluye este grupo
    // Usar $in para buscar en profesorIds (array de ObjectId) y convertir el string a ObjectId
    const profesorObjectId = new Types.ObjectId(normalizedProfesorId);
    const curso = await Course.findOne({
      colegioId,
      profesorIds: profesorObjectId,
      cursos: { $in: [grupoNormalizado, grupoNormalizado.toLowerCase(), grupo] }
    }).lean();

    if (!curso) {
      await logAIAction({
        userId,
        role: 'profesor',
        action: 'asignar_tarea',
        entityType: 'assignment',
        colegioId,
        result: 'denied',
        error: `No se encontró un curso asignado que incluya el grupo ${grupo}. Verifica que el grupo esté correctamente asignado a tu materia.`,
        requestData: params
      });
      return { 
        success: false, 
        error: `No se encontró un curso asignado que incluya el grupo ${grupo}. Verifica que el grupo esté correctamente asignado a tu materia.` 
      };
    }

    finalCursoId = curso._id.toString();
    grupoFinal = grupoNormalizado;
  }

  // Validar que tenemos cursoId
  if (!finalCursoId) {
    await logAIAction({
      userId,
      role: 'profesor',
      action: 'asignar_tarea',
      entityType: 'assignment',
      colegioId,
      result: 'denied',
      error: 'Se requiere cursoId o grupo para asignar la tarea',
      requestData: params
    });
    return { 
      success: false, 
      error: 'Se requiere cursoId o grupo para asignar la tarea' 
    };
  }

  // Si no se proporcionó grupo pero sí cursoId, obtener el primer grupo del curso
  if (!grupoFinal && finalCursoId) {
    const normalizedCursoId = normalizeIdForQuery(finalCursoId);
    const course = await Course.findById(normalizedCursoId).lean();
    if (course && course.cursos && course.cursos.length > 0) {
      grupoFinal = (course.cursos[0] as string).toUpperCase().trim();
    } else {
      await logAIAction({
        userId,
        role: 'profesor',
        action: 'asignar_tarea',
        entityType: 'assignment',
        cursoId: finalCursoId,
        colegioId,
        result: 'denied',
        error: 'El curso no tiene grupos asignados',
        requestData: params
      });
      return { 
        success: false, 
        error: 'El curso no tiene grupos asignados' 
      };
    }
  }

  // Validar permisos
  const permission = await permissionValidator.canCreateAssignment(userId, finalCursoId, colegioId);
  if (!permission.allowed) {
    await logAIAction({
      userId,
      role: 'profesor',
      action: 'asignar_tarea',
      entityType: 'assignment',
      cursoId: finalCursoId,
      colegioId,
      result: 'denied',
      error: permission.reason,
      requestData: params
    });
    return { success: false, error: permission.reason };
  }

  // Usar el servicio reutilizable para crear la tarea (garantiza consistencia con POST /api/assignments)
  const result = await createAssignmentService({
    titulo,
    descripcion,
    curso: grupoFinal!,
    courseId: finalCursoId,
    fechaEntrega,
    adjuntos: adjuntos || [],
    profesorId: normalizedProfesorId,
    colegioId,
  });

  if (!result.success) {
    await logAIAction({
      userId,
      role: 'profesor',
      action: 'asignar_tarea',
      entityType: 'assignment',
      cursoId: finalCursoId,
      colegioId,
      result: 'denied',
      error: result.error || 'Error al crear la tarea',
      requestData: params
    });
    return { 
      success: false, 
      error: result.error || 'Error al crear la tarea' 
    };
  }

  await logAIAction({
    userId,
    role: 'profesor',
    action: 'asignar_tarea',
    entityType: 'assignment',
    entityId: result.assignment!._id.toString(),
    cursoId: finalCursoId,
    colegioId,
    result: 'success',
    requestData: params
  });

  await syncService.syncAssignmentChange(result.assignment!._id.toString(), 'created', colegioId);

  return {
    success: true,
    data: { assignmentId: result.assignment!._id.toString() },
    message: `Tarea "${titulo}" creada exitosamente${grupoFinal ? ` para el grupo ${grupoFinal}` : ''}`
  };
}

async function executeSubmitAssignment(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { assignmentId, archivos, comentario } = params;
  
  const permission = await permissionValidator.canSubmitAssignment(userId, assignmentId, colegioId);
  if (!permission.allowed) {
    await logAIAction({
      userId,
      role: 'estudiante',
      action: 'entregar_tarea',
      entityType: 'assignment',
      entityId: assignmentId,
      colegioId,
      result: 'denied',
      error: permission.reason,
      requestData: params
    });
    return { success: false, error: permission.reason };
  }

  const normalizedAssignmentId = normalizeIdForQuery(assignmentId);
  const normalizedEstudianteId = normalizeIdForQuery(userId);

  const assignment = await Assignment.findById(normalizedAssignmentId);
  if (!assignment) {
    return { success: false, error: 'La tarea no existe' };
  }

  const estudiante = await User.findById(normalizedEstudianteId).select('nombre').lean();
  const estudianteNombre = estudiante?.nombre || 'Estudiante';

  // Verificar si ya existe una entrega
  const existingSubmission = assignment.submissions.find(
    (s: ISubmission) => s.estudianteId.toString() === normalizedEstudianteId
  );

  const submission: ISubmission = {
    estudianteId: normalizedEstudianteId as any,
    estudianteNombre,
    archivos: archivos as IAttachment[],
    comentario,
    fechaEntrega: new Date(),
  };

  if (existingSubmission) {
    // Actualizar entrega existente
    const index = assignment.submissions.findIndex(
      (s: ISubmission) => s.estudianteId.toString() === normalizedEstudianteId
    );
    assignment.submissions[index] = submission;
  } else {
    // Crear nueva entrega
    assignment.submissions.push(submission);
  }

  await assignment.save();

  await logAIAction({
    userId,
    role: 'estudiante',
    action: 'entregar_tarea',
    entityType: 'assignment',
    entityId: assignmentId,
    colegioId,
    result: 'success',
    requestData: params
  });

  return {
    success: true,
    data: { submissionId: existingSubmission ? 'updated' : 'created' },
    message: 'Tarea entregada exitosamente'
  };
}

async function executeGradeAssignment(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { assignmentId, estudianteId, calificacion, retroalimentacion } = params;
  
  const permission = await permissionValidator.canGrade(userId, assignmentId, colegioId);
  if (!permission.allowed) {
    await logAIAction({
      userId,
      role: 'profesor',
      action: 'calificar_tarea',
      entityType: 'assignment',
      entityId: assignmentId,
      colegioId,
      result: 'denied',
      error: permission.reason,
      requestData: params
    });
    return { success: false, error: permission.reason };
  }

  const normalizedAssignmentId = normalizeIdForQuery(assignmentId);
  const normalizedEstudianteId = normalizeIdForQuery(estudianteId);

  const assignment = await Assignment.findById(normalizedAssignmentId);
  if (!assignment) {
    return { success: false, error: 'La tarea no existe' };
  }

  const submission = assignment.submissions.find(
    (s: ISubmission) => s.estudianteId.toString() === normalizedEstudianteId
  );

  if (!submission) {
    return { success: false, error: 'El estudiante no ha entregado esta tarea' };
  }

  submission.calificacion = calificacion;
  if (retroalimentacion) {
    submission.retroalimentacion = retroalimentacion;
  }

  await assignment.save();

  await logAIAction({
    userId,
    role: 'profesor',
    action: 'calificar_tarea',
    entityType: 'assignment',
    entityId: assignmentId,
    colegioId,
    result: 'success',
    requestData: params
  });

  await syncService.syncAssignmentGraded(assignmentId, estudianteId, calificacion, colegioId);

  return {
    success: true,
    data: { calificacion },
    message: `Tarea calificada con ${calificacion}`
  };
}

async function executeCreateNote(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { tareaId, estudianteId, nota, logro } = params;
  
  const normalizedTareaId = normalizeIdForQuery(tareaId);
  const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
  const normalizedProfesorId = normalizeIdForQuery(userId);

  const nuevaNota = await Nota.create({
    tareaId: normalizedTareaId,
    estudianteId: normalizedEstudianteId,
    profesorId: normalizedProfesorId,
    nota,
    logro,
    fecha: new Date(),
  });

  await logAIAction({
    userId,
    role: 'profesor',
    action: 'subir_nota',
    entityType: 'note',
    entityId: nuevaNota._id.toString(),
    colegioId,
    result: 'success',
    requestData: params
  });

  await syncService.syncNoteCreated(nuevaNota._id.toString(), estudianteId, colegioId);

  return {
    success: true,
    data: { notaId: nuevaNota._id.toString() },
    message: `Nota de ${nota} registrada exitosamente`
  };
}

async function executeModifyAssignmentDate(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { assignmentId, nuevaFecha } = params;
  
  const permission = await permissionValidator.canModifyDate(userId, assignmentId, colegioId);
  if (!permission.allowed) {
    await logAIAction({
      userId,
      role: 'profesor',
      action: 'modificar_fecha_tarea',
      entityType: 'assignment',
      entityId: assignmentId,
      colegioId,
      result: 'denied',
      error: permission.reason,
      requestData: params
    });
    return { success: false, error: permission.reason };
  }

  const normalizedAssignmentId = normalizeIdForQuery(assignmentId);
  const assignment = await Assignment.findById(normalizedAssignmentId);
  
  if (!assignment) {
    return { success: false, error: 'La tarea no existe' };
  }

  assignment.fechaEntrega = new Date(nuevaFecha);
  await assignment.save();

  await logAIAction({
    userId,
    role: 'profesor',
    action: 'modificar_fecha_tarea',
    entityType: 'assignment',
    entityId: assignmentId,
    colegioId,
    result: 'success',
    requestData: params
  });

  await syncService.syncAssignmentDateChanged(assignmentId, new Date(nuevaFecha), colegioId);

  return {
    success: true,
    data: { nuevaFecha },
    message: `Fecha de entrega actualizada a ${nuevaFecha}`
  };
}

async function executeSendComment(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { destinatarioId, comentario, context } = params;
  
  const permission = await permissionValidator.canSendComment(userId, destinatarioId, context, colegioId);
  if (!permission.allowed) {
    await logAIAction({
      userId,
      role: 'user',
      action: 'enviar_comentario',
      entityType: 'message',
      entityId: destinatarioId,
      colegioId,
      result: 'denied',
      error: permission.reason,
      requestData: params
    });
    return { success: false, error: permission.reason };
  }

  await syncService.syncCommentSent(comentario, userId, destinatarioId, context, colegioId);

  await logAIAction({
    userId,
    role: 'user',
    action: 'enviar_comentario',
    entityType: 'message',
    entityId: destinatarioId,
    colegioId,
    result: 'success',
    requestData: params
  });

  return {
    success: true,
    message: 'Comentario enviado exitosamente'
  };
}

async function executeCreateBoletin(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { cursoId, periodo } = params;
  
  const permission = await permissionValidator.canCreateBoletin(userId, cursoId, colegioId);
  if (!permission.allowed) {
    await logAIAction({
      userId,
      role: 'profesor',
      action: 'crear_boletin',
      entityType: 'boletin',
      cursoId,
      colegioId,
      result: 'denied',
      error: permission.reason,
      requestData: params
    });
    return { success: false, error: permission.reason };
  }

  // TODO: Implementar creación real de boletín
  // Por ahora solo registramos la acción
  await logAIAction({
    userId,
    role: 'profesor',
    action: 'crear_boletin',
    entityType: 'boletin',
    cursoId,
    colegioId,
    result: 'success',
    requestData: params
  });

  await syncService.syncBoletinCreated('boletin-id', cursoId, colegioId);

  return {
    success: true,
    message: `Boletín del ${periodo} creado exitosamente para el curso`
  };
}

async function executeCreatePermiso(
  params: any,
  userId: string,
  colegioId: string
): Promise<ActionResult> {
  const { 
    tipoPermiso, 
    nombreEstudiante, 
    fecha,
    numeroRutaActual,
    numeroRutaCambio,
    placaCarroActual,
    placaCarroSalida,
    nombreConductor,
    cedulaConductor
  } = params;

  // Validar campos obligatorios
  if (!tipoPermiso || !nombreEstudiante || !fecha) {
    return {
      success: false,
      error: 'Faltan campos obligatorios: tipoPermiso, nombreEstudiante y fecha son requeridos.'
    };
  }

  // Validar campos según el tipo de permiso
  const tipo = tipoPermiso as string;
  
  if (tipo === 'ruta-a-carro' || tipo === 'ruta-a-ruta') {
    if (!numeroRutaActual) {
      return {
        success: false,
        error: `Para el tipo de permiso "${tipo}", el campo "numeroRutaActual" es requerido.`
      };
    }
  }

  if (tipo === 'carro-a-ruta' || tipo === 'ruta-a-ruta') {
    if (!numeroRutaCambio) {
      return {
        success: false,
        error: `Para el tipo de permiso "${tipo}", el campo "numeroRutaCambio" es requerido.`
      };
    }
  }

  if (tipo === 'ruta-a-carro' || tipo === 'carro-a-ruta' || tipo === 'carro-a-carro') {
    if (!placaCarroSalida || !nombreConductor || !cedulaConductor) {
      return {
        success: false,
        error: `Para el tipo de permiso "${tipo}", los campos "placaCarroSalida", "nombreConductor" y "cedulaConductor" son requeridos.`
      };
    }
  }

  if (tipo === 'carro-a-ruta' || tipo === 'carro-a-carro') {
    if (!placaCarroActual) {
      return {
        success: false,
        error: `Para el tipo de permiso "${tipo}", el campo "placaCarroActual" es requerido.`
      };
    }
  }

  // Construir el objeto del permiso
  const permiso = {
    tipoPermiso,
    nombreEstudiante,
    fecha,
    numeroRutaActual: numeroRutaActual || '',
    numeroRutaCambio: numeroRutaCambio || '',
    placaCarroActual: placaCarroActual || '',
    placaCarroSalida: placaCarroSalida || '',
    nombreConductor: nombreConductor || '',
    cedulaConductor: cedulaConductor || '',
    id: Date.now().toString(),
    fechaCreacion: new Date().toISOString(),
    padreId: userId,
    colegioId
  };

  // Registrar la acción
  await logAIAction({
    userId,
    role: 'padre',
    action: 'crear_permiso',
    entityType: 'permiso',
    entityId: permiso.id,
    colegioId,
    result: 'success',
    requestData: params
  });

  // Retornar el permiso creado para que el frontend lo guarde
  return {
    success: true,
    data: permiso,
    message: `Permiso de salida "${tipoPermiso}" creado exitosamente para ${nombreEstudiante} el ${fecha}.`
  };
}
