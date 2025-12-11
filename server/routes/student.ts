import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { Course } from '../models/Course';
import { User } from '../models/User';

const router = express.Router();

// =========================================================================
// GET /api/student/subjects
// Obtener todas las materias asignadas al grupo del estudiante
// =========================================================================
router.get('/subjects', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;
    const colegioId = req.user?.colegioId || 'COLEGIO_DEMO_2025';

    if (!estudianteId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    // Obtener el grupo del estudiante desde su perfil
    const estudiante = await User.findById(estudianteId).select('curso rol');
    
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    if (estudiante.rol !== 'estudiante') {
      return res.status(403).json({ message: 'Solo estudiantes pueden acceder a este recurso.' });
    }

    const grupoId = estudiante.curso;
    
    if (!grupoId) {
      return res.json({ 
        subjects: [],
        message: 'El estudiante no tiene grupo asignado.',
        grupoId: null
      });
    }

    // Buscar todas las materias (cursos) que tienen este grupo en su array de grupos
    const courses = await Course.find({ 
      cursos: grupoId, // Filtra cursos donde el grupoId está en el array 'cursos'
      colegioId 
    })
    .populate('profesorIds', 'nombre apellido email') // Incluir info del profesor
    .select('nombre descripcion profesorIds colorAcento icono');

    // Formatear la respuesta
    const formattedSubjects = courses.map(course => ({
      _id: course._id,
      nombre: course.nombre,
      descripcion: course.descripcion,
      profesores: course.profesorIds?.map((prof: any) => ({
        _id: prof._id,
        nombre: prof.nombre,
        email: prof.email,
      })) || [],
      colorAcento: course.colorAcento,
      icono: course.icono,
    }));

    res.json({ 
      subjects: formattedSubjects,
      total: formattedSubjects.length,
      grupoId: grupoId
    });

  } catch (error) {
    console.error('Error al obtener materias del estudiante:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// GET /api/student/profile
// Obtener información del perfil del estudiante incluyendo su grupo
// =========================================================================
router.get('/profile', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;

    if (!estudianteId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    const estudiante = await User.findById(estudianteId)
      .select('nombre email curso rol colegioId');
    
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    res.json({
      _id: estudiante._id,
      nombre: estudiante.nombre,
      email: estudiante.email,
      grupoId: estudiante.curso,
      rol: estudiante.rol,
      colegioId: estudiante.colegioId,
    });

  } catch (error) {
    console.error('Error al obtener perfil del estudiante:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
