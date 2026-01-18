import express from 'express';
import jwt from 'jsonwebtoken';
import { User, GroupStudent } from '../models';
import { generateUserId } from '../utils/idGenerator';
import { mongoConnected, mongoError } from '../config/db';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES = '30d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado');
}

// Middleware para verificar conexión a MongoDB
const checkMongoConnection = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!mongoConnected) {
    console.error('[AUTH] Error: MongoDB no está conectado');
    return res.status(503).json({ 
      message: 'Servicio no disponible. La base de datos no está conectada.',
      error: mongoError || 'MongoDB no conectado'
    });
  }
  next();
};

const generateToken = (id: string) => jwt.sign({ id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });

// Función para generar un código único de 4 dígitos
const generarCodigoUnico = async (): Promise<string> => {
  let codigo: string;
  let existe: boolean;
  let intentos = 0;
  const maxIntentos = 1000; // Prevenir loops infinitos

  do {
    // Generar código de 4 dígitos (0000-9999)
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

// Códigos de acceso por colegio (en producción esto estaría en una base de datos)
const CODIGOS_COLEGIO: Record<string, string> = {
  'COLEGIO_DEMO_2025': 'COLEGIO_DEMO_2025',
  'SAN_JOSE_2025': 'SAN_JOSE_2025',
  'SANTA_MARIA_2025': 'SANTA_MARIA_2025',
};

// Función helper para sincronizar estudiante con su grupo
// Esta función guarda o actualiza la relación estudiante-grupo en GroupStudent
// y también vincula el estudiante a los cursos existentes que tienen ese grupo
async function syncStudentToGroup(estudianteId: string, grupoId: string | undefined, colegioId: string) {
  if (!grupoId || !estudianteId) {
    console.log(`[SYNC] Saltando sincronización: grupoId=${grupoId}, estudianteId=${estudianteId}`);
    return; // No hay grupo asignado, no hacer nada
  }

  try {
    // Normalizar grupoId a mayúsculas para consistencia
    const grupoIdNormalizado = grupoId.toUpperCase().trim();
    console.log(`[SYNC] Intentando sincronizar estudiante ${estudianteId} con grupo ${grupoIdNormalizado} (colegio: ${colegioId})`);

    // Buscar o crear el grupo en la colección grupos
    const { Group } = await import('../models/Group');
    const { Course } = await import('../models/Course');
    const { Types } = await import('mongoose');
    
    let grupo = await Group.findOne({ nombre: grupoIdNormalizado, colegioId });
    
    if (!grupo) {
      // Crear el grupo si no existe
      grupo = await Group.create({
        nombre: grupoIdNormalizado,
        descripcion: `Grupo ${grupoIdNormalizado}`,
        colegioId,
      });
      console.log(`[SYNC] Grupo ${grupoIdNormalizado} creado con ID:`, grupo._id);
    }

    // Buscar si ya existe la relación en GroupStudent
    const existing = await GroupStudent.findOne({
      grupoId: grupo._id,
      estudianteId,
    });

    if (!existing) {
      // Crear nueva relación usando ObjectId del grupo
      const nuevoRegistro = await GroupStudent.create({
        grupoId: grupo._id, // Usar ObjectId del grupo
        estudianteId,
        colegioId
      });
      console.log(`[SYNC] ✅ Estudiante ${estudianteId} agregado al grupo ${grupoIdNormalizado}`, nuevoRegistro._id);
    } else {
      console.log(`[SYNC] ℹ️ Estudiante ${estudianteId} ya está en el grupo ${grupoIdNormalizado}`);
    }

    // CRÍTICO: Actualizar cursos existentes que tienen este grupo asignado
    // para vincular automáticamente al estudiante
    const estudianteObjectId = new Types.ObjectId(estudianteId);
    const cursosActualizados = await Course.updateMany(
      {
        cursos: grupoIdNormalizado, // Cursos que tienen este grupo en su array
        colegioId,
        estudianteIds: { $ne: estudianteObjectId } // Que no tengan ya este estudiante
      },
      {
        $addToSet: {
          estudianteIds: estudianteObjectId, // Agregar estudiante si no existe
          estudiantes: estudianteObjectId // También actualizar el array legacy
        }
      }
    );

    if (cursosActualizados.modifiedCount > 0) {
      console.log(`[SYNC] ✅ Estudiante ${estudianteId} vinculado a ${cursosActualizados.modifiedCount} curso(s) existente(s) del grupo ${grupoIdNormalizado}`);
    } else {
      console.log(`[SYNC] ℹ️ No se encontraron cursos nuevos para vincular al estudiante ${estudianteId}`);
    }

  } catch (error: any) {
    // Si es error de duplicado, ignorar (ya existe)
    if (error.code === 11000) {
      console.log(`[SYNC] ℹ️ Relación ya existe para estudiante ${estudianteId} en grupo ${grupoId}`);
    } else {
      console.error(`[SYNC] ❌ Error al sincronizar estudiante ${estudianteId} con grupo ${grupoId}:`, error.message);
      console.error(`[SYNC] Stack:`, error.stack);
      // No lanzar el error, solo loguearlo para no interrumpir el registro
    }
  }
}

// POST /api/auth/register
router.post('/register', checkMongoConnection, async (req, res) => {
  try {
    const { nombre, email, password, rol, curso, codigoAcceso, hijoId, materias } = req.body;

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    if (!['estudiante', 'profesor', 'directivo', 'padre', 'administrador-general', 'transporte', 'tesoreria', 'nutricion', 'cafeteria'].includes(rol)) {
      return res.status(400).json({ message: 'Rol inválido.' });
    }

    // Validar código de acceso para roles que lo requieren
    let colegioId = 'COLEGIO_DEMO_2025';
    const rolesQueRequierenCodigo = ['profesor', 'directivo', 'administrador-general', 'transporte', 'tesoreria', 'nutricion', 'cafeteria'];
    if (rolesQueRequierenCodigo.includes(rol)) {
      if (!codigoAcceso) {
        return res.status(400).json({ message: 'El código del colegio es obligatorio para este rol.' });
      }
      
      // Normalizar el código ingresado (mayúsculas y sin espacios)
      const codigoNormalizado = codigoAcceso.toString().toUpperCase().trim();
      const colegioIdFromCodigo = CODIGOS_COLEGIO[codigoNormalizado];
      if (!colegioIdFromCodigo) {
        return res.status(400).json({ 
          message: `Código del colegio inválido. Códigos válidos: ${Object.keys(CODIGOS_COLEGIO).join(', ')}` 
        });
      }
      
      colegioId = colegioIdFromCodigo;
    }

    // Validar y normalizar materias para profesores
    let materiasArray: string[] = [];
    if (rol === 'profesor') {
      if (!materias || !Array.isArray(materias) || materias.length === 0) {
        return res.status(400).json({ message: 'Los profesores deben especificar al menos una materia.' });
      }
      
      // Normalizar: eliminar vacíos, deduplicar y capitalizar
      materiasArray = Array.from(new Set(
        materias
          .map((m: string) => m.trim())
          .filter((m: string) => m.length > 0)
          .map((m: string) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
      ));
      
      if (materiasArray.length === 0) {
        return res.status(400).json({ message: 'Debes ingresar al menos una materia válida.' });
      }
      
      if (materiasArray.length > 10) {
        return res.status(400).json({ message: 'No puedes especificar más de 10 materias.' });
      }
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'El correo ya está registrado.' });
    }

    // Generar código único de 4 dígitos
    const codigoUnico = await generarCodigoUnico();
    console.log('[REGISTER] Código único generado:', codigoUnico);
    console.log('[REGISTER] Tipo del código generado:', typeof codigoUnico);

    // Normalizar curso a mayúsculas si es estudiante
    const cursoNormalizado = rol === 'estudiante' && curso ? curso.toUpperCase().trim() : undefined;
    
    const newUser = new User({
      nombre,
      correo: email.toLowerCase(), // Usar correo como campo principal
      email: email.toLowerCase(), // Mantener para compatibilidad
      password,
      rol,
      curso: cursoNormalizado,
      materias: rol === 'profesor' ? materiasArray : undefined,
      colegioId,
      hijoId: rol === 'padre' ? hijoId : undefined,
      estado: 'activo',
      configuraciones: {},
    });
    
    console.log(`[REGISTER] Creando usuario: rol=${rol}, curso=${cursoNormalizado}, colegioId=${colegioId}`);
    
    // Guardar el usuario primero sin el código
    try {
      await newUser.save();
      console.log('[REGISTER] Usuario guardado sin código, ID:', newUser._id);
    } catch (saveError: any) {
      console.error('[REGISTER] Error al guardar usuario:', saveError.message);
      throw saveError;
    }
    
    // Ahora actualizar el código directamente en la BD usando updateOne
    try {
      const updateResult = await User.updateOne(
        { _id: newUser._id },
        { $set: { codigoUnico: codigoUnico } }
      );
      console.log('[REGISTER] Resultado de updateOne:', updateResult);
      console.log('[REGISTER] Código actualizado en BD:', codigoUnico);
    } catch (updateError: any) {
      console.error('[REGISTER] Error al actualizar código:', updateError.message);
      if (updateError.code === 11000) {
        console.error('[REGISTER] Error de duplicado - generando nuevo código...');
        const nuevoCodigo = await generarCodigoUnico();
        await User.updateOne(
          { _id: newUser._id },
          { $set: { codigoUnico: nuevoCodigo } }
        );
        console.log('[REGISTER] Nuevo código asignado:', nuevoCodigo);
      } else {
        throw updateError;
      }
    }
    
    // Verificar directamente en la BD usando findOne con el email
    const verificarBD = await User.findOne({ email: email.toLowerCase() });
    console.log('[REGISTER] Verificación directa en BD por email:');
    console.log('[REGISTER] - Código en BD:', verificarBD?.codigoUnico);
    console.log('[REGISTER] - Tipo:', typeof verificarBD?.codigoUnico);
    console.log('[REGISTER] - Usuario completo:', JSON.stringify(verificarBD?.toObject(), null, 2));
    
    // Recargar el usuario desde la BD usando el documento completo (no .lean())
    const savedUser = await User.findById(newUser._id);
    if (!savedUser) {
      console.error('[REGISTER] Error: Usuario no encontrado después de guardar');
      return res.status(500).json({ message: 'Error al guardar el usuario.' });
    }

    console.log('[REGISTER] Usuario recargado de BD, código:', savedUser.codigoUnico);
    console.log('[REGISTER] Tipo después de recargar:', typeof savedUser.codigoUnico);
    console.log('[REGISTER] Usuario completo recargado:', {
      id: savedUser._id.toString(),
      nombre: savedUser.nombre,
      email: savedUser.email,
      codigoUnico: savedUser.codigoUnico
    });

    // Asegurar que el código esté presente - si no está, asignarlo y guardar
    let codigoFinal = savedUser.codigoUnico;
    if (!codigoFinal) {
      console.warn('[REGISTER] Usuario sin código después de recargar, asignando nuevo código...');
      codigoFinal = await generarCodigoUnico();
      console.log('[REGISTER] Nuevo código generado:', codigoFinal);
      
      // Actualizar directamente en la BD
      const updateResult = await User.findByIdAndUpdate(
        savedUser._id, 
        { codigoUnico: codigoFinal },
        { new: true }
      );
      console.log('[REGISTER] Resultado de actualización:', updateResult?.codigoUnico);
      
      // Recargar nuevamente para verificar
      const verificarFinal = await User.findById(savedUser._id);
      console.log('[REGISTER] Verificación final después de actualizar:', verificarFinal?.codigoUnico);
      
      codigoFinal = verificarFinal?.codigoUnico || codigoFinal;
      console.log('[REGISTER] Código final asignado:', codigoFinal);
    }

    // Sincronizar estudiante con su grupo si es estudiante y tiene curso asignado
    if (savedUser.rol === 'estudiante' && savedUser.curso) {
      console.log(`[REGISTER] Sincronizando estudiante: id=${savedUser._id}, curso=${savedUser.curso}, colegioId=${savedUser.colegioId}`);
      await syncStudentToGroup(savedUser._id.toString(), savedUser.curso, savedUser.colegioId);
    } else {
      console.log(`[REGISTER] No se sincroniza: rol=${savedUser.rol}, curso=${savedUser.curso}`);
    }

    const token = generateToken(savedUser._id.toString());

    // Asegurar que userId categorizado existe
    let userIdCategorizado = savedUser.userId;
    if (!userIdCategorizado) {
      try {
        const categorizedId = generateUserId(savedUser.rol, savedUser._id);
        userIdCategorizado = categorizedId.fullId;
        // Guardar en BD
        await User.findByIdAndUpdate(savedUser._id, { userId: userIdCategorizado });
      } catch (error: any) {
        console.error('Error al generar userId categorizado en registro:', error.message);
        userIdCategorizado = generateUserId(savedUser.rol, savedUser._id).fullId;
      }
    }

    const response = {
      id: savedUser._id.toString(),
      userId: userIdCategorizado, // ID categorizado
      nombre: savedUser.nombre,
      email: savedUser.email,
      rol: savedUser.rol,
      curso: savedUser.curso,
      materias: savedUser.materias,
      colegioId: savedUser.colegioId,
      codigoUnico: codigoFinal || null,
      token,
    };

    console.log('[REGISTER] ==========================================');
    console.log('[REGISTER] Respuesta completa antes de enviar:');
    console.log(JSON.stringify(response, null, 2));
    console.log('[REGISTER] codigoUnico en response:', response.codigoUnico);
    console.log('[REGISTER] Tipo:', typeof response.codigoUnico);
    console.log('[REGISTER] Es null?', response.codigoUnico === null);
    console.log('[REGISTER] Es undefined?', response.codigoUnico === undefined);
    console.log('[REGISTER] ==========================================');

    // Asegurar que codigoUnico esté presente en la respuesta
    if (!response.codigoUnico) {
      console.error('[REGISTER] ERROR: codigoUnico es falsy, asignando código de emergencia');
      response.codigoUnico = await generarCodigoUnico();
      await User.findByIdAndUpdate(savedUser._id, { codigoUnico: response.codigoUnico });
      console.log('[REGISTER] Código de emergencia asignado:', response.codigoUnico);
    }

    return res.status(201).json(response);
  } catch (err: any) {
    console.error('Error en register:', err.message);
    console.error('Stack:', err.stack);
    
    // Si es un error de MongoDB, dar información más específica
    if (err.name === 'MongoServerError' || err.name === 'MongooseError' || !mongoConnected) {
      return res.status(503).json({ 
        message: 'Error de conexión con la base de datos.',
        error: mongoError || err.message
      });
    }
    
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/auth/login
router.post('/login', checkMongoConnection, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Faltan credenciales.' });
    }

    // Verificar nuevamente la conexión antes de hacer la consulta
    if (!mongoConnected) {
      console.error('[LOGIN] Error: MongoDB desconectado durante la operación');
      return res.status(503).json({ 
        message: 'Servicio no disponible. La base de datos no está conectada.',
        error: mongoError || 'MongoDB no conectado'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }

    console.log('[LOGIN] Usuario encontrado, código actual:', user.codigoUnico);
    console.log('[LOGIN] Tipo de codigoUnico:', typeof user.codigoUnico);
    
    // Verificar directamente en la BD
    const verificarBD = await User.findOne({ email: email.toLowerCase() });
    console.log('[LOGIN] Verificación directa en BD por email:');
    console.log('[LOGIN] - Código en BD:', verificarBD?.codigoUnico);
    console.log('[LOGIN] - Tipo:', typeof verificarBD?.codigoUnico);

    // Si el usuario no tiene código único, asignarle uno automáticamente
    if (!user.codigoUnico) {
      try {
        const nuevoCodigo = await generarCodigoUnico();
        console.log('[LOGIN] Asignando nuevo código:', nuevoCodigo);
        
        // Actualizar directamente en la BD
        const updateResult = await User.findByIdAndUpdate(
          user._id, 
          { codigoUnico: nuevoCodigo },
          { new: true }
        );
        console.log('[LOGIN] Resultado de actualización:', updateResult?.codigoUnico);
        user.codigoUnico = nuevoCodigo;
        console.log('[LOGIN] Código asignado correctamente');
      } catch (error: any) {
        console.error('[LOGIN] Error al asignar código único:', error.message);
        // Continuar con el login aunque falle la asignación del código
      }
    }

    // Recargar el usuario para asegurar que tenemos el código más reciente
    // Usar el documento completo (no .lean()) para asegurar que todos los campos estén disponibles
    const userWithCode = await User.findById(user._id);
    if (!userWithCode) {
      console.error('[LOGIN] Error: Usuario no encontrado después de actualizar código');
      return res.status(404).json({ message: 'Usuario no encontrado después de actualizar código.' });
    }

    console.log('[LOGIN] Usuario recargado, código único:', userWithCode.codigoUnico);
    console.log('[LOGIN] Tipo de codigoUnico en BD:', typeof userWithCode.codigoUnico);
    console.log('[LOGIN] Usuario completo recargado:', {
      id: userWithCode._id.toString(),
      nombre: userWithCode.nombre,
      email: userWithCode.email,
      codigoUnico: userWithCode.codigoUnico
    });

    // Asegurar que el código esté presente - si no está, asignarlo y guardar
    let codigoFinal = userWithCode.codigoUnico;
    if (!codigoFinal) {
      console.warn('[LOGIN] Usuario sin código después de recargar, asignando nuevo código...');
      codigoFinal = await generarCodigoUnico();
      console.log('[LOGIN] Nuevo código generado:', codigoFinal);
      
      // Actualizar directamente en la BD
      const updateResult = await User.findByIdAndUpdate(
        userWithCode._id, 
        { codigoUnico: codigoFinal },
        { new: true }
      );
      console.log('[LOGIN] Resultado de actualización:', updateResult?.codigoUnico);
      
      // Recargar nuevamente para verificar
      const verificarFinal = await User.findById(userWithCode._id);
      console.log('[LOGIN] Verificación final después de actualizar:', verificarFinal?.codigoUnico);
      
      codigoFinal = verificarFinal?.codigoUnico || codigoFinal;
      console.log('[LOGIN] Código final asignado:', codigoFinal);
    }

    const token = generateToken(userWithCode._id.toString());

    // Asegurar que userId categorizado existe
    let userIdCategorizado = userWithCode.userId;
    if (!userIdCategorizado) {
      try {
        const categorizedId = generateUserId(userWithCode.rol, userWithCode._id);
        userIdCategorizado = categorizedId.fullId;
        // Guardar en BD
        await User.findByIdAndUpdate(userWithCode._id, { userId: userIdCategorizado });
      } catch (error: any) {
        console.error('Error al generar userId categorizado en login:', error.message);
        userIdCategorizado = generateUserId(userWithCode.rol, userWithCode._id).fullId;
      }
    }

    const response = {
      id: userWithCode._id.toString(),
      userId: userIdCategorizado, // ID categorizado
      nombre: userWithCode.nombre,
      email: userWithCode.email,
      rol: userWithCode.rol,
      curso: userWithCode.curso,
      materias: userWithCode.materias,
      colegioId: userWithCode.colegioId,
      codigoUnico: codigoFinal || null,
      token,
    };

    console.log('[LOGIN] ==========================================');
    console.log('[LOGIN] Respuesta completa antes de enviar:');
    console.log(JSON.stringify(response, null, 2));
    console.log('[LOGIN] codigoUnico en response:', response.codigoUnico);
    console.log('[LOGIN] Tipo:', typeof response.codigoUnico);
    console.log('[LOGIN] Es null?', response.codigoUnico === null);
    console.log('[LOGIN] Es undefined?', response.codigoUnico === undefined);
    console.log('[LOGIN] ==========================================');

    // Asegurar que codigoUnico esté presente en la respuesta
    if (!response.codigoUnico) {
      console.error('[LOGIN] ERROR: codigoUnico es falsy, asignando código de emergencia');
      response.codigoUnico = await generarCodigoUnico();
      await User.findByIdAndUpdate(userWithCode._id, { codigoUnico: response.codigoUnico });
      console.log('[LOGIN] Código de emergencia asignado:', response.codigoUnico);
    }

    res.json(response);
  } catch (err: any) {
    console.error('Error en login:', err.message);
    console.error('Stack:', err.stack);
    
    // Si es un error de MongoDB, dar información más específica
    if (err.name === 'MongoServerError' || err.name === 'MongooseError' || !mongoConnected) {
      return res.status(503).json({ 
        message: 'Error de conexión con la base de datos.',
        error: mongoError || err.message
      });
    }
    
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
