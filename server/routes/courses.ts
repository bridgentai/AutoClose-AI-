import express from 'express';
import { Course, User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/courses - Obtener cursos
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Filtrar cursos según el rol del usuario
    let query: any = { colegioId: user.colegioId };
    
    // Si es profesor, solo mostrar cursos donde él es el profesor asignado
    if (user.rol === 'profesor') {
      query.profesorId = user._id;
    }
    // Si es directivo, padre o estudiante, mostrar todos los cursos del colegio

    const courses = await Course.find(query)
      .populate('profesorId', 'nombre email')
      .sort({ nombre: 1 });

    res.json(courses);
  } catch (error: any) {
    console.error('Error al obtener cursos:', error.message);
    res.status(500).json({ message: 'Error en el servidor al cargar los cursos.' });
  }
});

// GET /api/courses/for-group/:grupo - Obtener materias del profesor para un grupo específico
router.get('/for-group/:grupo', protect, async (req: AuthRequest, res) => {
  try {
    const { grupo } = req.params;
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.rol !== 'profesor') {
      return res.status(403).json({ message: 'Solo los profesores pueden acceder a esta ruta' });
    }

    // Buscar todas las materias del profesor que incluyan este grupo
    const courses = await Course.find({
      profesorId: user._id,
      cursos: grupo,
      colegioId: user.colegioId
    }).sort({ nombre: 1 });

    res.json(courses);
  } catch (error: any) {
    console.error('Error al obtener materias para grupo:', error.message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// POST /api/courses - Crear curso (profesor/directivo)
router.post('/', protect, async (req: AuthRequest, res) => {
  const { nombre, descripcion, cursos, colorAcento, icono } = req.body;
  
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if (user.rol !== 'profesor' && user.rol !== 'directivo') {
    return res.status(403).json({ message: 'Solo profesores y directivos pueden crear cursos' });
  }

  try {
    const nuevoCurso = await Course.create({
      colegioId: user.colegioId,
      nombre,
      descripcion,
      profesorId: user._id,
      cursos: Array.isArray(cursos) ? cursos : [],
      colorAcento: colorAcento || '#9f25b8',
      icono,
    });

    res.status(201).json(nuevoCurso);
  } catch (error: any) {
    console.error('Error al crear curso:', error.message);
    res.status(500).json({ message: 'Error en el servidor al crear el curso.' });
  }
});

// PUT /api/courses/:id - Actualizar curso
router.put('/:id', protect, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if (user.rol !== 'profesor' && user.rol !== 'directivo') {
    return res.status(403).json({ message: 'Solo profesores y directivos pueden actualizar cursos' });
  }
  const { id } = req.params;
  const { nombre, descripcion, cursos, colorAcento, icono } = req.body;

  try {
    const curso = await Course.findByIdAndUpdate(
      id,
      { nombre, descripcion, cursos, colorAcento, icono },
      { new: true, runValidators: true }
    );

    if (!curso) {
      return res.status(404).json({ message: 'Curso no encontrado.' });
    }

    res.json(curso);
  } catch (error: any) {
    console.error('Error al actualizar curso:', error.message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// POST /api/courses/assign - Asignar grupos a profesor (solo directivos)
router.post('/assign', protect, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Solo directivos pueden asignar cursos
    if (user.rol !== 'directivo') {
      return res.status(403).json({ message: 'Solo directivos pueden asignar cursos' });
    }

    const { profesorId, materia, grupos } = req.body;

    // Validar datos requeridos
    if (!profesorId || !materia || !Array.isArray(grupos)) {
      return res.status(400).json({ 
        message: 'Se requieren profesorId, materia y grupos (array)' 
      });
    }

    // Verificar que el profesor existe y es del mismo colegio
    const profesor = await User.findById(profesorId);
    if (!profesor) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }

    if (profesor.colegioId !== user.colegioId) {
      return res.status(403).json({ 
        message: 'No puedes asignar cursos a profesores de otra institución' 
      });
    }

    // Verificar que la materia está en el perfil del profesor
    if (!profesor.materias || !profesor.materias.includes(materia)) {
      return res.status(400).json({ 
        message: `El profesor no dicta la materia "${materia}"` 
      });
    }

    // Buscar si ya existe un Course para este profesor+materia
    let course = await Course.findOne({
      colegioId: user.colegioId,
      profesorId: profesorId,
      nombre: materia
    });

    // Deduplicate grupos
    const uniqueGrupos = Array.from(new Set(grupos.filter(g => g && g.trim())));

    if (course) {
      // Actualizar grupos existentes
      course.cursos = uniqueGrupos;
      await course.save();
    } else {
      // Crear nuevo Course
      course = await Course.create({
        colegioId: user.colegioId,
        nombre: materia,
        profesorId: profesorId,
        cursos: uniqueGrupos,
        colorAcento: '#9f25b8'
      });
    }

    res.json(course);
  } catch (error: any) {
    console.error('Error al asignar cursos:', error.message);
    res.status(500).json({ message: 'Error en el servidor al asignar cursos.' });
  }
});

// DELETE /api/courses/:id - Eliminar curso
router.delete('/:id', protect, async (req: AuthRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if (user.rol !== 'directivo') {
    return res.status(403).json({ message: 'Solo directivos pueden eliminar cursos' });
  }
  const { id } = req.params;

  try {
    const curso = await Course.findByIdAndDelete(id);

    if (!curso) {
      return res.status(404).json({ message: 'Curso no encontrado.' });
    }

    res.json({ message: 'Curso eliminado exitosamente.' });
  } catch (error: any) {
    console.error('Error al eliminar curso:', error.message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

export default router;
