import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { Course } from '../models/Course';
import { User } from '../models/User';

const router = express.Router();

// =========================================================================
// GET /api/professor/assignments/:materiaId
// Obtener los grupos asignados al profesor para una materia específica
// =========================================================================
router.get('/assignments/:materiaId', protect, async (req: AuthRequest, res) => {
  try {
    const { materiaId } = req.params;
    const profesorId = req.user?.id;

    if (!materiaId) {
      return res.status(400).json({ message: 'ID de materia requerido.' });
    }

    // Buscar el curso/materia
    const course = await Course.findById(materiaId);
    
    if (!course) {
      // Si no existe la materia, devolver array vacío
      return res.json({ grupoIds: [] });
    }

    // Verificar si el profesor está asignado a este curso
    const isAssigned = course.profesorIds?.some(id => id.toString() === profesorId);
    if (!isAssigned) {
      return res.json({ grupoIds: [] });
    }

    // Devolver los grupos asignados (cursos es el array de grupos)
    res.json({ grupoIds: course.cursos || [] });

  } catch (error) {
    console.error('Error al obtener asignaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// POST /api/professor/assign-groups
// Asignar grupos a la materia del profesor
// =========================================================================
router.post('/assign-groups', protect, async (req: AuthRequest, res) => {
  try {
    const { materiaId, grupoIds, profesorId } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId || 'default_colegio';

    // Validaciones
    if (!grupoIds || !Array.isArray(grupoIds)) {
      return res.status(400).json({ message: 'Lista de grupos requerida.' });
    }

    if (!profesorId || profesorId !== userId) {
      return res.status(403).json({ message: 'No autorizado para esta acción.' });
    }

    // Obtener el nombre de la materia del profesor
    const profesor = await User.findById(profesorId);
    if (!profesor || profesor.rol !== 'profesor') {
      return res.status(404).json({ message: 'Profesor no encontrado.' });
    }

    const materiaNombre = profesor.materias?.[0];
    if (!materiaNombre) {
      return res.status(400).json({ message: 'El profesor no tiene materia asignada.' });
    }

    // Buscar todos los estudiantes que pertenecen a los grupos seleccionados
    const estudiantesEnGrupos = await User.find({
      rol: 'estudiante',
      curso: { $in: grupoIds }, // Estudiantes cuyo grupo está en la lista seleccionada
      colegioId
    }).select('_id');
    
    const estudianteIds = estudiantesEnGrupos.map(e => e._id);

    // Buscar o crear el curso/materia
    let course = await Course.findOne({ 
      nombre: materiaNombre, 
      colegioId 
    });

    if (!course) {
      // Crear el curso si no existe
      course = new Course({
        nombre: materiaNombre,
        descripcion: `Curso de ${materiaNombre}`,
        colegioId,
        profesorIds: [profesorId],
        cursos: grupoIds, // Array de grupos asignados (9A, 10B, etc.)
        estudianteIds: estudianteIds, // Estudiantes de esos grupos
      });
      await course.save();
    } else {
      // Actualizar el curso existente
      // Añadir profesor si no está ya asignado
      if (!course.profesorIds?.some(id => id.toString() === profesorId)) {
        course.profesorIds = course.profesorIds || [];
        course.profesorIds.push(profesorId as any);
      }
      course.cursos = grupoIds;
      course.estudianteIds = estudianteIds; // Actualizar estudiantes vinculados
      await course.save();
    }

    res.json({ 
      message: 'Asignación guardada exitosamente.',
      course: {
        _id: course._id,
        nombre: course.nombre,
        grupoIds: course.cursos,
        estudiantesVinculados: estudianteIds.length,
      }
    });

  } catch (error) {
    console.error('Error al asignar grupos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// GET /api/professor/my-groups
// Obtener los grupos del profesor autenticado
// =========================================================================
router.get('/my-groups', protect, async (req: AuthRequest, res) => {
  try {
    const profesorId = req.user?.id;
    const colegioId = req.user?.colegioId || 'default_colegio';

    // Buscar cursos donde el profesor está asignado (usando profesorIds array)
    const courses = await Course.find({ 
      profesorIds: profesorId,
      colegioId 
    }).select('nombre cursos');

    // Extraer los grupos de todos los cursos
    const groups = courses.flatMap(course => course.cursos || []);
    
    res.json({ 
      groups: Array.from(new Set(groups)), // Eliminar duplicados
      courses: courses.map(c => ({
        _id: c._id,
        nombre: c.nombre,
        grupoIds: c.cursos || []
      }))
    });

  } catch (error) {
    console.error('Error al obtener grupos del profesor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
