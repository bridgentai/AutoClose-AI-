import { Assignment, User, Course, LogroCalificacion } from '../models';
import { normalizeIdForQuery } from '../utils/idGenerator';
import type { IAssignment } from '../models/Assignment';
import * as syncService from './syncService';

export interface CreateAssignmentParams {
  titulo: string;
  descripcion: string;
  contenidoDocumento?: string;
  curso: string; // Nombre del grupo (ej: "12C")
  courseId: string; // ID del curso/materia
  fechaEntrega: string | Date;
  adjuntos?: string[];
  profesorId: string;
  colegioId: string;
  logroCalificacionId?: string; // Tipo de logro (Tareas, Exámenes, etc.) para ponderar la nota
}

export interface CreateAssignmentResult {
  success: boolean;
  assignment?: IAssignment;
  error?: string;
}

/**
 * Servicio reutilizable para crear assignments
 * Usa la misma lógica que POST /api/assignments para garantizar consistencia
 */
export async function createAssignment(params: CreateAssignmentParams): Promise<CreateAssignmentResult> {
  try {
    const { titulo, descripcion, contenidoDocumento, curso, courseId, fechaEntrega, adjuntos, profesorId, colegioId, logroCalificacionId } = params;

    // Validar campos obligatorios
    if (!titulo || !descripcion || !curso || !fechaEntrega) {
      return {
        success: false,
        error: 'Faltan campos obligatorios: titulo, descripcion, curso, fechaEntrega'
      };
    }

    // Normalizar IDs
    const normalizedUserId = normalizeIdForQuery(profesorId);
    const normalizedCourseId = normalizeIdForQuery(courseId);

    // Verificar que el usuario es profesor
    const user = await User.findById(normalizedUserId);
    if (!user) {
      return {
        success: false,
        error: 'Usuario no encontrado.'
      };
    }

    // ⚠️ SEGURIDAD: super_admin puede crear tareas para cualquier colegio
    if (user.rol !== 'profesor' && user.rol !== 'school_admin' && user.rol !== 'super_admin') {
      return {
        success: false,
        error: 'Solo los profesores pueden crear tareas.'
      };
    }

    // Validación de seguridad crítica
    if (!courseId) {
      return {
        success: false,
        error: 'El courseId es obligatorio.'
      };
    }

    // Obtener el curso
    const course = await Course.findById(normalizedCourseId);
    if (!course) {
      return {
        success: false,
        error: 'Materia no encontrada.'
      };
    }

    // Verificar que el profesor es uno de los profesores de la materia
    const isProfesorOfCourse = (course.profesorIds || []).some(
      (pId: any) => pId.toString() === user._id.toString()
    );
    if (!isProfesorOfCourse) {
      return {
        success: false,
        error: 'No puedes asignar tareas para una materia que no dictas.'
      };
    }

    // CRÍTICO: Verificar que el grupo (curso) solicitado pertenece a esta materia
    // Normalizar curso para comparación (case-insensitive)
    const cursoNormalizado = curso.toUpperCase().trim();
    const cursosNormalizados = (course.cursos || []).map(c => (c as string).toUpperCase().trim());

    if (!cursosNormalizados.includes(cursoNormalizado)) {
      return {
        success: false,
        error: `La materia ${course.nombre} no incluye el grupo ${curso}. Grupos válidos: ${(course.cursos || []).join(', ')}.`
      };
    }

    // Si la materia tiene logros configurados, se debe seleccionar uno obligatoriamente
    const logrosMateria = await LogroCalificacion.find({ courseId: normalizedCourseId, colegioId }).lean();
    if (logrosMateria.length > 0 && !logroCalificacionId) {
      return {
        success: false,
        error: 'Debes seleccionar el tipo de logro al que pertenece esta asignación.',
      };
    }

    // Validar logro si se proporciona
    let logroObjId: import('mongoose').Types.ObjectId | undefined;
    if (logroCalificacionId) {
      const logro = await LogroCalificacion.findOne({
        _id: normalizeIdForQuery(logroCalificacionId),
        courseId: normalizedCourseId,
        colegioId,
      }).lean();
      if (!logro) {
        return {
          success: false,
          error: 'El tipo de logro no existe o no pertenece a esta materia.',
        };
      }
      logroObjId = logro._id as import('mongoose').Types.ObjectId;
    }

    // Obtener materiaId del curso
    const materiaId = course.materiaId || course._id; // Fallback si no tiene materiaId

    // Crear la tarea
    const newAssignment = new Assignment({
      titulo,
      descripcion,
      contenidoDocumento: contenidoDocumento || undefined,
      cursoId: normalizedCourseId, // Campo requerido en nueva estructura
      materiaId: materiaId, // Campo requerido en nueva estructura
      profesorId: user._id,
      fechaEntrega: fechaEntrega instanceof Date ? fechaEntrega : new Date(fechaEntrega),
      submissions: [], // Usar submissions en lugar de entregas
      adjuntos: adjuntos || [],
      colegioId: user.colegioId,
      // Campos adicionales para compatibilidad
      curso: cursoNormalizado, // Usar curso normalizado para consistencia
      courseId: normalizedCourseId,
      profesorNombre: user.nombre,
      logroCalificacionId: logroObjId,
    });

    await newAssignment.save();

    // CRÍTICO: Sincronizar el cambio para que aparezca en todas las páginas
    await syncService.syncAssignmentChange(newAssignment._id.toString(), 'created', colegioId);

    return {
      success: true,
      assignment: newAssignment
    };
  } catch (err: any) {
    console.error('Error al crear tarea en assignmentService:', err.message);
    return {
      success: false,
      error: err.message || 'Error interno del servidor al crear la tarea.'
    };
  }
}

