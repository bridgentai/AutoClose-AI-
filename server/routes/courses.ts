import express, { Request, Response, NextFunction } from 'express';
import { Course, User } from '../models'; // Asegúrate de que los modelos Course y User estén importados aquí
import { protect, AuthRequest } from '../middleware/auth';
import { Types } from 'mongoose'; // Necesitamos Types para interactuar con IDs

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
// GET /api/courses/:id/details - Obtener detalles de una materia por ID
// Solo accesible para estudiantes del curso asignado a la materia
// IMPORTANTE: Esta ruta debe estar ANTES de otras rutas que usen :id para evitar conflictos
router.get('/:id/details', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] GET /api/courses/${id}/details - Usuario: ${req.userId}`);
    
    // Optimizar: solo seleccionar campos necesarios del usuario
    const user = await User.findById(req.userId).select('rol curso colegioId').lean();

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // VALIDACIÓN ESTRICTA: Solo estudiantes pueden acceder a esta ruta
    if (user.rol !== 'estudiante') {
      return res.status(403).json({ 
        message: 'Solo los estudiantes pueden acceder a los detalles de materias desde esta ruta' 
      });
    }

    // VALIDACIÓN: El estudiante debe tener un curso asignado
    if (!user.curso) {
      return res.status(403).json({ 
        message: 'No tienes un curso asignado. Contacta al administrador.' 
      });
    }

    // Buscar la materia - optimizado con .lean() y campos específicos
    const course = await Course.findById(id)
      .populate('profesorIds', 'nombre email')
      .select('nombre descripcion colorAcento icono cursos profesorIds colegioId')
      .lean();

    if (!course) {
      return res.status(404).json({ message: 'Materia no encontrada' });
    }

    // Verificar que pertenezca al mismo colegio
    if (course.colegioId !== user.colegioId) {
      return res.status(403).json({ 
        message: 'No tienes acceso a esta materia. La materia pertenece a otro colegio.' 
      });
    }

    // VALIDACIÓN CRÍTICA: Verificar que la materia se imparta en el curso del estudiante
    if (!course.cursos || !Array.isArray(course.cursos) || course.cursos.length === 0) {
      return res.status(403).json({ 
        message: 'Esta materia no está asignada a ningún curso.' 
      });
    }

    if (!course.cursos.includes(user.curso)) {
      return res.status(403).json({ 
        message: `No tienes acceso a esta materia. Esta materia se imparte en: ${course.cursos.join(', ')}. Tu curso es: ${user.curso}.` 
      });
    }

    // Formatear respuesta
    const response = {
      _id: course._id,
      nombre: course.nombre,
      descripcion: course.descripcion,
      colorAcento: course.colorAcento,
      icono: course.icono,
      cursos: course.cursos,
      cursoAsignado: user.curso,
      profesor: course.profesorIds && course.profesorIds.length > 0 
        ? {
            _id: (course.profesorIds[0] as any)._id,
            nombre: (course.profesorIds[0] as any).nombre,
            email: (course.profesorIds[0] as any).email
          }
        : null,
      profesorIds: course.profesorIds
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error al obtener materia:', error.message);
    res.status(500).json({ message: 'Error en el servidor al obtener la materia.' });
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
// Nota: req.userId es un string, pero Mongoose lo maneja al compararlo con ObjectId
const profesorIds: (string | Types.ObjectId)[] = user.rol === 'profesor' ? [user._id as Types.ObjectId] : []; 

// Buscar o crear la materia correspondiente
const { Materia } = await import('../models/Materia');
let materia = await Materia.findOne({ nombre });
if (!materia) {
  // Crear materia si no existe
  materia = await Materia.create({
    nombre,
    descripcion: descripcion || `Materia ${nombre}`,
    area: 'General', // Valor por defecto
  });
}

const nuevoCurso = await Course.create({
  nombre,
  materiaId: materia._id, // Campo requerido en nueva estructura
  profesorId: user.rol === 'profesor' ? user._id : undefined, // Campo requerido
  estudiantes: [], // Campo requerido
  // Campos adicionales para compatibilidad
  colegioId: user.colegioId,
  descripcion,
  profesorIds: profesorIds,
  cursos: Array.isArray(cursos) ? cursos : [],
  estudianteIds: [],
  colorAcento: colorAcento || '#9f25b8',
  icono,
});

// Si el creador es profesor, añadir el *NOMBRE* del curso a su lista de materias (mantiene la estructura actual)
if (user.rol === 'profesor') {
    // Si la lista de materias en el usuario es de STRINGS (nombres), añadimos el nombre.
    // Si la lista fuera de IDs, añadiríamos nuevoCurso._id. Mantenemos el nombre por tu modelo de User.ts.
    await User.findByIdAndUpdate(user._id, { $addToSet: { materias: nuevoCurso.nombre } }); 
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

// 2. Encontrar y actualizar el Profesor (añadir el curso *NOMBRE* a su lista de materias)
const professor = await User.findByIdAndUpdate(
professorId,
{ $addToSet: { materias: course.nombre } }, // Se añade el NOMBRE del curso
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

// 2. Encontrar y actualizar los Estudiantes (añadir el curso *NOMBRE* a su lista de materias)
// Usamos updateMany para eficiencia en la base de datos
await User.updateMany(
{ _id: { $in: studentIds }, rol: 'estudiante' },
{ $addToSet: { materias: course.nombre } } // Se añade el NOMBRE del curso
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
// NUEVA RUTA: GET Materia por Nombre (Para el Frontend de Asignaciones)
// GET /api/courses/by-name?name=Matemáticas
// =========================================================================
router.get('/by-name', protect, async (req: AuthRequest, res) => {
    // Acepta tanto 'name' como 'nombre' como parámetro
    const name = req.query.name || req.query.nombre;

    if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'El parámetro de nombre es obligatorio.' });
    }

    try {
        // Buscamos el curso (materia) exacto por nombre y colegio
        const course = await Course.findOne({ 
            nombre: name,
            colegioId: req.user?.colegioId // Aseguramos que solo busque en el colegio del usuario
        }).select('_id nombre cursos'); 

        if (!course) {
            return res.status(404).json({ message: 'Materia no encontrada con ese nombre en este colegio.' });
        }

        res.json(course);

    } catch (error) {
        console.error('Error al buscar materia por nombre:', error);
        res.status(500).json({ message: 'Error interno del servidor al buscar la materia.' });
    }
});


// =========================================================================
// OTRAS RUTAS (Se mantienen, pero se pueden refactorizar)
// PUT /api/courses/:id - Actualizar curso
router.put('/:id', protect, async (req: AuthRequest, res) => {
// ... (El código de actualización se mantiene igual)
// ...
});

// POST /api/courses/assign - Asignar grupos a profesor (solo directivos)
// Recomiendo ELIMINAR O REFACTORIZAR esta ruta y usar las nuevas de PUT (assign-professor, enroll-students).
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