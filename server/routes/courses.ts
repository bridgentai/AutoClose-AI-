import express from 'express';
import { Course } from '../models';
import { protect, restrictTo, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// GET /api/courses - Obtener cursos
router.get('/', protect, async (req: AuthRequest, res) => {
  const { colegioId } = req.user!;

  try {
    const courses = await Course.find({ colegioId })
      .populate('profesorId', 'nombre email')
      .sort({ nombre: 1 });

    res.json(courses);
  } catch (error: any) {
    console.error('Error al obtener cursos:', error.message);
    res.status(500).json({ message: 'Error en el servidor al cargar los cursos.' });
  }
});

// POST /api/courses - Crear curso (profesor/directivo)
router.post('/', protect, restrictTo('profesor', 'directivo'), async (req: AuthRequest, res) => {
  const { nombre, descripcion, cursos, colorAcento, icono } = req.body;
  const { colegioId, id: profesorId } = req.user!;

  try {
    const nuevoCurso = await Course.create({
      colegioId,
      nombre,
      descripcion,
      profesorId,
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
router.put('/:id', protect, restrictTo('profesor', 'directivo'), async (req: AuthRequest, res) => {
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
router.delete('/:id', protect, restrictTo('directivo'), async (req: AuthRequest, res) => {
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
