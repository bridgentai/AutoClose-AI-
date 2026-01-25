import express from 'express';
import jwt from 'jsonwebtoken';
import { User, GroupStudent, CodigoInstitucion } from '../models';
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
  let createdUserId: string | null = null;
  try {
    const { nombre, email, password, rol, curso, codigoAcceso, hijoId, materias, seccion } = req.body;

    console.log('[REGISTER] ========== INICIO REGISTRO ==========');
    console.log('[REGISTER] Datos recibidos:', {
      nombre,
      email,
      rol,
      seccion,
      codigoAcceso,
      tienePassword: !!password
    });

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    // Roles permitidos para registro público
    // ⚠️ SEGURIDAD: En producción, super_admin NO debería estar aquí
    // Se permite solo para pruebas, demos y staging
    const rolesPermitidosPublico = ['estudiante', 'profesor', 'directivo', 'padre', 'administrador-general', 'admin-general-colegio', 'transporte', 'tesoreria', 'nutricion', 'cafeteria', 'asistente', 'super_admin'];
    
    // Bloquear explícitamente school_admin del registro público
    // school_admin solo puede ser creado por super_admin o durante onboarding del colegio
    if (rol === 'school_admin') {
      return res.status(403).json({ 
        message: 'Este rol no puede ser creado mediante registro público. Contacta al administrador del sistema.' 
      });
    }
    
    // ⚠️ SEGURIDAD: Validación explícita para super_admin
    // En producción, esto debería requerir un código especial o estar completamente deshabilitado
    if (rol === 'super_admin') {
      console.warn('[REGISTER] ⚠️ ADVERTENCIA: Se está creando un super_admin desde registro público. Esto solo debería ocurrir en desarrollo/staging.');
      // En producción, descomentar la siguiente línea para bloquear:
      // return res.status(403).json({ message: 'El rol super_admin no puede ser creado mediante registro público en producción.' });
    }
    
    if (!rolesPermitidosPublico.includes(rol)) {
      return res.status(400).json({ message: 'Rol inválido.' });
    }

    // Validar código de acceso para roles que lo requieren
    // ⚠️ NOTA: super_admin NO requiere código de colegio (tiene acceso global)
    let colegioId = 'COLEGIO_DEMO_2025';
    let rolFinal = rol; // Rol que se asignará (puede cambiar si se usa código)
    
    const rolesQueRequierenCodigo = ['profesor', 'directivo', 'administrador-general', 'admin-general-colegio', 'transporte', 'tesoreria', 'nutricion', 'cafeteria', 'asistente'];
    
    // super_admin no requiere código de colegio y puede tener colegioId null o un valor por defecto
    if (rol === 'super_admin') {
      // super_admin puede tener colegioId null o un valor especial que indique acceso global
      colegioId = 'GLOBAL_ADMIN'; // Valor especial para identificar super_admin
      console.log('[REGISTER] Creando super_admin con acceso global (colegioId: GLOBAL_ADMIN)');
    } else if (codigoAcceso) {
      // Si se proporciona un código de acceso, validarlo contra la base de datos
      const codigoNormalizado = codigoAcceso.toString().toUpperCase().trim();
      console.log(`[REGISTER] Validando código de acceso: "${codigoNormalizado}"`);
      console.log(`[REGISTER] Longitud del código: ${codigoNormalizado.length}`);
      
      // Buscar el código en la base de datos (búsqueda exacta)
      let codigoEnBD = await CodigoInstitucion.findOne({ codigo: codigoNormalizado });
      
      // Si no se encuentra con búsqueda exacta, intentar búsqueda más flexible (sin espacios, solo mayúsculas)
      if (!codigoEnBD) {
        // Intentar buscar sin guiones bajos o con diferentes formatos
        const codigoSinEspacios = codigoNormalizado.replace(/\s+/g, '');
        codigoEnBD = await CodigoInstitucion.findOne({ 
          $or: [
            { codigo: codigoSinEspacios },
            { codigo: codigoNormalizado.replace(/_/g, '') }
          ]
        });
      }
      
      // Si aún no se encuentra, buscar todos los códigos del colegio para debugging
      if (!codigoEnBD && rol === 'admin-general-colegio') {
        // Intentar buscar por colegioId si el código parece ser solo el colegioId (sin el sufijo _XXXX)
        // Esto es un fallback en caso de que el usuario ingrese solo el colegioId
        const posibleColegioId = codigoNormalizado;
        const codigosDelColegio = await CodigoInstitucion.find({ 
          colegioId: posibleColegioId,
          rolAsignado: 'admin-general-colegio'
        }).lean();
        
        console.log(`[REGISTER] Búsqueda por colegioId "${posibleColegioId}":`, {
          encontrados: codigosDelColegio.length,
          codigos: codigosDelColegio.map(c => c.codigo)
        });
        
        // Si hay exactamente un código para ese colegio con el rol correcto, usarlo
        if (codigosDelColegio.length === 1) {
          console.log(`[REGISTER] ⚠️ Código encontrado por colegioId (fallback), usando: ${codigosDelColegio[0].codigo}`);
          codigoEnBD = codigosDelColegio[0] as any;
        } else if (codigosDelColegio.length > 1) {
          console.log(`[REGISTER] ⚠️ Múltiples códigos encontrados para colegioId, usando el más reciente`);
          // Usar el más reciente (ordenar por _id que incluye timestamp)
          codigosDelColegio.sort((a, b) => (b._id as any).toString().localeCompare((a._id as any).toString()));
          codigoEnBD = codigosDelColegio[0] as any;
          console.log(`[REGISTER] Código seleccionado: ${codigoEnBD.codigo}`);
        }
      }
      
      console.log(`[REGISTER] Resultado búsqueda código:`, codigoEnBD ? {
        encontrado: true,
        codigo: codigoEnBD.codigo,
        colegioId: codigoEnBD.colegioId,
        rolAsignado: codigoEnBD.rolAsignado
      } : { encontrado: false });
      
      if (codigoEnBD) {
        // Código encontrado en BD - asignar automáticamente el rol y colegioId
        colegioId = codigoEnBD.colegioId;
        rolFinal = codigoEnBD.rolAsignado; // El rol viene del código
        console.log(`[REGISTER] ✅ Código válido encontrado: ${codigoEnBD.codigo}`);
        console.log(`[REGISTER] Asignando automáticamente: rol=${rolFinal}, colegioId=${colegioId}`);
        
        // Si el usuario especificó un rol diferente al del código, usar el del código
        if (rol !== rolFinal) {
          console.log(`[REGISTER] ⚠️ El código asigna el rol '${rolFinal}', ignorando el rol especificado '${rol}'`);
        }
      } else {
        // Código no encontrado en BD, intentar con el sistema antiguo (compatibilidad)
        console.log(`[REGISTER] Código no encontrado en BD, buscando en sistema antiguo...`);
        const colegioIdFromCodigo = CODIGOS_COLEGIO[codigoNormalizado];
        if (colegioIdFromCodigo) {
          colegioId = colegioIdFromCodigo;
          console.log(`[REGISTER] Código encontrado en sistema antiguo: ${codigoNormalizado}`);
        } else {
          // Código no encontrado en ningún sistema
          console.log(`[REGISTER] ❌ Código no válido: ${codigoNormalizado}`);
          console.log(`[REGISTER] Rol del usuario: ${rol}`);
          
          // Si el rol es admin-general-colegio, el código es obligatorio y debe ser válido
          if (rol === 'admin-general-colegio') {
            return res.status(400).json({ 
              message: `El código proporcionado no es válido. Asegúrate de usar el código exacto generado por el super administrador al crear el colegio. El código debe tener el formato: [COLEGIOID]_[4DIGITOS] (ejemplo: BODYTECH_1234).` 
            });
          }
          
          // Para otros roles que requieren código
          if (rolesQueRequierenCodigo.includes(rol)) {
            return res.status(400).json({ 
              message: `Código del colegio inválido. Verifica que el código sea correcto.` 
            });
          }
        }
      }
    } else if (rolesQueRequierenCodigo.includes(rol)) {
      // Si el rol requiere código pero no se proporcionó
      if (rol === 'admin-general-colegio') {
        return res.status(400).json({ 
          message: 'El código del colegio es obligatorio para registrarse como Administrador General del Colegio. Debes obtener el código del super administrador.' 
        });
      }
      return res.status(400).json({ message: 'El código del colegio es obligatorio para este rol.' });
    }

    // Validar sección para asistentes
    if (rol === 'asistente') {
      if (!seccion || !['junior-school', 'middle-school', 'high-school'].includes(seccion)) {
        return res.status(400).json({ message: 'Debes seleccionar una sección válida (Junior School, Middle School o High School).' });
      }
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

    // Verificar si el correo ya existe
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log('[REGISTER] Correo ya existe:', {
        id: existing._id,
        rol: existing.rol,
        nombre: existing.nombre,
        estado: existing.estado
      });
      return res.status(400).json({ message: 'El correo ya está registrado.' });
    }
    
    // También verificar por correo (campo alternativo)
    const existingByCorreo = await User.findOne({ correo: email.toLowerCase() });
    if (existingByCorreo) {
      console.log('[REGISTER] Correo ya existe (por campo correo):', {
        id: existingByCorreo._id,
        rol: existingByCorreo.rol,
        nombre: existingByCorreo.nombre,
        estado: existingByCorreo.estado
      });
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
      rol: rolFinal, // Usar el rol final (puede haber cambiado si se usó código)
      curso: cursoNormalizado,
      materias: rolFinal === 'profesor' ? materiasArray : undefined,
      // ⚠️ SEGURIDAD: super_admin puede tener colegioId especial o null
      // En producción, considerar hacer colegioId opcional en el schema para super_admin
      colegioId: rolFinal === 'super_admin' ? 'GLOBAL_ADMIN' : colegioId,
      hijoId: rolFinal === 'padre' ? hijoId : undefined,
      seccion: rolFinal === 'asistente' ? seccion : undefined,
      estado: 'active', // Usar 'active' en lugar de 'activo' para consistencia con el nuevo sistema de estados
      configuraciones: {},
    });
    
    console.log(`[REGISTER] Creando usuario: rol=${rolFinal} (original: ${rol}), curso=${cursoNormalizado}, colegioId=${colegioId}`);
    
    // Guardar el usuario primero sin el código
    try {
      await newUser.save();
      createdUserId = newUser._id.toString();
      console.log('[REGISTER] Usuario guardado sin código, ID:', createdUserId);
    } catch (saveError: any) {
      console.error('[REGISTER] Error al guardar usuario:', saveError.message);
      console.error('[REGISTER] Stack:', saveError.stack);
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
        console.log(`[REGISTER] Generando userId categorizado para rol: ${savedUser.rol}`);
        console.log(`[REGISTER] ID del usuario: ${savedUser._id}`);
        
        // Verificar que el rol sea válido antes de intentar generar el ID
        if (!savedUser.rol) {
          throw new Error('El rol del usuario no está definido');
        }
        
        const categorizedId = generateUserId(savedUser.rol, savedUser._id);
        userIdCategorizado = categorizedId.fullId;
        console.log(`[REGISTER] userId categorizado generado: ${userIdCategorizado}`);
        
        // Guardar en BD
        const updateResult = await User.findByIdAndUpdate(savedUser._id, { userId: userIdCategorizado });
        if (!updateResult) {
          throw new Error('No se pudo actualizar el userId categorizado en la base de datos');
        }
        console.log(`[REGISTER] userId categorizado guardado en BD`);
      } catch (error: any) {
        console.error('[REGISTER] ========== ERROR AL GENERAR USERID ==========');
        console.error('[REGISTER] Error message:', error.message);
        console.error('[REGISTER] Error name:', error.name);
        console.error('[REGISTER] Stack del error:', error.stack);
        console.error('[REGISTER] Rol que causó el error:', savedUser.rol);
        console.error('[REGISTER] Tipo de rol:', typeof savedUser.rol);
        // Lanzar el error con información detallada
        throw new Error(`Error al generar userId categorizado para rol '${savedUser.rol}': ${error.message}`);
      }
    } else {
      console.log(`[REGISTER] userId categorizado ya existe: ${userIdCategorizado}`);
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
      seccion: savedUser.seccion || null,
      estado: savedUser.estado || 'active', // Incluir estado en la respuesta
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
    console.error('[REGISTER] ========== ERROR EN REGISTRO ==========');
    console.error('[REGISTER] Error message:', err.message);
    console.error('[REGISTER] Error name:', err.name);
    console.error('[REGISTER] Error code:', err.code);
    console.error('[REGISTER] Stack:', err.stack);
    console.error('[REGISTER] Error completo:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    
    // Si se creó un usuario pero falló después, intentar eliminarlo
    if (createdUserId) {
      try {
        console.log('[REGISTER] Intentando eliminar usuario creado parcialmente:', createdUserId);
        await User.findByIdAndDelete(createdUserId);
        console.log('[REGISTER] Usuario eliminado correctamente');
      } catch (deleteError: any) {
        console.error('[REGISTER] Error al eliminar usuario parcial:', deleteError.message);
      }
    }
    
    // Si es un error de MongoDB, dar información más específica
    if (err.name === 'MongoServerError' || err.name === 'MongooseError' || !mongoConnected) {
      return res.status(503).json({ 
        message: 'Error de conexión con la base de datos.',
        error: mongoError || err.message
      });
    }
    
    // Si el error tiene un mensaje específico, mostrarlo
    if (err.message && (err.message.includes('Rol no reconocido') || err.message.includes('userId categorizado'))) {
      return res.status(400).json({ 
        message: err.message || 'Error al procesar el rol del usuario.',
        error: err.message
      });
    }
    
    // Si es un error de validación de Mongoose
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors || {}).map((e: any) => e.message).join(', ');
      return res.status(400).json({ 
        message: `Error de validación: ${validationErrors || err.message}`,
        error: validationErrors || err.message
      });
    }
    
    // Para otros errores, mostrar el mensaje real si está disponible
    const errorMessage = err.message || 'Error interno del servidor.';
    console.error('[REGISTER] Enviando error al cliente:', errorMessage);
    return res.status(500).json({ 
      message: errorMessage,
      error: errorMessage
    });
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

    // Verificar que el usuario esté activo (si tiene estado)
    if (user.estado && user.estado !== 'active' && user.estado !== 'activo') {
      if (user.estado === 'suspended') {
        return res.status(403).json({ message: 'Tu cuenta ha sido suspendida. Contacta al administrador.' });
      }
      if (user.estado === 'pending') {
        return res.status(403).json({ message: 'Tu cuenta está pendiente de aprobación. Contacta al administrador.' });
      }
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
      seccion: userWithCode.seccion || null,
      estado: userWithCode.estado || 'active', // Incluir estado en la respuesta
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
