import { Router } from 'express';
import { Course } from '../models/Course';
import { Assignment } from '../models/Assignment';
import { User } from '../models/User';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = Router();

// GET /api/subjects/mine - Obtener materias del curso del estudiante
router.get('/mine', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.rol !== 'estudiante' || !user.curso) {
      return res.status(403).json({ message: 'Solo estudiantes pueden ver sus materias' });
    }

    // Buscar todas las materias que se imparten en el curso del estudiante
    const subjects = await Course.find({
      colegioId: user.colegioId,
      cursos: user.curso
    }).populate('profesorId', 'nombre email');

    // Formatear respuesta
    const formattedSubjects = subjects.map(subject => ({
      _id: subject._id,
      nombre: subject.nombre,
      descripcion: subject.descripcion,
      colorAcento: subject.colorAcento,
      icono: subject.icono,
      profesor: {
        _id: (subject.profesorId as any)._id,
        nombre: (subject.profesorId as any).nombre,
        email: (subject.profesorId as any).email
      },
      createdAt: subject.createdAt
    }));

    res.json(formattedSubjects);
  } catch (error) {
    console.error('Error obteniendo materias:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GET /api/subjects/:id/overview - Obtener detalle de materia con tareas
router.get('/:id/overview', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener la materia
    const subject = await Course.findById(id).populate('profesorId', 'nombre email');

    if (!subject) {
      return res.status(404).json({ message: 'Materia no encontrada' });
    }

    // Verificar que el estudiante pertenezca a un curso donde se imparte esta materia
    if (user.rol === 'estudiante' && !subject.cursos.includes(user.curso || '')) {
      return res.status(403).json({ message: 'No tienes acceso a esta materia' });
    }

    // Obtener todas las tareas de esta materia para el curso del estudiante
    // Filtrar por courseId si está disponible, sino usar curso + profesorId (datos antiguos)
    // Nota: subject.profesorId puede estar poblado, así que extraemos el _id
    const profesorId = typeof subject.profesorId === 'object' && subject.profesorId._id 
      ? subject.profesorId._id 
      : subject.profesorId;
      
    const assignments = await Assignment.find({
      $or: [
        { courseId: subject._id, curso: user.curso }, // Nuevo: con courseId
        { courseId: { $exists: false }, curso: user.curso, profesorId } // Antiguo: sin courseId
      ],
      colegioId: user.colegioId
    }).sort({ fechaEntrega: 1 });

    // Separar en pendientes y pasadas
    const now = new Date();
    const pendingAssignments = assignments.filter(a => new Date(a.fechaEntrega) > now);
    const pastAssignments = assignments.filter(a => new Date(a.fechaEntrega) <= now);

    // Formatear respuesta
    const response = {
      _id: subject._id,
      nombre: subject.nombre,
      descripcion: subject.descripcion,
      colorAcento: subject.colorAcento,
      icono: subject.icono,
      profesor: {
        _id: (subject.profesorId as any)._id,
        nombre: (subject.profesorId as any).nombre,
        email: (subject.profesorId as any).email
      },
      assignments: {
        pending: pendingAssignments.map(a => ({
          _id: a._id,
          titulo: a.titulo,
          descripcion: a.descripcion,
          fechaEntrega: a.fechaEntrega,
          profesorNombre: a.profesorNombre,
          createdAt: a.createdAt
        })),
        past: pastAssignments.map(a => ({
          _id: a._id,
          titulo: a.titulo,
          descripcion: a.descripcion,
          fechaEntrega: a.fechaEntrega,
          profesorNombre: a.profesorNombre,
          createdAt: a.createdAt
        }))
      },
      stats: {
        totalAssignments: assignments.length,
        pendingCount: pendingAssignments.length,
        pastCount: pastAssignments.length
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error obteniendo detalle de materia:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

export default router;
