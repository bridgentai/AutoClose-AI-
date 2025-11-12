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
