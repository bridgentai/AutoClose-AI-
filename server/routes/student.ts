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
      .select('nombre email curso rol colegioId telefono celular direccion barrio ciudad fechaNacimiento');
    
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
      telefono: estudiante.telefono,
      celular: estudiante.celular,
      direccion: estudiante.direccion,
      barrio: estudiante.barrio,
      ciudad: estudiante.ciudad,
      fechaNacimiento: estudiante.fechaNacimiento,
    });

  } catch (error) {
    console.error('Error al obtener perfil del estudiante:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// PUT /api/student/profile
// Actualizar información personal del estudiante
// =========================================================================
router.put('/profile', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.user?.id;

    if (!estudianteId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    const { telefono, celular, direccion, barrio, ciudad, fechaNacimiento } = req.body;

    const estudiante = await User.findById(estudianteId);
    
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    // Actualizar solo los campos proporcionados
    if (telefono !== undefined) estudiante.telefono = telefono;
    if (celular !== undefined) estudiante.celular = celular;
    if (direccion !== undefined) estudiante.direccion = direccion;
    if (barrio !== undefined) estudiante.barrio = barrio;
    if (ciudad !== undefined) estudiante.ciudad = ciudad;
    if (fechaNacimiento !== undefined) estudiante.fechaNacimiento = fechaNacimiento ? new Date(fechaNacimiento) : undefined;

    await estudiante.save();

    res.json({
      message: 'Información personal actualizada correctamente.',
      estudiante: {
        _id: estudiante._id,
        nombre: estudiante.nombre,
        email: estudiante.email,
        telefono: estudiante.telefono,
        celular: estudiante.celular,
        direccion: estudiante.direccion,
        barrio: estudiante.barrio,
        ciudad: estudiante.ciudad,
        fechaNacimiento: estudiante.fechaNacimiento,
      }
    });

  } catch (error) {
    console.error('Error al actualizar información personal:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// GET /api/student/:estudianteId/personal-info
// Obtener información personal de un estudiante (para profesores)
// Optimizado: combina verificación de rol y obtención de datos en una consulta
// =========================================================================
router.get('/:estudianteId/personal-info', protect, async (req: AuthRequest, res) => {
  try {
    const { estudianteId } = req.params;
    const profesorId = req.user?.id;
    const colegioId = req.user?.colegioId;

    if (!profesorId || !colegioId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    // Verificar que el usuario que hace la petición sea profesor o directivo y obtener estudiante en paralelo
    const [usuario, estudiante] = await Promise.all([
      User.findById(profesorId).select('rol').lean(),
      User.findById(estudianteId)
        .select('nombre email curso rol colegioId telefono celular direccion barrio ciudad fechaNacimiento')
        .lean()
    ]);

    if (!usuario || (usuario.rol !== 'profesor' && usuario.rol !== 'directivo')) {
      return res.status(403).json({ message: 'Solo profesores y directivos pueden acceder a esta información.' });
    }
    
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    // Verificar que el estudiante pertenezca al mismo colegio
    if (estudiante.colegioId !== colegioId) {
      return res.status(403).json({ message: 'No tienes permiso para acceder a esta información.' });
    }

    res.json({
      _id: estudiante._id,
      nombre: estudiante.nombre,
      email: estudiante.email,
      curso: estudiante.curso,
      colegioId: estudiante.colegioId,
      telefono: estudiante.telefono || null,
      celular: estudiante.celular || null,
      direccion: estudiante.direccion || null,
      barrio: estudiante.barrio || null,
      ciudad: estudiante.ciudad || null,
      fechaNacimiento: estudiante.fechaNacimiento || null,
    });

  } catch (error) {
    console.error('Error al obtener información personal del estudiante:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
