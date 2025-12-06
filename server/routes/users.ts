import express from 'express';
import { User } from '../models'; // Asegúrate de que los modelos User y Course estén disponibles vía '../models'
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

// =========================================================================
// RUTA EXISTENTE: GET /api/users/profesores - Obtener todos los profesores
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

// =========================================================================
// NUEVA RUTA: GET /api/users/me/courses - Obtener materias del usuario autenticado (Etapa 3)
router.get('/me/courses', protect, async (req: AuthRequest, res) => {
    try {
        const user = await User.findById(req.userId)
            .populate({
                path: 'materias', // Array de IDs de cursos en el modelo User
                model: 'Course', 
                // Selecciona solo los campos que la interfaz de estudiante necesita
                select: 'nombre descripcion colorAcento icono profesorIds', 
                populate: {
                    path: 'profesorIds', // Pobla los profesores dentro de cada curso
                    model: 'User',
                    select: 'nombre email' // Campos del profesor
                }
            })
            .select('materias'); // Solo necesitamos el campo 'materias' del usuario

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // El array 'materias' ya contiene los documentos de Course completamente poblados
        res.status(200).json(user.materias || []);

    } catch (error: any) {
        console.error('Error al obtener materias del usuario:', error.message);
        res.status(500).json({ message: 'Error en el servidor al cargar las materias.' });
    }
});


export default router;