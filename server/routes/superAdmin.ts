import express from 'express';
import { protect } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/superAdmin';
import { AuthRequest } from '../middleware/auth';
import { InstitutionConfig, User, CodigoInstitucion } from '../models';
import { generateUserId } from '../utils/idGenerator';
import bcrypt from 'bcryptjs';

// Función para generar un código único de 4 dígitos (para usuarios)
const generarCodigoUnico = async (): Promise<string> => {
  let codigo: string;
  let existe: boolean;
  let intentos = 0;
  const maxIntentos = 1000;

  do {
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

// Función para generar un código de acceso único para un colegio
// Formato: COLEGIO_XXXX donde XXXX son 4 dígitos aleatorios
async function generarCodigoAcceso(colegioId: string): Promise<string> {
  let codigo: string;
  let existe: boolean;
  let intentos = 0;
  const maxIntentos = 100;

  try {
    do {
      // Generar un código único basado en el colegioId y un número aleatorio
      const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      // Normalizar el colegioId para usarlo como base (máximo 8 caracteres)
      const baseCodigo = colegioId.replace(/[^A-Z0-9]/g, '').substring(0, 8);
      // Si el baseCodigo está vacío después de normalizar, usar un prefijo genérico
      const prefix = baseCodigo.length > 0 ? baseCodigo : 'COLEGIO';
      codigo = `${prefix}_${randomSuffix}`;
      
      // Verificar que el código no exista en la BD
      const codigoExistente = await CodigoInstitucion.findOne({ codigo });
      existe = !!codigoExistente;
      intentos++;
      
      if (intentos >= maxIntentos) {
        throw new Error('No se pudo generar un código de acceso único después de múltiples intentos.');
      }
    } while (existe);

    return codigo;
  } catch (error: any) {
    console.error('[SUPER_ADMIN] Error en generarCodigoAcceso:', error);
    throw error;
  }
}

const router = express.Router();

/**
 * GET /api/super-admin/schools
 * Lista todos los colegios en el sistema
 * Solo accesible para super_admin
 */
router.get('/schools', protect, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const schools = await InstitutionConfig.find({}).sort({ createdAt: -1 }).lean();
    
    // Obtener información adicional de cada colegio (número de usuarios, etc.)
    const schoolsWithStats = await Promise.all(
      schools.map(async (school) => {
        const userCount = await User.countDocuments({ colegioId: school.colegioId });
        // Buscar super_admin de este colegio específico (no el general que tiene GLOBAL_ADMIN)
        const superAdmin = await User.findOne({ 
          colegioId: school.colegioId, 
          rol: 'super_admin'
        }).select('nombre email estado').lean();
        
        return {
          ...school,
          userCount,
          superAdmin: superAdmin || null,
        };
      })
    );

    res.json(schoolsWithStats);
  } catch (error: any) {
    console.error('Error al listar colegios:', error);
    res.status(500).json({ message: 'Error al obtener la lista de colegios.' });
  }
});

/**
 * POST /api/super-admin/schools
 * Crea un nuevo colegio
 * Solo accesible para super_admin
 */
router.post('/schools', protect, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    console.log('[SUPER_ADMIN] ========== INICIO CREACIÓN COLEGIO ==========');
    const { nombre, colegioId, nombreIA, colorPrimario, colorSecundario } = req.body;
    
    console.log('[SUPER_ADMIN] Datos recibidos:', { nombre, colegioId, nombreIA, colorPrimario, colorSecundario });

    if (!nombre || !colegioId) {
      console.log('[SUPER_ADMIN] Error: Faltan campos obligatorios');
      return res.status(400).json({ 
        message: 'El nombre y el ID del colegio son obligatorios.' 
      });
    }

    // Validar que el colegioId no exista
    console.log('[SUPER_ADMIN] Verificando si el colegioId ya existe...');
    const existingSchool = await InstitutionConfig.findOne({ colegioId });
    if (existingSchool) {
      console.log('[SUPER_ADMIN] Error: ColegioId ya existe');
      return res.status(400).json({ 
        message: 'Ya existe un colegio con ese ID.' 
      });
    }

    // Crear la configuración del colegio
    console.log('[SUPER_ADMIN] Creando configuración del colegio...');
    const newSchool = await InstitutionConfig.create({
      colegioId,
      nombre,
      logoUrl: '', // Siempre vacío por ahora
      nombreIA: nombreIA || 'AutoClose AI',
      colorPrimario: colorPrimario || '#9f25b8',
      colorSecundario: colorSecundario || '#6a0dad',
      parametros: {},
    });
    console.log('[SUPER_ADMIN] Colegio creado en BD:', newSchool._id);

    // Generar código de acceso automáticamente para el colegio
    // El código será usado para que el admin-general-colegio se registre
    console.log('[SUPER_ADMIN] Generando código de acceso...');
    let codigoAccesoGenerado: string;
    try {
      codigoAccesoGenerado = await generarCodigoAcceso(colegioId);
      console.log('[SUPER_ADMIN] Código generado:', codigoAccesoGenerado);
    } catch (error: any) {
      console.error('[SUPER_ADMIN] Error al generar código de acceso:', error);
      console.error('[SUPER_ADMIN] Stack:', error.stack);
      // Si falla la generación del código, eliminar el colegio creado
      try {
        await InstitutionConfig.findByIdAndDelete(newSchool._id);
        console.log('[SUPER_ADMIN] Colegio eliminado debido a error en generación de código');
      } catch (deleteError: any) {
        console.error('[SUPER_ADMIN] Error al eliminar colegio:', deleteError);
      }
      return res.status(500).json({ 
        message: 'Error al generar el código de acceso. El colegio no fue creado.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    // Guardar el código en la base de datos con el rol asignado
    console.log('[SUPER_ADMIN] Guardando código en BD...');
    console.log('[SUPER_ADMIN] Datos del código a guardar:', {
      colegioId,
      codigo: codigoAccesoGenerado,
      codigoLength: codigoAccesoGenerado.length,
      rolAsignado: 'admin-general-colegio'
    });
    try {
      const codigoDoc = await CodigoInstitucion.create({
        colegioId,
        codigo: codigoAccesoGenerado.toUpperCase().trim(), // Asegurar que se guarde en mayúsculas y sin espacios
        rolAsignado: 'admin-general-colegio', // Este código asigna el rol admin-general-colegio
      });
      console.log('[SUPER_ADMIN] ✅ Código guardado en BD:', {
        id: codigoDoc._id,
        codigo: codigoDoc.codigo,
        colegioId: codigoDoc.colegioId,
        rolAsignado: codigoDoc.rolAsignado
      });
      
      // Verificar que se guardó correctamente haciendo una búsqueda
      const codigoVerificado = await CodigoInstitucion.findOne({ codigo: codigoAccesoGenerado.toUpperCase().trim() });
      if (codigoVerificado) {
        console.log('[SUPER_ADMIN] ✅ Verificación: Código encontrado en BD después de guardar');
      } else {
        console.error('[SUPER_ADMIN] ❌ ERROR: Código NO encontrado en BD después de guardar');
      }
    } catch (error: any) {
      console.error('[SUPER_ADMIN] Error al guardar código en BD:', error);
      console.error('[SUPER_ADMIN] Error code:', error.code);
      console.error('[SUPER_ADMIN] Error name:', error.name);
      console.error('[SUPER_ADMIN] Stack:', error.stack);
      // Si falla al guardar el código, eliminar el colegio creado
      try {
        await InstitutionConfig.findByIdAndDelete(newSchool._id);
        console.log('[SUPER_ADMIN] Colegio eliminado debido a error al guardar código');
      } catch (deleteError: any) {
        console.error('[SUPER_ADMIN] Error al eliminar colegio:', deleteError);
      }
      if (error.code === 11000) {
        return res.status(400).json({ 
          message: 'El código generado ya existe. Intenta crear el colegio nuevamente.',
          error: 'Código duplicado'
        });
      }
      return res.status(500).json({ 
        message: 'Error al guardar el código de acceso. El colegio no fue creado.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    console.log(`[SUPER_ADMIN] Colegio creado: ${colegioId}`);
    console.log(`[SUPER_ADMIN] Código de acceso generado: ${codigoAccesoGenerado}`);
    console.log(`[SUPER_ADMIN] Rol asignado al código: admin-general-colegio`);

    res.status(201).json({
      message: 'Colegio creado exitosamente.',
      school: newSchool,
      codigoAcceso: codigoAccesoGenerado, // Devolver el código generado
      mensaje: `Código de acceso generado: ${codigoAccesoGenerado}. Úsalo para registrar al administrador general del colegio.`,
    });
  } catch (error: any) {
    console.error('[SUPER_ADMIN] Error al crear colegio:', error);
    console.error('[SUPER_ADMIN] Stack trace:', error.stack);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Ya existe un colegio con ese ID.' 
      });
    }
    res.status(500).json({ 
      message: 'Error al crear el colegio.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/super-admin/schools/:colegioId/assign-admin
 * Asigna un super_admin DE COLEGIO a un colegio
 * Crea un nuevo usuario con rol super_admin (pero con colegioId específico) o actualiza uno existente
 */
router.post('/schools/:colegioId/assign-admin', protect, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { colegioId } = req.params;
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ 
        message: 'Nombre, email y contraseña son obligatorios.' 
      });
    }

    // Verificar que el colegio existe
    const school = await InstitutionConfig.findOne({ colegioId });
    if (!school) {
      return res.status(404).json({ 
        message: 'Colegio no encontrado.' 
      });
    }

    // Verificar si ya existe un super_admin DE COLEGIO para este colegio
    // Nota: super_admin general tiene colegioId='GLOBAL_ADMIN', super_admin de colegio tiene colegioId específico
    const existingAdmin = await User.findOne({ 
      colegioId, 
      rol: 'super_admin' 
    });

    if (existingAdmin) {
      // Actualizar el school_admin existente
      existingAdmin.nombre = nombre;
      existingAdmin.correo = email.toLowerCase();
      existingAdmin.email = email.toLowerCase();
      
      // Si se proporciona una nueva contraseña, hashearla
      if (password) {
        const salt = await bcrypt.genSalt(10);
        existingAdmin.password = await bcrypt.hash(password, salt);
      }
      
      existingAdmin.estado = 'active';
      await existingAdmin.save();

      // Generar userId categorizado si no existe
      if (!existingAdmin.userId) {
        try {
          const categorizedId = generateUserId(existingAdmin.rol, existingAdmin._id);
          existingAdmin.userId = categorizedId.fullId;
          await existingAdmin.save();
        } catch (error: any) {
          console.error('Error al generar userId categorizado:', error);
        }
      }

      return res.json({
        message: 'Super admin del colegio actualizado exitosamente.',
        user: {
          id: existingAdmin._id.toString(),
          nombre: existingAdmin.nombre,
          email: existingAdmin.email,
          rol: existingAdmin.rol,
          colegioId: existingAdmin.colegioId,
        },
      });
    } else {
      // Crear nuevo super_admin DE COLEGIO (no general)
      // El super_admin general tiene colegioId='GLOBAL_ADMIN', este tiene el colegioId específico
      const newAdmin = new User({
        nombre,
        correo: email.toLowerCase(),
        email: email.toLowerCase(),
        password,
        rol: 'super_admin', // Mismo rol pero con colegioId específico del colegio
        colegioId, // colegioId específico del colegio, no 'GLOBAL_ADMIN'
        estado: 'active',
        configuraciones: {},
      });

      await newAdmin.save();

      // Generar userId categorizado
      try {
        const categorizedId = generateUserId(newAdmin.rol, newAdmin._id);
        newAdmin.userId = categorizedId.fullId;
        await newAdmin.save();
      } catch (error: any) {
        console.error('Error al generar userId categorizado:', error);
      }

      // Generar código único
      const codigoUnico = await generarCodigoUnico();
      newAdmin.codigoUnico = codigoUnico;
      await newAdmin.save();

      return res.status(201).json({
        message: 'Super admin del colegio creado exitosamente.',
        user: {
          id: newAdmin._id.toString(),
          nombre: newAdmin.nombre,
          email: newAdmin.email,
          rol: newAdmin.rol,
          colegioId: newAdmin.colegioId,
          codigoUnico: newAdmin.codigoUnico,
        },
      });
    }
  } catch (error: any) {
    console.error('Error al asignar school admin:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Ya existe un usuario con ese email.' 
      });
    }
    res.status(500).json({ message: 'Error al asignar school admin.' });
  }
});

/**
 * GET /api/super-admin/schools/:colegioId
 * Obtiene información detallada de un colegio
 */
router.get('/schools/:colegioId', protect, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { colegioId } = req.params;

    const school = await InstitutionConfig.findOne({ colegioId }).lean();
    if (!school) {
      return res.status(404).json({ message: 'Colegio no encontrado.' });
    }

    // Obtener estadísticas del colegio
    const userCount = await User.countDocuments({ colegioId });
    // Buscar super_admin de este colegio específico
    const superAdmin = await User.findOne({ 
      colegioId, 
      rol: 'super_admin'
    }).select('nombre email estado createdAt').lean();

    res.json({
      ...school,
      userCount,
      superAdmin: superAdmin || null,
    });
  } catch (error: any) {
    console.error('Error al obtener colegio:', error);
    res.status(500).json({ message: 'Error al obtener información del colegio.' });
  }
});

export default router;
