import express from 'express';
import { Group } from '../models/Group';
import { GroupStudent } from '../models/GroupStudent';
import { User } from '../models/User';
import { Assignment } from '../models/Assignment';
import { protect, AuthRequest } from '../middleware/auth';
import { Types } from 'mongoose';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// Grupos fijos predefinidos
const GRUPOS_FIJOS = [
  { _id: '9A', nombre: '9A' },
  { _id: '9B', nombre: '9B' },
  { _id: '10A', nombre: '10A' },
  { _id: '10B', nombre: '10B' },
  { _id: '11C', nombre: '11C' },
  { _id: '11D', nombre: '11D' },
  { _id: '11H', nombre: '11H' },
  { _id: '12C', nombre: '12C' },
  { _id: '12D', nombre: '12D' },
  { _id: '12H', nombre: '12H' },
];

// Seed: Crear grupos fijos si no existen
export async function seedGroups(colegioId: string = 'COLEGIO_DEMO_2025') {
  try {
    // Verificar si MongoDB está conectado antes de intentar el seed
    const { mongoose } = await import('../config/db');
    if (mongoose.connection.readyState !== 1) {
      console.log('⏭️  Saltando seed de grupos: MongoDB no está conectado');
      return;
    }
    
    for (const grupo of GRUPOS_FIJOS) {
      await Group.findOneAndUpdate(
        { nombre: grupo.nombre, colegioId },
        { 
          nombre: grupo.nombre,
          descripcion: `Grupo ${grupo.nombre}`,
          colegioId 
        },
        { upsert: true, new: true }
      );
    }
    console.log('✅ Grupos fijos creados/actualizados');
  } catch (error) {
    console.error('❌ Error al crear grupos fijos:', error);
  }
}

// =========================================================================
// POST /api/groups/create - Crear grupo/curso (solo para admin-general-colegio)
// IMPORTANTE: Esta ruta debe estar ANTES de las rutas con parámetros dinámicos
router.post('/create', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = normalizeIdForQuery(req.userId || '');
    const user = await User.findById(normalizedUserId).select('rol colegioId');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Solo admin-general-colegio puede crear grupos
    if (user.rol !== 'admin-general-colegio') {
      return res.status(403).json({ message: 'Solo administradores generales del colegio pueden crear grupos' });
    }

    const { nombre, seccion, directorGrupoId } = req.body;

    if (!nombre || !seccion || !directorGrupoId) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, seccion, directorGrupoId' });
    }

    // Validar que el director de grupo sea un profesor
    const directorGrupo = await User.findById(normalizeIdForQuery(directorGrupoId)).select('rol colegioId');
    if (!directorGrupo) {
      return res.status(404).json({ message: 'Director de grupo no encontrado' });
    }

    if (directorGrupo.rol !== 'profesor') {
      return res.status(400).json({ message: 'El director de grupo debe ser un profesor' });
    }

    if (directorGrupo.colegioId !== user.colegioId) {
      return res.status(403).json({ message: 'El director de grupo debe pertenecer al mismo colegio' });
    }

    // Crear el nombre completo del grupo (ej: "7A", "10B")
    const nombreCompleto = `${nombre}${seccion}`.toUpperCase().trim();

    // Verificar si el grupo ya existe
    const grupoExistente = await Group.findOne({ 
      nombre: nombreCompleto, 
      colegioId: user.colegioId 
    });

    if (grupoExistente) {
      return res.status(400).json({ message: `El grupo ${nombreCompleto} ya existe` });
    }

    // Crear el grupo
    const nuevoGrupo = await Group.create({
      nombre: nombreCompleto,
      descripcion: `Grupo ${nombreCompleto}`,
      colegioId: user.colegioId,
    });

    // TODO: Asignar el director de grupo al grupo (esto podría requerir un campo adicional en el modelo Group)
    // Por ahora, el grupo se crea y el director se puede asignar después

    res.status(201).json({
      message: 'Grupo creado exitosamente',
      grupo: {
        _id: nuevoGrupo._id,
        nombre: nuevoGrupo.nombre,
        descripcion: nuevoGrupo.descripcion,
        colegioId: nuevoGrupo.colegioId,
      },
    });
  } catch (error: any) {
    console.error('Error al crear grupo:', error.message);
    res.status(500).json({ message: 'Error en el servidor al crear el grupo.' });
  }
});

// GET /api/groups/all - Obtener todos los grupos
router.get('/all', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId || 'COLEGIO_DEMO_2025';
    
    // Buscar grupos del colegio
    let groups = await Group.find({ colegioId }).select('_id nombre').lean();
    
    // Si no hay grupos, intentar crearlos
    if (groups.length === 0) {
      await seedGroups(colegioId);
      groups = await Group.find({ colegioId }).select('_id nombre').lean();
    }
    
    res.json(groups);
  } catch (error) {
    console.error('Error al obtener grupos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// IMPORTANTE: Las rutas específicas deben ir ANTES de las rutas genéricas
// Función auxiliar para calcular el estado basado en el promedio
const calcularEstado = (promedio?: number): 'excelente' | 'bueno' | 'regular' | 'bajo' => {
  if (!promedio || promedio === 0) return 'regular';
  if (promedio >= 4.5) return 'excelente';
  if (promedio >= 4.0) return 'bueno';
  if (promedio >= 3.5) return 'regular';
  return 'bajo';
};

// GET /api/groups/:groupId/students - Obtener estudiantes de un grupo (optimizado: solo nombre y estado)
router.get('/:groupId/students', protect, async (req: AuthRequest, res) => {
  try {
    const { groupId } = req.params;
    const colegioId = req.user?.colegioId || 'COLEGIO_DEMO_2025';

    // Normalizar groupId a mayúsculas
    const grupoIdNormalizado = groupId.toUpperCase().trim();
    console.log(`[GROUPS] Buscando estudiantes para grupo: ${grupoIdNormalizado}, colegio: ${colegioId}`);

    // Buscar el grupo primero para obtener su ObjectId
    const grupo = await Group.findOne({ nombre: grupoIdNormalizado, colegioId });
    if (!grupo) {
      return res.status(404).json({ message: 'Grupo no encontrado.' });
    }

    // Buscar estudiantes del grupo en GroupStudent usando ObjectId
    const groupStudents = await GroupStudent.find({ 
      grupoId: grupo._id,
      colegioId 
    })
    .populate('estudianteId', 'nombre curso')
    .select('estudianteId createdAt')
    .lean();

    console.log(`[GROUPS] Encontrados ${groupStudents.length} registros en GroupStudent para ${grupoIdNormalizado}`);

    // Obtener IDs de estudiantes
    const estudianteIds = groupStudents
      .filter(gs => gs.estudianteId)
      .map(gs => (gs.estudianteId as any)._id.toString());

    // Calcular promedios y estados desde las calificaciones de tareas
    const assignments = await Assignment.find({
      curso: grupoIdNormalizado,
      colegioId
    })
    .select('entregas')
    .lean();

    // Calcular promedio por estudiante
    const promediosPorEstudiante: Record<string, { suma: number; cantidad: number }> = {};
    
    assignments.forEach(assignment => {
      if (assignment.entregas && Array.isArray(assignment.entregas)) {
        assignment.entregas.forEach((entrega: any) => {
          if (entrega.calificacion && entrega.calificacion > 0) {
            const estudianteId = entrega.estudianteId?.toString();
            if (estudianteId) {
              if (!promediosPorEstudiante[estudianteId]) {
                promediosPorEstudiante[estudianteId] = { suma: 0, cantidad: 0 };
              }
              promediosPorEstudiante[estudianteId].suma += entrega.calificacion;
              promediosPorEstudiante[estudianteId].cantidad += 1;
            }
          }
        });
      }
    });

    // Formatear respuesta con solo nombre y estado
    const students = groupStudents
      .filter(gs => gs.estudianteId) // Filtrar estudiantes que existan
      .map(gs => {
        const estudiante = gs.estudianteId as any;
        const estudianteId = estudiante._id.toString();
        const promedioData = promediosPorEstudiante[estudianteId];
        const promedio = promedioData && promedioData.cantidad > 0
          ? promedioData.suma / promedioData.cantidad
          : undefined;
        const estado = calcularEstado(promedio);

        return {
          _id: estudianteId,
          nombre: estudiante.nombre,
          estado: estado,
        };
      });

    console.log(`[GROUPS] Retornando ${students.length} estudiantes para ${grupoIdNormalizado}`);
    res.json(students);
  } catch (error) {
    console.error('Error al obtener estudiantes del grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/groups/:groupId/sync-students - Sincronizar estudiantes existentes de un grupo
// Este endpoint sincroniza todos los estudiantes que tienen el curso asignado en User pero no están en GroupStudent
router.post('/:groupId/sync-students', protect, async (req: AuthRequest, res) => {
  try {
    const { groupId } = req.params;
    const colegioId = req.user?.colegioId || 'COLEGIO_DEMO_2025';
    const grupoIdNormalizado = groupId.toUpperCase().trim();
    
    console.log(`[SYNC] Iniciando sincronización para grupo: ${grupoIdNormalizado}, colegio: ${colegioId}`);

    // Buscar todos los estudiantes que tienen este curso asignado en User
    // Buscar tanto con mayúsculas como con el formato original
    const estudiantesEnUser = await User.find({
      rol: 'estudiante',
      $or: [
        { curso: grupoIdNormalizado },
        { curso: groupId }, // También buscar con el formato original
        { curso: groupId.toLowerCase() }, // Y en minúsculas
      ],
      colegioId
    }).select('_id nombre email curso').lean();

    console.log(`[SYNC] Encontrados ${estudiantesEnUser.length} estudiantes en User con curso relacionado a ${grupoIdNormalizado}`);

    // Buscar el grupo primero para obtener su ObjectId
    const grupo = await Group.findOne({ nombre: grupoIdNormalizado, colegioId });
    if (!grupo) {
      return res.status(404).json({ message: 'Grupo no encontrado.' });
    }

    // Buscar estudiantes que ya están en GroupStudent usando ObjectId
    const estudiantesEnGroupStudent = await GroupStudent.find({
      grupoId: grupo._id,
      colegioId
    }).select('estudianteId').lean();

    const idsExistentes = new Set(
      estudiantesEnGroupStudent.map(gs => gs.estudianteId.toString())
    );

    console.log(`[SYNC] Ya existen ${idsExistentes.size} estudiantes en GroupStudent para ${grupoIdNormalizado}`);

    // Filtrar estudiantes que no están en GroupStudent
    const estudiantesASincronizar = estudiantesEnUser.filter(
      estudiante => !idsExistentes.has(estudiante._id.toString())
    );

    console.log(`[SYNC] Estudiantes a sincronizar: ${estudiantesASincronizar.length}`);

    // Si no hay estudiantes para sincronizar
    if (estudiantesASincronizar.length === 0) {
      return res.json({
        message: 'Todos los estudiantes ya están sincronizados',
        grupoId: grupoIdNormalizado,
        estudiantesSincronizados: 0,
        totalEstudiantes: estudiantesEnUser.length
      });
    }

    // Crear registros en GroupStudent usando ObjectId del grupo
    try {
      const nuevosRegistros = await GroupStudent.insertMany(
        estudiantesASincronizar.map(estudiante => ({
          grupoId: grupo!._id, // Usar ObjectId del grupo
          estudianteId: estudiante._id,
          colegioId
        })),
        { ordered: false } // Continuar aunque haya duplicados
      );

      console.log(`[SYNC] ✅ Sincronizados ${nuevosRegistros.length} estudiantes para ${grupoIdNormalizado}`);

      res.json({
        message: 'Sincronización completada',
        grupoId: grupoIdNormalizado,
        estudiantesSincronizados: nuevosRegistros.length,
        totalEstudiantes: estudiantesEnUser.length
      });
    } catch (insertError: any) {
      // Si hay errores de duplicado, contar los insertados
      if (insertError.code === 11000 || insertError.writeErrors) {
        const sincronizados = insertError.insertedIds?.length || 0;
        console.log(`[SYNC] ⚠️ Sincronización parcial: ${sincronizados} estudiantes sincronizados`);
        return res.json({
          message: 'Sincronización completada con algunos duplicados',
          grupoId: grupoIdNormalizado,
          estudiantesSincronizados: sincronizados,
          totalEstudiantes: estudiantesEnUser.length
        });
      }
      throw insertError;
    }
  } catch (error: any) {
    console.error('[SYNC] ❌ Error al sincronizar estudiantes:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor.',
      error: error.message 
    });
  }
});

// GET /api/groups/lookup/:objectId - Buscar grupo por ObjectId (utilidad para debugging)
router.get('/lookup/:objectId', protect, async (req: AuthRequest, res) => {
  try {
    const { objectId } = req.params;
    const group = await Group.findById(objectId);
    if (!group) {
      return res.status(404).json({ 
        message: 'Grupo no encontrado.',
        objectId,
        suggestion: 'Este ObjectId no corresponde a ningún grupo en la base de datos.'
      });
    }
    res.json({
      objectId: group._id.toString(),
      nombre: group.nombre,
      descripcion: group.descripcion,
      colegioId: group.colegioId,
      createdAt: group.createdAt,
      message: `Este ObjectId corresponde al grupo: ${group.nombre}`
    });
  } catch (error) {
    console.error('Error al buscar grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/groups/:id - Obtener un grupo por ID (DEBE IR AL FINAL)
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado.' });
    }
    res.json(group);
  } catch (error) {
    console.error('Error al obtener grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// POST /api/groups/create - Crear grupo/curso (solo para admin-general-colegio)
router.post('/create', protect, async (req: AuthRequest, res) => {
  try {
    const normalizedUserId = req.userId ? req.userId.toString() : '';
    const user = await User.findById(normalizedUserId).select('rol colegioId');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Solo admin-general-colegio puede crear grupos
    if (user.rol !== 'admin-general-colegio') {
      return res.status(403).json({ message: 'Solo administradores generales del colegio pueden crear grupos' });
    }

    const { nombre, seccion, directorGrupoId } = req.body;

    if (!nombre || !seccion || !directorGrupoId) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, seccion, directorGrupoId' });
    }

    // Validar que el director de grupo sea un profesor
    const directorGrupo = await User.findById(directorGrupoId).select('rol colegioId');
    if (!directorGrupo) {
      return res.status(404).json({ message: 'Director de grupo no encontrado' });
    }

    if (directorGrupo.rol !== 'profesor') {
      return res.status(400).json({ message: 'El director de grupo debe ser un profesor' });
    }

    if (directorGrupo.colegioId !== user.colegioId) {
      return res.status(403).json({ message: 'El director de grupo debe pertenecer al mismo colegio' });
    }

    // Crear el nombre completo del grupo (ej: "7A", "10B")
    const nombreCompleto = `${nombre}${seccion}`.toUpperCase().trim();

    // Verificar si el grupo ya existe
    const grupoExistente = await Group.findOne({ 
      nombre: nombreCompleto, 
      colegioId: user.colegioId 
    });

    if (grupoExistente) {
      return res.status(400).json({ message: `El grupo ${nombreCompleto} ya existe` });
    }

    // Crear el grupo
    const nuevoGrupo = await Group.create({
      nombre: nombreCompleto,
      descripcion: `Grupo ${nombreCompleto}`,
      colegioId: user.colegioId,
    });

    // TODO: Asignar el director de grupo al grupo (esto podría requerir un campo adicional en el modelo Group)
    // Por ahora, el grupo se crea y el director se puede asignar después

    res.status(201).json({
      message: 'Grupo creado exitosamente',
      grupo: {
        _id: nuevoGrupo._id,
        nombre: nuevoGrupo.nombre,
        descripcion: nuevoGrupo.descripcion,
        colegioId: nuevoGrupo.colegioId,
      },
    });
  } catch (error: any) {
    console.error('Error al crear grupo:', error.message);
    res.status(500).json({ message: 'Error en el servidor al crear el grupo.' });
  }
});

export default router;
