import express from 'express';
import { User, Vinculacion } from '../models';
import { Course } from '../models/Course';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery, generateUserId } from '../utils/idGenerator';
import { createBulkUsers, type BulkRowInput } from '../services/bulkUserService';

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

/** Genera una contraseña aleatoria (solo para creación por Admin). No habilita login hasta activación. */
const generarPasswordAleatorio = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
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
// GET /api/users/relaciones/:userId - Obtener relaciones padre-hijo de un usuario
router.get('/relaciones/:userId', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const admin = await User.findById(normalizedUserId).select('rol colegioId').lean();
    
    if (!admin || admin.rol !== 'admin-general-colegio') {
      return res.status(403).json({ message: 'Solo administradores generales del colegio pueden acceder' });
    }

    const { userId } = req.params;
    const usuario = await User.findById(normalizeIdForQuery(userId)).select('rol').lean();
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (usuario.rol === 'estudiante') {
      // Obtener padres vinculados
      const vinculaciones = await Vinculacion.find({
        estudianteId: normalizeIdForQuery(userId),
        colegioId: admin.colegioId,
      })
        .populate('padreId', 'nombre email')
        .select('padreId')
        .lean();
      
      return res.json({
        tipo: 'estudiante',
        padres: vinculaciones.map((v: any) => ({
          _id: v.padreId._id,
          nombre: v.padreId.nombre,
          email: v.padreId.email,
        })),
      });
    } else if (usuario.rol === 'padre') {
      // Obtener hijos vinculados
      const vinculaciones = await Vinculacion.find({
        padreId: normalizeIdForQuery(userId),
        colegioId: admin.colegioId,
      })
        .populate('estudianteId', 'nombre email curso')
        .select('estudianteId')
        .lean();
      
      return res.json({
        tipo: 'padre',
        hijos: vinculaciones.map((v: any) => ({
          _id: v.estudianteId._id,
          nombre: v.estudianteId.nombre,
          email: v.estudianteId.email,
          curso: v.estudianteId.curso,
        })),
      });
    }

    return res.json({ tipo: usuario.rol, padres: [], hijos: [] });
  } catch (error: any) {
    console.error('Error al obtener relaciones:', error.message);
    res.status(500).json({ message: 'Error al obtener relaciones.' });
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

    if (user.rol !== 'admin-general-colegio' && user.rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo administradores del colegio pueden acceder a esta ruta' });
    }

    let { rol } = req.query;
    if (!rol || typeof rol !== 'string') {
      return res.status(400).json({ message: 'El parámetro "rol" es requerido' });
    }
    rol = rol.trim().toLowerCase();
    // Aceptar plural o singular: estudiantes→estudiante, profesores→profesor, padres→padre, directivos→directivo
    const rolMap: Record<string, string> = {
      estudiantes: 'estudiante',
      profesores: 'profesor',
      padres: 'padre',
      directivos: 'directivo',
    };
    const rolNormalizado = rolMap[rol] || rol;

    const rolesPermitidos = ['estudiante', 'profesor', 'padre', 'directivo'];
    if (!rolesPermitidos.includes(rolNormalizado)) {
      return res.status(400).json({ message: `Rol no permitido. Roles permitidos: ${rolesPermitidos.join(', ')}` });
    }

    const usuarios = await User.find({
      colegioId: user.colegioId,
      rol: rolNormalizado
    })
    .select(rolNormalizado === 'profesor' ? 'nombre email curso estado createdAt userId codigoUnico telefono celular materias' : 'nombre email curso estado createdAt userId codigoUnico telefono celular')
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
      materias: (usr as any).materias,
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
// Accesible por admin-general-colegio y directivo
router.get('/stats', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId).select('rol colegioId');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.rol !== 'admin-general-colegio' && user.rol !== 'school_admin' && user.rol !== 'directivo') {
      return res.status(403).json({ message: 'Solo administradores del colegio o directivos pueden acceder a esta ruta' });
    }

    const colegioId = user.colegioId;

    // Contar usuarios por rol
    const [estudiantes, profesores, padres, directivos] = await Promise.all([
      User.countDocuments({ colegioId, rol: 'estudiante' }),
      User.countDocuments({ colegioId, rol: 'profesor' }),
      User.countDocuments({ colegioId, rol: 'padre' }),
      User.countDocuments({ colegioId, rol: 'directivo' }),
    ]);

    const { Group } = await import('../models/Group');
    const cursos = await Group.countDocuments({ colegioId });
    const materias = await Course.countDocuments({ colegioId });

    // Resumen de asistencia del mes actual
    const { Asistencia } = await import('../models/Asistencia');
    const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
    const asistenciasMes = await Asistencia.find({
      colegioId,
      fecha: { $gte: startMonth, $lte: endMonth },
    }).lean();
    const presentesMes = asistenciasMes.filter((a) => a.estado === 'presente').length;
    const asistenciaResumen = {
      totalRegistros: asistenciasMes.length,
      presentes: presentesMes,
      porcentajePromedio: asistenciasMes.length > 0 ? Math.round((presentesMes / asistenciasMes.length) * 100) : 0,
    };

    // KPIs de tesorería (mismo colegio)
    const { Factura, Pago } = await import('../models');
    const [facturasPendientes, ingresosMes] = await Promise.all([
      Factura.countDocuments({ colegioId, estado: 'pendiente' }),
      Pago.aggregate([
        { $match: { colegioId, estado: 'completado', fecha: { $gte: startMonth, $lte: endMonth } } },
        { $group: { _id: null, total: { $sum: '$monto' } } },
      ]).then((r) => (r[0]?.total ?? 0) as number),
    ]);

    res.json({
      estudiantes,
      profesores,
      padres,
      directivos,
      cursos,
      materias,
      asistenciaResumen,
      treasuryResumen: { facturasPendientes, ingresosMes },
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

    if (user.rol !== 'admin-general-colegio' && user.rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo administradores del colegio pueden crear usuarios.' });
    }

    const { nombre, email, rol, curso, telefono, celular, materias: materiasBody, materia, cursos } = req.body;
    // Profesor: aceptar "materia" (string) o "materias" (array); la materia es un campo del profesor, no entidad independiente
    const materias = rol === 'profesor' && (materia != null || materiasBody != null)
      ? (Array.isArray(materiasBody) ? materiasBody : (materia != null ? [materia] : materiasBody ? [materiasBody] : []))
      : undefined;

    // TODOS los roles: solo nombre y email. Contraseña auto-generada. Estado según rol.
    if (!nombre || !email || !rol) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, email, rol' });
    }

    // Validar rol
    const rolesPermitidos = ['estudiante', 'profesor', 'padre', 'directivo'];
    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({ message: `Rol no permitido. Roles permitidos: ${rolesPermitidos.join(', ')}` });
    }

    // Verificar si el correo ya existe
    const existing = await User.findOne({ 
      $or: [
        { email: (email || '').toLowerCase() },
        { correo: (email || '').toLowerCase() }
      ]
    });
    
    if (existing) {
      return res.status(400).json({ message: 'El correo ya está registrado.' });
    }

    const esEstudiante = rol === 'estudiante';
    const codigoUnico = await generarCodigoUnico();
    const passwordPlain = generarPasswordAleatorio(); // TODOS generan contraseña aleatoria

    const newUser = new User({
      nombre,
      correo: email.toLowerCase(),
      email: email.toLowerCase(),
      password: passwordPlain,
      rol,
      colegioId: user.colegioId, // Automáticamente del colegio del admin
      estado: esEstudiante ? 'pendiente_vinculacion' : 'active',
      curso: undefined, // No se asigna curso al crear
      materias: rol === 'profesor' && materias ? (Array.isArray(materias) ? materias : [materias]) : undefined,
      codigoUnico,
      telefono,
      celular,
      configuraciones: {},
    });

    const userIdInfo = generateUserId(rol, newUser._id);
    newUser.userId = userIdInfo.fullId;

    await newUser.save();

    // Si es profesor con materias (nombres de materia, ej. "Matemáticas"): solo se guardan en User.materias.
    // La asignación a grupos se hace después con POST /api/courses/assign-professor-to-groups.
    // Si materias fueran IDs de Course existentes, se podría enlazar aquí; por defecto son nombres.
    if (rol === 'profesor' && materias && Array.isArray(materias) && materias.length > 0) {
      const areIds = materias.every((m: any) => typeof m === 'string' && m.length === 24 && /^[a-f0-9]+$/i.test(m));
      if (areIds) {
        try {
          const { Course } = await import('../models/Course');
          const profesorObjId = newUser._id;
          await Course.updateMany(
            { _id: { $in: materias }, colegioId: user.colegioId },
            { $addToSet: { profesorIds: profesorObjId } }
          );
        } catch (error: any) {
          console.error('[USERS] Error al asignar materias al profesor:', error.message);
        }
      }
    }

    // TODOS devuelven passwordTemporal
    res.status(201).json({
      message: esEstudiante 
        ? 'Estudiante creado. Debe vincularse con al menos un padre y luego activar la cuenta.'
        : 'Usuario creado exitosamente',
      user: {
        _id: newUser._id,
        nombre: newUser.nombre,
        email: newUser.email,
        rol: newUser.rol,
        userId: newUser.userId,
        codigoUnico: newUser.codigoUnico,
        estado: newUser.estado,
        passwordTemporal: passwordPlain, // Siempre devolver contraseña temporal
      },
    });
  } catch (error: any) {
    console.error('Error al crear usuario:', error.message);
    res.status(500).json({ message: 'Error en el servidor al crear el usuario.' });
  }
});

// =========================================================================
// POST /api/users/bulk - Creación masiva de usuarios (admin-general-colegio)
// Body: { rows: BulkRowInput[] } con nombre, apellido?, email, rol, codigo_interno?, curso_grupo?
// Rol: student | teacher | parent (o estudiante | profesor | padre)
// =========================================================================
router.post('/bulk', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const admin = await User.findById(normalizedUserId).select('rol colegioId').lean();
    if (!admin || (admin.rol !== 'admin-general-colegio' && admin.rol !== 'school_admin')) {
      return res.status(403).json({
        message: 'Solo administradores del colegio pueden realizar carga masiva de usuarios.',
      });
    }
    const colegioId = admin.colegioId;
    if (!colegioId) {
      return res.status(400).json({ message: 'Colegio no definido para el administrador.' });
    }

    const { rows } = req.body as { rows?: BulkRowInput[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        message: 'Se requiere un array "rows" con al menos una fila. Cada fila: nombre, apellido?, email, rol, codigo_interno?, curso_grupo?',
      });
    }

    const result = await createBulkUsers(rows, colegioId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error en carga masiva de usuarios:', error.message);
    res.status(500).json({ message: 'Error en el servidor al procesar la carga masiva.' });
  }
});

// =========================================================================
// POST /api/users/reset-password - Restablecer contraseña de un usuario (admin del colegio)
// Body: { userId: string }. Genera contraseña aleatoria y la devuelve (solo en la respuesta).
// =========================================================================
router.post('/reset-password', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedAdminId = normalizeIdForQuery(req.userId || '');
    const admin = await User.findById(normalizedAdminId).select('rol colegioId').lean();
    if (!admin || (admin.rol !== 'admin-general-colegio' && admin.rol !== 'school_admin')) {
      return res.status(403).json({ message: 'Solo administradores del colegio pueden restablecer contraseñas.' });
    }
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      return res.status(400).json({ message: 'Falta userId.' });
    }
    const targetId = normalizeIdForQuery(userId);
    const target = await User.findById(targetId).select('colegioId nombre email').lean();
    if (!target) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    if (target.colegioId !== admin.colegioId) {
      return res.status(403).json({ message: 'No puedes restablecer la contraseña de un usuario de otro colegio.' });
    }
    const newPassword = generarPasswordAleatorio();
    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    targetUser.password = newPassword;
    await targetUser.save(); // pre('save') hashea la contraseña
    res.status(200).json({
      message: 'Contraseña restablecida. Comparte la nueva contraseña con el usuario.',
      passwordTemporal: newPassword,
    });
  } catch (error: any) {
    console.error('Error al restablecer contraseña:', error.message);
    res.status(500).json({ message: 'Error en el servidor al restablecer la contraseña.' });
  }
});

// =========================================================================
// Helper: solo admin-general-colegio, mismo colegio
// =========================================================================
const ensureAdminColegio = async (req: AuthRequest) => {
  const uid = normalizeIdForQuery(req.userId || '');
  const u = await User.findById(uid).select('rol colegioId').lean();
  if (!u || u.rol !== 'admin-general-colegio') {
    return { ok: false, status: 403, message: 'Solo administradores generales del colegio pueden realizar esta acción.' };
  }
  return { ok: true, user: u };
};

// =========================================================================
// GET /api/users/me/hijos - Para rol padre: listar hijos vinculados
// =========================================================================
router.get('/me/hijos', protect, async (req: AuthRequest, res) => {
  try {
    const userId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(userId).select('rol colegioId').lean();
    if (!user || user.rol !== 'padre') {
      return res.status(403).json({ message: 'Solo padres pueden acceder a esta ruta.' });
    }
    const list = await Vinculacion.find({
      padreId: userId,
      colegioId: user.colegioId,
    })
      .populate('estudianteId', 'nombre correo email curso')
      .lean();
    const hijos = list
      .filter((v: any) => v.estudianteId)
      .map((v: any) => ({
        _id: v.estudianteId._id,
        nombre: v.estudianteId.nombre,
        correo: v.estudianteId.correo || v.estudianteId.email,
        curso: v.estudianteId.curso,
      }));
    return res.json(hijos);
  } catch (e: any) {
    console.error('Error en GET /me/hijos:', e.message);
    res.status(500).json({ message: 'Error al listar hijos.' });
  }
});

// =========================================================================
// GET /api/users/vinculaciones - Listar vinculaciones (por estudiante o por padre)
// =========================================================================
router.get('/vinculaciones', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdminColegio(req);
    if (!check.ok) return res.status((check as any).status).json({ message: (check as any).message });

    const { estudianteId, padreId } = req.query;
    const colegioId = (check as any).user.colegioId;

    if (estudianteId) {
      const list = await Vinculacion.find({
        estudianteId: normalizeIdForQuery(estudianteId as string),
        colegioId,
      })
        .populate('padreId', 'nombre email')
        .populate('estudianteId', 'nombre email curso estado')
        .lean();
      return res.json(list);
    }
    if (padreId) {
      const list = await Vinculacion.find({
        padreId: normalizeIdForQuery(padreId as string),
        colegioId,
      })
        .populate('padreId', 'nombre email')
        .populate('estudianteId', 'nombre email curso estado')
        .lean();
      return res.json(list);
    }
    return res.status(400).json({ message: 'Indica estudianteId o padreId en query.' });
  } catch (e: any) {
    console.error('Error en GET /vinculaciones:', e.message);
    res.status(500).json({ message: 'Error al listar vinculaciones.' });
  }
});

// =========================================================================
// POST /api/users/vinculaciones - Crear vinculación padre–estudiante
// =========================================================================
router.post('/vinculaciones', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdminColegio(req);
    if (!check.ok) return res.status((check as any).status).json({ message: (check as any).message });

    const { padreId, estudianteId } = req.body;
    const colegioId = (check as any).user.colegioId;

    if (!padreId || !estudianteId) {
      return res.status(400).json({ message: 'Faltan padreId y estudianteId.' });
    }

    const padre = await User.findById(normalizeIdForQuery(padreId)).select('rol colegioId').lean();
    const estudiante = await User.findById(normalizeIdForQuery(estudianteId)).select('rol colegioId').lean();

    if (!padre || padre.rol !== 'padre') return res.status(404).json({ message: 'Padre no encontrado.' });
    if (!estudiante || estudiante.rol !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (padre.colegioId !== colegioId || estudiante.colegioId !== colegioId) {
      return res.status(403).json({ message: 'Padre y estudiante deben ser del mismo colegio.' });
    }

    const existente = await Vinculacion.findOne({
      padreId: normalizeIdForQuery(padreId),
      estudianteId: normalizeIdForQuery(estudianteId),
    });
    if (existente) return res.status(400).json({ message: 'Esta vinculación ya existe.' });

    const v = await Vinculacion.create({
      padreId: normalizeIdForQuery(padreId),
      estudianteId: normalizeIdForQuery(estudianteId),
      colegioId,
    });

    res.status(201).json({ message: 'Vinculación creada.', vinculacion: v });
  } catch (e: any) {
    if (e.code === 11000) return res.status(400).json({ message: 'Esta vinculación ya existe.' });
    console.error('Error en POST /vinculaciones:', e.message);
    res.status(500).json({ message: 'Error al crear vinculación.' });
  }
});

// =========================================================================
// POST /api/users/confirmar-vinculacion - Confirmar vinculación → estado VINCULADO
// =========================================================================
router.post('/confirmar-vinculacion', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdminColegio(req);
    if (!check.ok) return res.status((check as any).status).json({ message: (check as any).message });

    const { estudianteId } = req.body;
    const colegioId = (check as any).user.colegioId;

    if (!estudianteId) return res.status(400).json({ message: 'Falta estudianteId.' });

    const links = await Vinculacion.find({
      estudianteId: normalizeIdForQuery(estudianteId),
      colegioId,
    }).lean();

    if (links.length === 0) {
      return res.status(400).json({ message: 'El estudiante debe tener al menos un padre vinculado antes de confirmar.' });
    }

    const estudiante = await User.findById(normalizeIdForQuery(estudianteId)).select('rol colegioId estado').lean();
    if (!estudiante || estudiante.rol !== 'estudiante' || estudiante.colegioId !== colegioId) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    const padreIds = links.map((l: any) => l.padreId.toString());

    await User.updateOne(
      { _id: normalizeIdForQuery(estudianteId) },
      { $set: { estado: 'vinculado' } }
    );
    await User.updateMany(
      { _id: { $in: padreIds }, colegioId, rol: 'padre' },
      { $set: { estado: 'vinculado' } }
    );

    res.json({
      message: 'Vinculación confirmada. Estudiante y padres vinculados pasan a estado VINCULADO.',
      estudianteId,
      padresActualizados: padreIds.length,
    });
  } catch (e: any) {
    console.error('Error en POST /confirmar-vinculacion:', e.message);
    res.status(500).json({ message: 'Error al confirmar vinculación.' });
  }
});

// =========================================================================
// POST /api/users/activar-cuentas - Activar cuentas (estudiante + padres vinculados)
// =========================================================================
router.post('/activar-cuentas', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdminColegio(req);
    if (!check.ok) return res.status((check as any).status).json({ message: (check as any).message });

    const { estudianteId } = req.body;
    const colegioId = (check as any).user.colegioId;

    if (!estudianteId) return res.status(400).json({ message: 'Falta estudianteId.' });

    const links = await Vinculacion.find({
      estudianteId: normalizeIdForQuery(estudianteId),
      colegioId,
    }).lean();

    if (links.length === 0) {
      return res.status(400).json({
        message: 'El estudiante debe estar vinculado con al menos un padre. Completa la vinculación y confírmala antes de activar.',
      });
    }

    const estudiante = await User.findById(normalizeIdForQuery(estudianteId)).select('rol colegioId estado').lean();
    if (!estudiante || estudiante.rol !== 'estudiante' || estudiante.colegioId !== colegioId) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    if (estudiante.estado !== 'vinculado') {
      return res.status(400).json({
        message: 'Solo se pueden activar cuentas cuando el estudiante está en estado VINCULADO. Confirma la vinculación antes.',
      });
    }

    const padreIds = links.map((l: any) => l.padreId.toString());

    await User.updateOne(
      { _id: normalizeIdForQuery(estudianteId) },
      { $set: { estado: 'active' } }
    );
    await User.updateMany(
      { _id: { $in: padreIds }, colegioId, rol: 'padre' },
      { $set: { estado: 'active' } }
    );

    res.json({
      message: 'Cuentas activadas. El estudiante y los padres vinculados ya pueden iniciar sesión.',
      estudianteId,
      padresActivados: padreIds.length,
    });
  } catch (e: any) {
    console.error('Error en POST /activar-cuentas:', e.message);
    res.status(500).json({ message: 'Error al activar cuentas.' });
  }
});

export default router;