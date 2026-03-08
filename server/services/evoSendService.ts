import { EvoThread, EvoMessage, Course, Assignment } from '../models';
import { normalizeIdForQuery } from '../utils/idGenerator';

export interface NotifyAssignmentParams {
  assignmentId: string;
  courseId: string;
  colegioId: string;
  profesorId: string;
  titulo: string;
  fechaEntrega: Date | string;
  curso?: string;
}

/**
 * Crea un hilo Evo Send y un mensaje de tipo asignación para notificar a todos
 * los estudiantes del curso cuando un profesor crea una tarea.
 */
export async function notifyAssignmentCreated(params: NotifyAssignmentParams): Promise<{ success: boolean; threadId?: string; error?: string }> {
  try {
    const { assignmentId, courseId, colegioId, profesorId, titulo, fechaEntrega, curso } = params;
    const normalizedCourseId = normalizeIdForQuery(courseId);
    const course = await Course.findById(normalizedCourseId).select('estudianteIds estudiantes nombre').lean();
    if (!course) return { success: false, error: 'Curso no encontrado.' };

    const studentIds = (course.estudianteIds || course.estudiantes || []) as any[];
    const recipientIds = studentIds.map((id: any) => id?.toString()).filter(Boolean);
    if (recipientIds.length === 0) {
      return { success: true }; // Sin estudiantes, no hay nada que notificar
    }

    const thread = await EvoThread.create({
      colegioId,
      tipo: 'asignacion',
      asunto: `Nueva tarea: ${titulo}`,
      creadoPor: normalizeIdForQuery(profesorId),
      cursoId: normalizedCourseId,
      assignmentId: normalizeIdForQuery(assignmentId),
      recipientIds,
      updatedAt: new Date(),
    });

    const link = `/mi-aprendizaje/tareas`; // Los estudiantes ven tareas aquí; opcional: link directo a tarea
    const contenido = `Se ha publicado la tarea "${titulo}". Fecha de entrega: ${new Date(fechaEntrega).toLocaleDateString('es')}. Ver en Mis tareas.`;

    await EvoMessage.create({
      threadId: thread._id,
      remitenteId: normalizeIdForQuery(profesorId),
      rolRemitente: 'profesor',
      contenido,
      tipo: 'asignacion',
      prioridad: 'normal',
      assignmentId: normalizeIdForQuery(assignmentId),
      leidoPor: [normalizeIdForQuery(profesorId)],
    });

    return { success: true, threadId: thread._id.toString() };
  } catch (err: any) {
    console.error('evoSendService.notifyAssignmentCreated:', err);
    return { success: false, error: err.message };
  }
}
