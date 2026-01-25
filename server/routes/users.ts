import express from 'express';
import { User } from '../models';
import { Course } from '../models/Course';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery, generateUserId } from '../utils/idGenerator';

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
const normalizedUserId = normalizeIdForQuery(req.userId || '');
const user = await User.findById(normalizedUserId);
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
.select('nombre email materias createdAt userId')
.sort({ nombre: 1 });

// Incluir userId categorizado en la respuesta
const profesoresConId = profesores.map(prof => ({
  _id: prof._id,
  id: prof._id.toString(),
  userId: prof.userId || generateUserId(prof.rol, prof._id).fullId,
  nombre: prof.nombre,
  email: prof.email,
  materias: prof.materias,
  createdAt: prof.createdAt,
}));

res.json(profesoresConId);
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
        const normalizedUserId = normalizeIdForQuery(req.userId || '');
        const user = await User.findById(normalizedUserId).select('rol curso colegioId');

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Para estudiantes: buscar materias por su grupo
        if (user.rol === 'estudiante') {
            const grupoId = user.curso;
            
            if (!grupoId) {
                return res.status(200).json([]);
            }

            // Normalizar grupoId para búsqueda consistente (mayúsculas)
            const grupoIdNormalizado = (grupoId as string).toUpperCase().trim();
            const colegioId = user.colegioId || 'COLEGIO_DEMO_2025';

            console.log(`[DEBUG /api/users/me/courses] Buscando materias para estudiante:`);
            console.log(`  - Estudiante ID: ${normalizedUserId}`);
            console.log(`  - Grupo del estudiante: ${grupoId} (normalizado: ${grupoIdNormalizado})`);
            console.log(`  - ColegioId: ${colegioId}`);

            // Buscar materias (Course) que tienen este grupo en su array 'cursos'
            // MongoDB busca directamente en arrays: { cursos: valor } busca si valor está en el array
            // Usamos $or para buscar variantes normalizadas
            const courses = await Course.find({ 
                $or: [
                    { cursos: grupoIdNormalizado },
                    { cursos: grupoIdNormalizado.toLowerCase() },
                    { cursos: grupoId as string }
                ],
                colegioId: colegioId
            })
            .populate('profesorIds', 'nombre apellido email')
            .select('nombre descripcion colorAcento icono profesorIds cursos')
            .lean();

            console.log(`[DEBUG /api/users/me/courses] Encontradas ${courses.length} materias`);
            courses.forEach(course => {
                console.log(`  - ${course.nombre}: cursos=${JSON.stringify(course.cursos)}`);
            });

            // Formatear respuesta para que coincida con la interfaz Course del frontend
            const formattedCourses = courses.map(course => ({
                _id: course._id,
                nombre: course.nombre,
                descripcion: course.descripcion,
                colorAcento: course.colorAcento,
                icono: course.icono,
                profesorIds: course.profesorIds || [],
                cursos: course.cursos || [],
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
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId);
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


// =========================================================================
// GET /api/users/by-role - Obtener usuarios por rol (para admin-general-colegio)
// Permite filtrar por rol y colegioId del usuario autenticado
router.get('/by-role', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId).select('rol colegioId');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Solo admin-general-colegio puede acceder
    if (user.rol !== 'admin-general-colegio') {
      return res.status(403).json({ message: 'Solo administradores generales del colegio pueden acceder a esta ruta' });
    }

    const { rol } = req.query;
    
    if (!rol || typeof rol !== 'string') {
      return res.status(400).json({ message: 'El parámetro "rol" es requerido' });
    }

    // Validar que el rol sea uno permitido
    const rolesPermitidos = ['estudiante', 'profesor', 'padre', 'directivo'];
    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({ message: `Rol no permitido. Roles permitidos: ${rolesPermitidos.join(', ')}` });
    }

    // Obtener usuarios del mismo colegio y rol
    const usuarios = await User.find({
      colegioId: user.colegioId,
      rol: rol
    })
    .select('nombre email curso estado createdAt userId codigoUnico telefono celular')
    .sort({ nombre: 1 })
    .lean();

    // Incluir userId categorizado
    const usuariosConId = usuarios.map(usr => ({
      _id: usr._id,
      id: usr._id.toString(),
      userId: usr.userId || generateUserId(usr.rol as string, usr._id).fullId,
      nombre: usr.nombre,
      email: usr.email || usr.correo,
      curso: usr.curso,
      estado: usr.estado || 'active',
      codigoUnico: usr.codigoUnico,
      telefono: usr.telefono,
      celular: usr.celular,
      createdAt: usr.createdAt,
    }));

    res.json(usuariosConId);
  } catch (error: any) {
    console.error('Error al obtener usuarios por rol:', error.message);
    res.status(500).json({ message: 'Error en el servidor al cargar los usuarios.' });
  }
});

// =========================================================================
// GET /api/users/stats - Obtener estadísticas del colegio (KPIs)
router.get('/stats', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId).select('rol colegioId');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Solo admin-general-colegio puede acceder
    if (user.rol !== 'admin-general-colegio') {
      return res.status(403).json({ message: 'Solo administradores generales del colegio pueden acceder a esta ruta' });
    }

    // Contar usuarios por rol
    const [estudiantes, profesores, padres, directivos] = await Promise.all([
      User.countDocuments({ colegioId: user.colegioId, rol: 'estudiante' }),
      User.countDocuments({ colegioId: user.colegioId, rol: 'profesor' }),
      User.countDocuments({ colegioId: user.colegioId, rol: 'padre' }),
      User.countDocuments({ colegioId: user.colegioId, rol: 'directivo' }),
    ]);

    // Contar cursos/grupos (usando Group model)
    const { Group } = await import('../models/Group');
    const cursos = await Group.countDocuments({ colegioId: user.colegioId });

    // Contar materias
    const materias = await Course.countDocuments({ colegioId: user.colegioId });

    res.json({
      estudiantes,
      profesores,
      padres,
      directivos,
      cursos,
      materias,
    });
  } catch (error: any) {
    console.error('Error al obtener estadísticas:', error.message);
    res.status(500).json({ message: 'Error en el servidor al cargar las estadísticas.' });
  }
});

// =========================================================================
// POST /api/users/create - Crear usuario (solo para admin-general-colegio)
// Permite crear usuarios sin código de acceso
router.post('/create', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId).select('rol colegioId');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Solo admin-general-colegio puede crear usuarios
    if (user.rol !== 'admin-general-colegio') {
      return res.status(403).json({ message: 'Solo administradores generales del colegio pueden crear usuarios' });
    }

    const { nombre, email, password, rol, curso, telefono, celular } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, email, password, rol' });
    }

    // Validar rol
    const rolesPermitidos = ['estudiante', 'profesor', 'padre', 'directivo'];
    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({ message: `Rol no permitido. Roles permitidos: ${rolesPermitidos.join(', ')}` });
    }

    // Verificar si el correo ya existe
    const existing = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { correo: email.toLowerCase() }
      ]
    });
    
    if (existing) {
      return res.status(400).json({ message: 'El correo ya está registrado.' });
    }

    // Generar código único
    const codigoUnico = await generarCodigoUnico();

    // Crear usuario
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      nombre,
      correo: email.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      rol,
      colegioId: user.colegioId,
      estado: 'active',
      curso: rol === 'estudiante' ? curso?.toUpperCase().trim() : undefined,
      codigoUnico,
      telefono,
      celular,
      configuraciones: {},
    });

    // Generar userId categorizado
    const userIdInfo = generateUserId(rol, newUser._id);
    newUser.userId = userIdInfo.fullId;

    await newUser.save();

    // Si es estudiante y tiene curso, sincronizar con grupo
    if (rol === 'estudiante' && curso) {
      try {
        const { syncEstudianteToGroup } = await import('../services/syncService');
        await syncEstudianteToGroup(newUser._id.toString(), curso.toUpperCase().trim(), user.colegioId);
      } catch (syncError: any) {
        console.error('[USERS] Error al sincronizar estudiante con grupo:', syncError.message);
        // No fallar la creación del usuario si falla la sincronización
      }
    }

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: {
        _id: newUser._id,
        nombre: newUser.nombre,
        email: newUser.email,
        rol: newUser.rol,
        userId: newUser.userId,
        codigoUnico: newUser.codigoUnico,
      },
    });
  } catch (error: any) {
    console.error('Error al crear usuario:', error.message);
    res.status(500).json({ message: 'Error en el servidor al crear el usuario.' });
  }
});

export default router;