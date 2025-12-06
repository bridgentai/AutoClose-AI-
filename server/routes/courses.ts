import express, { Request, Response, NextFunction } from 'express';
import { Course, User } from '../models'; // Asegúrate de que los modelos Course y User estén importados aquí
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Middleware de autorización para Directivo (Reutilizable)
const checkIsDirectivo = (req: AuthRequest, res: Response, next: NextFunction) => {
    // req.user viene del middleware 'protect'
    if (req.user && req.user.rol === 'directivo') {
        next();
    } else {
        res.status(403).json({ message: 'Acceso denegado. Solo Directivos pueden realizar esta acción.' });
    }
};

// =========================================================================
// RUTA ACTUALIZADA (ADAPTADA AL ARRAY profesorIds)
// GET /api/courses - Obtener cursos según el rol
router.get('/', protect, async (req: AuthRequest, res) => {
try {
const user = await User.findById(req.userId);
if (!user) {
return res.status(404).json({ message: 'Usuario no encontrado' });
}

// Filtrar cursos según el rol del usuario
let query: any = { colegioId: user.colegioId };

// Si es profesor, solo mostrar cursos donde él está en la lista de profesores asignados
if (user.rol === 'profesor') {
query.profesorIds = user._id; // <--- ADAPTACIÓN a profesorIds (array)
}
// Si es estudiante, el filtro se hará mejor en la ruta específica (GET /api/users/me/courses)

const courses = await Course.find(query)
.populate('profesorIds', 'nombre email') // <--- ADAPTACIÓN a profesorIds (array)
.sort({ nombre: 1 });

res.json(courses);
} catch (error: any) {
console.error('Error al obtener cursos:', error.message);
res.status(500).json({ message: 'Error en el servidor al cargar los cursos.' });
}
});

// =========================================================================
// RUTA ACTUALIZADA (ADAPTADA AL ARRAY profesorIds)
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
profesorIds: user._id, // <--- ADAPTACIÓN a profesorIds (array)
cursos: grupo,
colegioId: user.colegioId
}).sort({ nombre: 1 });

res.json(courses);
} catch (error: any) {
console.error('Error al obtener materias para grupo:', error.message);
res.status(500).json({ message: 'Error en el servidor.' });
}
});

// =========================================================================
// RUTA ACTUALIZADA (ADAPTADA AL ARRAY profesorIds)
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
// Inicializar el array de profesores con el ID del creador (profesor o directivo)
const profesorIds = user.rol === 'profesor' ? [user._id] : [];

const nuevoCurso = await Course.create({
colegioId: user.colegioId,
nombre,
descripcion,
profesorIds: profesorIds, // <--- ADAPTACIÓN a profesorIds (array)
cursos: Array.isArray(cursos) ? cursos : [],
colorAcento: colorAcento || '#9f25b8',
icono,
});

// Si el creador es profesor, añadir el curso a su lista de materias
if (user.rol === 'profesor') {
await User.findByIdAndUpdate(user._id, { $addToSet: { materias: nuevoCurso._id } });
}

res.status(201).json(nuevoCurso);
} catch (error: any) {
console.error('Error al crear curso:', error.message);
res.status(500).json({ message: 'Error en el servidor al crear el curso.' });
}
});

// =========================================================================
// RUTA ACTUALIZADA: PUT /api/courses/assign-professor (NUEVA RUTA DE ASIGNACIÓN)
// Función: Asigna un profesor a un curso y viceversa. Solo para Directivos.
router.put('/assign-professor', protect, checkIsDirectivo, async (req: AuthRequest, res) => {
    try {
        const { courseId, professorId } = req.body;

        if (!courseId || !professorId) {
            return res.status(400).json({ message: 'Se requiere el ID del curso y el ID del profesor.' });
        }

        // 1. Encontrar y actualizar el Curso (añadir el profesor al array)
        const course = await Course.findByIdAndUpdate(
            courseId,
            { $addToSet: { profesorIds: professorId } },
            { new: true }
        );

        if (!course) {
            return res.status(404).json({ message: 'Curso no encontrado.' });
        }

        // 2. Encontrar y actualizar el Profesor (añadir el curso a su lista de materias)
        const professor = await User.findByIdAndUpdate(
            professorId,
            { $addToSet: { materias: courseId } },
            { new: true }
        );

        if (!professor || professor.rol !== 'profesor') {
            // Revertir el cambio en el curso si el profesor no se encuentra o no es profesor
            await Course.findByIdAndUpdate(courseId, { $pull: { profesorIds: professorId } });
            return res.status(404).json({ message: 'Profesor no encontrado o rol incorrecto.' });
        }

        res.status(200).json({ 
            message: `Profesor ${professor.nombre} asignado correctamente al curso ${course.nombre}.`,
            course,
            professor
        });

    } catch (error) {
        console.error('Error al asignar profesor:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar la asignación.' });
    }
});

// =========================================================================
// RUTA ACTUALIZADA: PUT /api/courses/enroll-students (NUEVA RUTA DE INSCRIPCIÓN)
// Función: Inscribe una lista de estudiantes a un curso y viceversa. Solo para Directivos.
router.put('/enroll-students', protect, checkIsDirectivo, async (req: AuthRequest, res) => {
    try {
        const { courseId, studentIds } = req.body; // studentIds debe ser un array

        if (!courseId || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: 'Se requiere el ID del curso y una lista de IDs de estudiantes.' });
        }

        // 1. Encontrar y actualizar el Curso (añadir todos los estudiantes al array)
        const course = await Course.findByIdAndUpdate(
            courseId,
            { $addToSet: { estudianteIds: { $each: studentIds } } },
            { new: true }
        );

        if (!course) {
            return res.status(404).json({ message: 'Curso no encontrado.' });
        }

        // 2. Encontrar y actualizar los Estudiantes (añadir el curso a su lista de materias)
        // Usamos updateMany para eficiencia en la base de datos
        await User.updateMany(
            { _id: { $in: studentIds }, rol: 'estudiante' },
            { $addToSet: { materias: courseId } }
        );

        res.status(200).json({ 
            message: `Se inscribieron ${studentIds.length} estudiantes al curso ${course.nombre}.`,
            course
        });

    } catch (error) {
        console.error('Error al inscribir estudiantes:', error);
        res.status(500).json({ message: 'Error interno del servidor al procesar la inscripción.' });
    }
});

// =========================================================================
// OTRAS RUTAS (Se mantienen, pero se pueden refactorizar)
// PUT /api/courses/:id - Actualizar curso
router.put('/:id', protect, async (req: AuthRequest, res) => {
    // ... (El código de actualización se mantiene igual)
    // Nota: Esta ruta debería ser adaptada para manejar profesorIds si se usa para cambiar la asignación
    // ...
});

// POST /api/courses/assign - Asignar grupos a profesor (solo directivos)
// ESTA RUTA ESTÁ DUPLICANDO LA LÓGICA DE 'assign-professor' y 'enroll-students' 
// y usa lógica antigua (profesorId, nombre de materia). 
// Recomiendo ELIMINAR O REFACTORIZAR esta ruta y usar las nuevas de PUT.
router.post('/assign', protect, async (req: AuthRequest, res) => {
    // ... (El código existente se mantiene, pero tiene inconsistencias con los nuevos modelos)
    // ...
});

// DELETE /api/courses/:id - Eliminar curso
router.delete('/:id', protect, async (req: AuthRequest, res) => {
    // ... (El código de eliminación se mantiene igual)
    // ...
});


export default router;