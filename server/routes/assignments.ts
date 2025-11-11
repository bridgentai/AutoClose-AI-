import express from 'express';
import { Assignment, User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

// POST /api/assignments - Crear nueva tarea (solo profesores)
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { titulo, descripcion, curso, fechaEntrega } = req.body;

    if (!titulo || !descripcion || !curso || !fechaEntrega) {
      return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    // Verificar que el usuario es profesor
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (user.rol !== 'profesor') {
      return res.status(403).json({ message: 'Solo los profesores pueden crear tareas.' });
    }

    const newAssignment = new Assignment({
      titulo,
      descripcion,
      curso,
      fechaEntrega: new Date(fechaEntrega),
      profesorId: user._id,
      profesorNombre: user.nombre,
      colegioId: user.colegioId,
    });

    await newAssignment.save();

    return res.status(201).json(newAssignment);
  } catch (err: any) {
    console.error('Error al crear tarea:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/curso/:curso/:mes/:año - Obtener tareas de un curso en un mes específico
router.get('/curso/:curso/:mes/:año', protect, async (req: AuthRequest, res) => {
  try {
    const { curso, mes, año } = req.params;
    
    const mesNum = parseInt(mes);
    const añoNum = parseInt(año);
    
    // Obtener primer y último día del mes
    const primerDia = new Date(añoNum, mesNum - 1, 1);
    const ultimoDia = new Date(añoNum, mesNum, 0, 23, 59, 59);

    const assignments = await Assignment.find({
      curso,
      fechaEntrega: {
        $gte: primerDia,
        $lte: ultimoDia,
      },
    }).sort({ fechaEntrega: 1 });

    return res.json(assignments);
  } catch (err: any) {
    console.error('Error al obtener tareas:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/profesor/:profesorId/:mes/:año - Obtener tareas creadas por un profesor en un mes
router.get('/profesor/:profesorId/:mes/:año', protect, async (req: AuthRequest, res) => {
  try {
    const { profesorId, mes, año } = req.params;
    
    const mesNum = parseInt(mes);
    const añoNum = parseInt(año);
    
    const primerDia = new Date(añoNum, mesNum - 1, 1);
    const ultimoDia = new Date(añoNum, mesNum, 0, 23, 59, 59);

    const assignments = await Assignment.find({
      profesorId,
      fechaEntrega: {
        $gte: primerDia,
        $lte: ultimoDia,
      },
    }).sort({ fechaEntrega: 1 });

    return res.json(assignments);
  } catch (err: any) {
    console.error('Error al obtener tareas del profesor:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/:id - Obtener una tarea específica
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }

    return res.json(assignment);
  } catch (err: any) {
    console.error('Error al obtener tarea:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// DELETE /api/assignments/:id - Eliminar una tarea (solo el profesor que la creó)
router.delete('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({ message: 'Tarea no encontrada.' });
    }

    // Verificar que el usuario es el profesor que creó la tarea
    if (assignment.profesorId.toString() !== req.userId) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar esta tarea.' });
    }

    await Assignment.findByIdAndDelete(req.params.id);

    return res.json({ message: 'Tarea eliminada exitosamente.' });
  } catch (err: any) {
    console.error('Error al eliminar tarea:', err.message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
