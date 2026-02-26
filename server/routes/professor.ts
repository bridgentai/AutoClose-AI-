import express from 'express';
import { Types } from 'mongoose';
import { protect, AuthRequest } from '../middleware/auth';
import { Course } from '../models/Course';
import { User } from '../models/User';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// =========================================================================
// GET /api/professor/assignments/:materiaId
// Obtener los grupos asignados al profesor para una materia específica
// =========================================================================
router.get('/assignments/:materiaId', protect, async (req: AuthRequest, res) => {
  try {
    const { materiaId } = req.params;
    const profesorId = req.user?.id;
    const normalizedProfesorId = normalizeIdForQuery(profesorId || '');

    if (!materiaId) {
      return res.status(400).json({ message: 'ID de materia requerido.' });
    }

    // Buscar el curso/materia
    const course = await Course.findById(materiaId);
    
    if (!course) {
      // Si no existe la materia, devolver array vacío
      return res.json({ grupoIds: [] });
    }

    // Verificar si el profesor está asignado a este curso
    const isAssigned = course.profesorIds?.some(id => id.toString() === normalizedProfesorId);
    if (!isAssigned) {
      return res.json({ grupoIds: [] });
    }

    // Devolver los grupos asignados (cursos es el array de grupos)
    res.json({ grupoIds: course.cursos || [] });

  } catch (error) {
    console.error('Error al obtener asignaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// POST /api/professor/assign-groups
// Asignar grupos a la materia del profesor
// =========================================================================
router.post('/assign-groups', protect, async (req: AuthRequest, res) => {
  try {
    const { materiaId, grupoIds, profesorId } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId || 'COLEGIO_DEMO_2025';

    // Validaciones
    if (!grupoIds || !Array.isArray(grupoIds)) {
      return res.status(400).json({ message: 'Lista de grupos requerida.' });
    }

    // Normalizar IDs para comparación (pueden ser categorizados o no)
    const normalizedProfesorId = normalizeIdForQuery(profesorId);
    const normalizedUserId = normalizeIdForQuery(userId || '');

    if (!profesorId || normalizedProfesorId !== normalizedUserId) {
      return res.status(403).json({ message: 'No autorizado para esta acción.' });
    }

    // Obtener el nombre de la materia del profesor
    const profesor = await User.findById(normalizedProfesorId);
    if (!profesor || profesor.rol !== 'profesor') {
      return res.status(404).json({ message: 'Profesor no encontrado.' });
    }

    const materiaNombre = profesor.materias?.[0];
    if (!materiaNombre) {
      return res.status(400).json({ message: 'El profesor no tiene materia asignada.' });
    }

    // Normalizar y convertir grupoIds: si son ObjectIds, buscar el nombre del grupo
    // Si son nombres, normalizarlos a mayúsculas
    const { Group } = await import('../models/Group');
    const grupoIdsNormalizados: string[] = [];
    
    for (const id of grupoIds) {
      // Si es un ObjectId (24 caracteres hexadecimales), buscar el nombre del grupo
      if (typeof id === 'string' && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
        try {
          const group = await Group.findById(id);
          if (group) {
            grupoIdsNormalizados.push(group.nombre.toUpperCase().trim());
          } else {
            console.warn(`[assign-groups] Grupo con ObjectId ${id} no encontrado, ignorando`);
          }
        } catch (error) {
          console.warn(`[assign-groups] Error al buscar grupo por ObjectId ${id}:`, error);
        }
      } else {
        // Es un nombre de grupo, normalizarlo a mayúsculas
        grupoIdsNormalizados.push((id as string).toUpperCase().trim());
      }
    }
    
    const grupoIdsLowercase = grupoIdsNormalizados.map(id => id.toLowerCase());
    const todosLosVariantesGrupo = [...new Set([...grupoIdsNormalizados, ...grupoIdsLowercase])];

    // Buscar todos los estudiantes que pertenecen a los grupos seleccionados
    // Búsqueda case-insensitive para encontrar estudiantes independientemente de cómo esté escrito su curso
    const estudiantesEnGrupos = await User.find({
      rol: 'estudiante',
      curso: { $in: todosLosVariantesGrupo },
      colegioId
    }).select('_id curso');
    
    const estudianteIds = estudiantesEnGrupos.map(e => e._id);

    // Sincronizar estudiantes en GroupStudent para cada grupo
    const { GroupStudent } = await import('../models/GroupStudent');
    
    // Usar grupoIdsNormalizados que ya están normalizados
    for (const grupoIdNormalizado of grupoIdsNormalizados) {
      // Buscar o crear el grupo (ya está normalizado)
      let grupo = await Group.findOne({ nombre: grupoIdNormalizado, colegioId });
      if (!grupo) {
        // Si no existe, crearlo
        grupo = await Group.create({
          nombre: grupoIdNormalizado,
          descripcion: `Grupo ${grupoIdNormalizado}`,
          colegioId
        });
      }

      // Obtener estudiantes de este grupo específico
      const estudiantesDelGrupo = estudiantesEnGrupos.filter(e => 
        (e.curso as string)?.toUpperCase().trim() === grupoIdNormalizado
      );

      // Sincronizar estudiantes en GroupStudent
      for (const estudiante of estudiantesDelGrupo) {
        try {
          await GroupStudent.findOneAndUpdate(
            { grupoId: grupo._id, estudianteId: estudiante._id, colegioId },
            { grupoId: grupo._id, estudianteId: estudiante._id, colegioId },
            { upsert: true, new: true }
          );
        } catch (error: any) {
          // Ignorar errores de duplicados (índice único)
          if (error.code !== 11000) {
            console.error(`Error al sincronizar estudiante ${estudiante._id} en grupo ${grupoIdNormalizado}:`, error);
          }
        }
      }
    }

    // Buscar o crear el curso/materia
    let course = await Course.findOne({ 
      nombre: materiaNombre, 
      colegioId 
    });

    // Convertir profesorId a ObjectId para consistencia
    const profesorObjectId = new Types.ObjectId(normalizedProfesorId);

    if (!course) {
      // Buscar o crear la materia correspondiente
      const { Materia } = await import('../models/Materia');
      let materia = await Materia.findOne({ nombre: materiaNombre });
      if (!materia) {
        // Crear materia si no existe
        materia = await Materia.create({
          nombre: materiaNombre,
          descripcion: `Materia ${materiaNombre}`,
          area: 'General',
        });
      }

      // Crear el curso si no existe
      course = new Course({
        nombre: materiaNombre,
        materiaId: materia._id, // Campo requerido en nueva estructura
        profesorId: profesorObjectId, // Campo requerido
        estudiantes: estudianteIds, // Campo requerido
        // Campos adicionales para compatibilidad
        descripcion: `Curso de ${materiaNombre}`,
        colegioId,
        profesorIds: [profesorObjectId],
        cursos: grupoIdsNormalizados, // Array de grupos asignados normalizados (9A, 10B, etc.)
        estudianteIds: estudianteIds, // Estudiantes de esos grupos
      });
      await course.save();
      console.log(`[DEBUG assign-groups] Creado nuevo Course "${course.nombre}" con grupos: ${JSON.stringify(grupoIdsNormalizados)}`);
    } else {
      // Actualizar el curso existente
      // Añadir profesor si no está ya asignado (comparar como strings para compatibilidad)
      if (!course.profesorIds?.some(id => id.toString() === profesorId)) {
        course.profesorIds = course.profesorIds || [];
        course.profesorIds.push(profesorObjectId as any);
      }
      
      // Actualizar grupos asignados (normalizados)
      course.cursos = grupoIdsNormalizados;
      
      console.log(`[DEBUG assign-groups] Actualizando Course "${course.nombre}" con grupos: ${JSON.stringify(grupoIdsNormalizados)}`);
      
      // Actualizar estudiantes vinculados: agregar nuevos estudiantes sin duplicar
      const estudianteIdsSet = new Set(estudianteIds.map(id => id.toString()));
      const existingEstudianteIds = (course.estudianteIds || []).map(id => id.toString());
      existingEstudianteIds.forEach(id => estudianteIdsSet.add(id));
      
      course.estudianteIds = Array.from(estudianteIdsSet).map(id => new Types.ObjectId(id));
      course.estudiantes = course.estudianteIds; // Sincronizar con campo legacy
      
      await course.save();
      
      // CRÍTICO: También actualizar estudiantes que ya existen en los grupos
      // para asegurar que vean este curso si no estaban vinculados antes
      const estudiantesExistentesEnGrupos = await User.find({
        rol: 'estudiante',
        curso: { $in: grupoIdsNormalizados },
        colegioId
      }).select('_id');

      if (estudiantesExistentesEnGrupos.length > 0) {
        const estudiantesIdsExistentes = estudiantesExistentesEnGrupos.map(e => e._id);
        const estudiantesIdsSet = new Set(estudianteIds.map(id => id.toString()));
        
        estudiantesIdsExistentes.forEach(id => {
          estudiantesIdsSet.add(id.toString());
        });

        course.estudianteIds = Array.from(estudiantesIdsSet).map(id => new Types.ObjectId(id));
        course.estudiantes = course.estudianteIds;
        await course.save();
      }
    }

    res.json({ 
      message: 'Asignación guardada exitosamente.',
      course: {
        _id: course._id,
        nombre: course.nombre,
        grupoIds: course.cursos,
        estudiantesVinculados: estudianteIds.length,
      }
    });

  } catch (error) {
    console.error('Error al asignar grupos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// GET /api/professor/courses
// Obtener todas las materias del profesor con sus grupos asignados
// =========================================================================
router.get('/courses', protect, async (req: AuthRequest, res) => {
  try {
    const profesorId = req.user?.id;
    const colegioId = req.user?.colegioId || 'COLEGIO_DEMO_2025';

    if (!profesorId) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    const normalizedProfesorId = normalizeIdForQuery(profesorId);
    // Buscar todos los cursos donde el profesor está asignado (acepta ObjectId o string)
    const courses = await Course.find({
      $or: [
        { profesorIds: normalizedProfesorId },
        { profesorIds: new Types.ObjectId(normalizedProfesorId) },
      ],
      colegioId,
    }).select('nombre descripcion cursos estudianteIds colorAcento icono createdAt');

    // Formatear la respuesta con información detallada
    const formattedCourses = courses.map(course => ({
      _id: course._id,
      nombre: course.nombre,
      descripcion: course.descripcion,
      grupoIds: course.cursos || [],
      totalEstudiantes: course.estudianteIds?.length || 0,
      colorAcento: course.colorAcento,
      icono: course.icono,
    }));

    res.json({ 
      courses: formattedCourses,
      total: formattedCourses.length
    });

  } catch (error) {
    console.error('Error al obtener cursos del profesor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// =========================================================================
// GET /api/professor/my-groups
// Obtener los grupos del profesor autenticado en formato ProfessorGroupAssignment[]
// =========================================================================
router.get('/my-groups', protect, async (req: AuthRequest, res) => {
  try {
    const profesorId = req.user?.id;
    const colegioId = req.user?.colegioId || 'COLEGIO_DEMO_2025';

    // Normalizar ID del profesor
    const normalizedProfesorId = normalizeIdForQuery(profesorId || '');

    console.log('my-groups: profesorId=', normalizedProfesorId, 'colegioId=', colegioId);

    // Buscar cursos donde el profesor está asignado (buscar con string y ObjectId)
    const courses = await Course.find({ 
      $or: [
        { profesorIds: normalizedProfesorId },
        { profesorIds: new Types.ObjectId(normalizedProfesorId) }
      ],
      colegioId 
    }).select('nombre descripcion cursos estudianteIds colorAcento icono');

    console.log('my-groups: found courses=', courses.length);

    // Agrupar por grupo (groupId)
    const groupMap = new Map<string, { subjects: any[], studentIds: Set<string> }>();
    const { Group } = await import('../models/Group');
    
    // Recolectar todos los posibles ObjectIds para buscar en batch
    const possibleObjectIds = new Set<string>();
    const groupIdMap = new Map<string, string>(); // Mapa de ObjectId -> nombre del grupo
    
    // Primera pasada: identificar ObjectIds y strings
    for (const course of courses) {
      const grupoIds = course.cursos || [];
      for (const groupId of grupoIds) {
        const groupIdStr = String(groupId);
        // Si parece un ObjectId (24 caracteres hexadecimales)
        if (/^[0-9a-fA-F]{24}$/.test(groupIdStr)) {
          possibleObjectIds.add(groupIdStr);
        }
      }
    }
    
    // Buscar todos los grupos por ObjectId en una sola query
    if (possibleObjectIds.size > 0) {
      try {
        console.log(`[my-groups] Buscando ${possibleObjectIds.size} grupos por ObjectId`);
        // Primero intentar con colegioId
        let groups = await Group.find({ 
          _id: { $in: Array.from(possibleObjectIds).map(id => new Types.ObjectId(id)) },
          colegioId 
        });
        
        // Si no encuentra todos, intentar sin filtrar por colegioId (por si hay grupos de otros colegios)
        const foundIds = new Set(groups.map(g => g._id.toString()));
        const missingIds = Array.from(possibleObjectIds).filter(id => !foundIds.has(id));
        
        if (missingIds.length > 0) {
          console.log(`[my-groups] No se encontraron ${missingIds.length} grupos con colegioId, buscando sin filtro`);
          const additionalGroups = await Group.find({ 
            _id: { $in: missingIds.map(id => new Types.ObjectId(id)) }
          });
          groups = [...groups, ...additionalGroups];
        }
        
        groups.forEach(group => {
          const groupIdStr = group._id.toString();
          groupIdMap.set(groupIdStr, group.nombre.toUpperCase().trim());
          console.log(`[my-groups] Mapeado: ${groupIdStr} -> ${group.nombre.toUpperCase().trim()}`);
        });
        
        // Verificar si quedaron ObjectIds sin mapear
        const unmappedIds = Array.from(possibleObjectIds).filter(id => !groupIdMap.has(id));
        if (unmappedIds.length > 0) {
          console.warn(`[my-groups] ⚠️ No se encontraron ${unmappedIds.length} grupos:`, unmappedIds);
        }
      } catch (error) {
        console.error('[my-groups] Error al buscar grupos por IDs:', error);
      }
    }
    
    // Segunda pasada: agrupar por nombre del grupo
    for (const course of courses) {
      const grupoIds = course.cursos || [];
      for (const groupId of grupoIds) {
        const groupIdStr = String(groupId);
        let normalizedGroupId: string;
        
        // Si es un ObjectId, buscar el nombre en el mapa
        if (/^[0-9a-fA-F]{24}$/.test(groupIdStr)) {
          normalizedGroupId = groupIdMap.get(groupIdStr);
          if (!normalizedGroupId) {
            console.warn(`[my-groups] ⚠️ No se encontró nombre para ObjectId: ${groupIdStr}, usando ObjectId como fallback`);
            // Si no se encuentra, intentar buscar directamente
            try {
              const group = await Group.findById(groupIdStr);
              if (group) {
                normalizedGroupId = group.nombre.toUpperCase().trim();
                groupIdMap.set(groupIdStr, normalizedGroupId);
                console.log(`[my-groups] Encontrado en búsqueda directa: ${groupIdStr} -> ${normalizedGroupId}`);
              } else {
                normalizedGroupId = groupIdStr; // Fallback: usar el ObjectId si no se encuentra
              }
            } catch (error) {
              normalizedGroupId = groupIdStr; // Fallback: usar el ObjectId si hay error
            }
          }
        } else {
          // Si es un string normal, normalizarlo
          normalizedGroupId = groupIdStr.toUpperCase().trim();
        }
        
        if (!groupMap.has(normalizedGroupId)) {
          groupMap.set(normalizedGroupId, { subjects: [], studentIds: new Set() });
        }
        const entry = groupMap.get(normalizedGroupId)!;
        entry.subjects.push({
          _id: course._id,
          nombre: course.nombre,
          descripcion: course.descripcion,
          colorAcento: course.colorAcento,
          icono: course.icono,
        });
        // Agregar estudiantes del curso a este grupo
        (course.estudianteIds || []).forEach(id => entry.studentIds.add(id.toString()));
      }
    }

    // Convertir a array de ProfessorGroupAssignment
    const result = Array.from(groupMap.entries()).map(([groupId, data]) => ({
      groupId,
      subjects: data.subjects,
      totalStudents: data.studentIds.size,
    }));

    res.json(result);

  } catch (error) {
    console.error('Error al obtener grupos del profesor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
