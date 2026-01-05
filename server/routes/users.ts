import express from 'express';
import { User } from '../models';
import { Course } from '../models/Course';
import { protect, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Función para generar un código único de 4 dígitos
const generarCodigoUnico = async (): Promise<string> => {
  let codigo: string;
  let existe: boolean;
  let intentos = 0;
  const maxIntentos = 1000; // Prevenir loops infinitos

  do {
    // Generar código de 4 dígitos (1000-9999)
    codigo = Math.floor(1000 + Math.random() * 9000).toString();
    const usuarioExistente = await User.findOne({ codigoUnico: codigo });
    existe = !!usuarioExistente;
    intentos++;
    
    if (intentos >= maxIntentos) {
      throw new Error('No se pudo generar un código único después de múltiples intentos.');
    }
  } while (existe);

  return codigo;
};

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
// NUEVA RUTA: GET /api/users/me/courses - Obtener materias del usuario autenticado
// Para estudiantes: busca materias asignadas a su grupo
router.get('/me/courses', protect, async (req: AuthRequest, res) => {
    try {
        const user = await User.findById(req.userId).select('rol curso colegioId');

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Para estudiantes: buscar materias por su grupo
        if (user.rol === 'estudiante') {
            const grupoId = user.curso;
            
            if (!grupoId) {
                return res.status(200).json([]);
            }

            // Buscar materias (Course) que tienen este grupo en su array 'cursos'
            const courses = await Course.find({ 
                cursos: grupoId,
                colegioId: user.colegioId || 'COLEGIO_DEMO_2025'
            })
            .populate('profesorIds', 'nombre email')
            .select('nombre descripcion colorAcento icono profesorIds');

            // Formatear respuesta para que coincida con la interfaz Course del frontend
            const formattedCourses = courses.map(course => ({
                _id: course._id,
                nombre: course.nombre,
                descripcion: course.descripcion,
                colorAcento: course.colorAcento,
                icono: course.icono,
                profesorIds: course.profesorIds,
            }));

            return res.status(200).json(formattedCourses);
        }

        // Para otros roles, devolver vacío (los profesores usan /api/professor/my-groups)
        res.status(200).json([]);

    } catch (error: any) {
        console.error('Error al obtener materias del usuario:', error.message);
        res.status(500).json({ message: 'Error en el servidor al cargar las materias.' });
    }
});

// =========================================================================
// POST /api/users/asignar-codigos - Asignar códigos únicos a usuarios existentes
// Este endpoint puede ejecutarse una vez para asignar códigos a usuarios que no los tengan
router.post('/asignar-codigos', protect, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Solo directivos pueden ejecutar esta acción
    if (user.rol !== 'directivo') {
      return res.status(403).json({ message: 'Solo directivos pueden acceder a esta ruta' });
    }

    // Buscar todos los usuarios sin código único
    const usuariosSinCodigo = await User.find({
      $or: [
        { codigoUnico: { $exists: false } },
        { codigoUnico: null },
        { codigoUnico: '' }
      ]
    });

    let asignados = 0;
    let errores = 0;

    for (const usuario of usuariosSinCodigo) {
      try {
        const codigo = await generarCodigoUnico();
        usuario.codigoUnico = codigo;
        await usuario.save();
        asignados++;
      } catch (error: any) {
        console.error(`Error al asignar código a usuario ${usuario._id}:`, error.message);
        errores++;
      }
    }

    res.json({
      message: 'Proceso completado',
      usuariosProcesados: usuariosSinCodigo.length,
      codigosAsignados: asignados,
      errores: errores
    });
  } catch (error: any) {
    console.error('Error al asignar códigos:', error.message);
    res.status(500).json({ message: 'Error en el servidor al asignar códigos.' });
  }
});


export default router;