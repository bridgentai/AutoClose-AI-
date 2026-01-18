import { Types } from 'mongoose';
import { Notificacion, Evento, Assignment, User, Course } from '../models';
import { normalizeIdForQuery } from '../utils/idGenerator';

/**
 * Servicio de sincronización entre módulos
 * Notifica cambios a módulos afectados cuando se ejecutan acciones
 */

/**
 * Sincroniza cuando se crea o modifica una tarea
 */
export async function syncAssignmentChange(
  assignmentId: string,
  action: 'created' | 'updated' | 'deleted',
  colegioId: string
): Promise<void> {
  try {
    const normalizedAssignmentId = normalizeIdForQuery(assignmentId);
    const assignment = await Assignment.findById(normalizedAssignmentId)
      .populate('cursoId')
      .lean();

    if (!assignment) {
      return;
    }

    // Obtener estudiantes del curso
    const curso = await Course.findById(assignment.cursoId).select('cursos').lean();
    if (!curso || !curso.cursos || curso.cursos.length === 0) {
      return;
    }

    const cursoNormalizado = curso.cursos[0].toUpperCase().trim();
    const estudiantes = await User.find({
      rol: 'estudiante',
      curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase()] },
      colegioId
    }).select('_id').lean();

    const estudianteIds = estudiantes.map(e => e._id);

    // Crear notificaciones para estudiantes
    const notificaciones = estudianteIds.map(estudianteId => ({
      usuarioId: estudianteId,
      titulo: action === 'created' 
        ? 'Nueva tarea asignada' 
        : action === 'updated' 
        ? 'Tarea actualizada' 
        : 'Tarea eliminada',
      descripcion: action === 'created'
        ? `Se ha asignado una nueva tarea: ${assignment.titulo}`
        : action === 'updated'
        ? `La tarea "${assignment.titulo}" ha sido actualizada`
        : `La tarea "${assignment.titulo}" ha sido eliminada`,
      fecha: new Date(),
      leido: false,
    }));

    if (notificaciones.length > 0) {
      await Notificacion.insertMany(notificaciones);
    }

    // Actualizar evento en calendario si es necesario
    if (action === 'created' || action === 'updated') {
      await Evento.findOneAndUpdate(
        {
          tipo: 'curso',
          cursoId: assignment.cursoId,
          titulo: assignment.titulo,
        },
        {
          titulo: assignment.titulo,
          descripcion: assignment.descripcion,
          fecha: assignment.fechaEntrega,
          tipo: 'curso',
          cursoId: assignment.cursoId,
        },
        {
          upsert: true,
          new: true,
        }
      );
    } else if (action === 'deleted') {
      await Evento.deleteOne({
        tipo: 'curso',
        cursoId: assignment.cursoId,
        titulo: assignment.titulo,
      });
    }
  } catch (error: any) {
    console.error('Error al sincronizar cambio de tarea:', error.message);
  }
}

/**
 * Sincroniza cuando se califica una tarea
 */
export async function syncAssignmentGraded(
  assignmentId: string,
  estudianteId: string,
  calificacion: number,
  colegioId: string
): Promise<void> {
  try {
    const normalizedAssignmentId = normalizeIdForQuery(assignmentId);
    const normalizedEstudianteId = normalizeIdForQuery(estudianteId);

    const assignment = await Assignment.findById(normalizedAssignmentId).lean();
    if (!assignment) {
      return;
    }

    // Crear notificación para el estudiante
    await Notificacion.create({
      usuarioId: normalizedEstudianteId,
      titulo: 'Tarea calificada',
      descripcion: `Tu tarea "${assignment.titulo}" ha sido calificada con ${calificacion}`,
      fecha: new Date(),
      leido: false,
    });
  } catch (error: any) {
    console.error('Error al sincronizar calificación de tarea:', error.message);
  }
}

/**
 * Sincroniza cuando se sube una nota
 */
export async function syncNoteCreated(
  notaId: string,
  estudianteId: string,
  colegioId: string
): Promise<void> {
  try {
    const normalizedEstudianteId = normalizeIdForQuery(estudianteId);

    // Crear notificación para el estudiante
    await Notificacion.create({
      usuarioId: normalizedEstudianteId,
      titulo: 'Nueva nota registrada',
      descripcion: 'Se ha registrado una nueva nota en tu expediente académico',
      fecha: new Date(),
      leido: false,
    });
  } catch (error: any) {
    console.error('Error al sincronizar creación de nota:', error.message);
  }
}

/**
 * Sincroniza cuando se envía un comentario
 */
export async function syncCommentSent(
  comentario: string,
  remitenteId: string,
  destinatarioId: string,
  context: 'assignment' | 'note' | 'general',
  colegioId: string
): Promise<void> {
  try {
    const normalizedDestinatarioId = normalizeIdForQuery(destinatarioId);

    const remitente = await User.findById(remitenteId).select('nombre rol').lean();
    if (!remitente) {
      return;
    }

    let titulo = 'Nuevo comentario';
    let descripcion = comentario;

    if (context === 'assignment') {
      titulo = 'Comentario en tarea';
      descripcion = `${remitente.nombre} ha comentado en una tarea: ${comentario}`;
    } else if (context === 'note') {
      titulo = 'Comentario en nota';
      descripcion = `${remitente.nombre} ha comentado sobre una nota: ${comentario}`;
    } else {
      descripcion = `${remitente.nombre}: ${comentario}`;
    }

    // Crear notificación para el destinatario
    await Notificacion.create({
      usuarioId: normalizedDestinatarioId,
      titulo,
      descripcion,
      fecha: new Date(),
      leido: false,
    });
  } catch (error: any) {
    console.error('Error al sincronizar envío de comentario:', error.message);
  }
}

/**
 * Sincroniza cuando se crea un boletín
 */
export async function syncBoletinCreated(
  boletinId: string,
  cursoId: string,
  colegioId: string
): Promise<void> {
  try {
    const normalizedCursoId = normalizeIdForQuery(cursoId);

    // Obtener estudiantes del curso
    const curso = await Course.findById(normalizedCursoId).select('cursos').lean();
    if (!curso || !curso.cursos || curso.cursos.length === 0) {
      return;
    }

    const cursoNormalizado = curso.cursos[0].toUpperCase().trim();
    const estudiantes = await User.find({
      rol: 'estudiante',
      curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase()] },
      colegioId
    }).select('_id').lean();

    const estudianteIds = estudiantes.map(e => e._id);

    // Obtener padres de estos estudiantes
    const padres = await User.find({
      rol: 'padre',
      hijoId: { $in: estudianteIds.map(id => id.toString()) },
      colegioId
    }).select('_id').lean();

    const padreIds = padres.map(p => p._id);
    const todosLosDestinatarios = [...estudianteIds, ...padreIds];

    // Crear notificaciones
    const notificaciones = todosLosDestinatarios.map(usuarioId => ({
      usuarioId,
      titulo: 'Nuevo boletín disponible',
      descripcion: 'Se ha generado un nuevo boletín académico para tu curso',
      fecha: new Date(),
      leido: false,
    }));

    if (notificaciones.length > 0) {
      await Notificacion.insertMany(notificaciones);
    }
  } catch (error: any) {
    console.error('Error al sincronizar creación de boletín:', error.message);
  }
}

/**
 * Sincroniza cuando se modifica una fecha de tarea
 */
export async function syncAssignmentDateChanged(
  assignmentId: string,
  nuevaFecha: Date,
  colegioId: string
): Promise<void> {
  try {
    const normalizedAssignmentId = normalizeIdForQuery(assignmentId);
    const assignment = await Assignment.findById(normalizedAssignmentId)
      .populate('cursoId')
      .lean();

    if (!assignment) {
      return;
    }

    // Obtener estudiantes del curso
    const curso = await Course.findById(assignment.cursoId).select('cursos').lean();
    if (!curso || !curso.cursos || curso.cursos.length === 0) {
      return;
    }

    const cursoNormalizado = curso.cursos[0].toUpperCase().trim();
    const estudiantes = await User.find({
      rol: 'estudiante',
      curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase()] },
      colegioId
    }).select('_id').lean();

    const estudianteIds = estudiantes.map(e => e._id);

    // Crear notificaciones
    const notificaciones = estudianteIds.map(estudianteId => ({
      usuarioId: estudianteId,
      titulo: 'Fecha de tarea modificada',
      descripcion: `La fecha de entrega de la tarea "${assignment.titulo}" ha sido modificada`,
      fecha: new Date(),
      leido: false,
    }));

    if (notificaciones.length > 0) {
      await Notificacion.insertMany(notificaciones);
    }

    // Actualizar evento en calendario
    await Evento.findOneAndUpdate(
      {
        tipo: 'curso',
        cursoId: assignment.cursoId,
        titulo: assignment.titulo,
      },
      {
        fecha: nuevaFecha,
      }
    );
  } catch (error: any) {
    console.error('Error al sincronizar cambio de fecha de tarea:', error.message);
  }
}

