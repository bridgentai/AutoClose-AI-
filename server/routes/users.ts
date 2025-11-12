import express from 'express';
import { User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/users/profesores - Obtener todos los profesores de la institución (solo directivos)
router.get('/profesores', protect, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Solo directivos pueden ver la lista de profesores
    if (user.rol !== 'directivo') {
      return res.status(403).json({ message: 'Solo directivos pueden acceder a esta ruta' });
    }

    // Obtener todos los profesores del mismo colegio
    const profesores = await User.find({
      colegioId: user.colegioId,
      rol: 'profesor'
    })
      .select('nombre email materias createdAt')
      .sort({ nombre: 1 });

    res.json(profesores);
  } catch (error: any) {
    console.error('Error al obtener profesores:', error.message);
    res.status(500).json({ message: 'Error en el servidor al cargar los profesores.' });
  }
});

export default router;
