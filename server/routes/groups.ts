import express from 'express';
import {
  findGroupById,
  findGroupByNameAndInstitution,
  findGroupByNameAndInstitutionCaseInsensitive,
  findGroupsByInstitution,
  createGroup,
} from '../repositories/groupRepository.js';
import { resolveGroupId } from '../utils/resolveLegacyCourse.js';
import {
  findSectionById,
  findSectionsByInstitution,
  findSectionByInstitutionAndName,
} from '../repositories/sectionRepository.js';
import { findGroupSubjectsByGroupWithDetails } from '../repositories/groupSubjectRepository.js';
import {
  findEnrollmentsByGroup,
  findEnrollment,
  createEnrollment,
  countEnrollmentsByGroupIds,
} from '../repositories/enrollmentRepository.js';
import { findUserById, findUsersByInstitution, updateUser } from '../repositories/userRepository.js';
import { findGradesByGroup } from '../repositories/gradeRepository.js';
import { findActiveAcademicPeriodForInstitution } from '../repositories/academicPeriodRepository.js';
import { protect, AuthRequest } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogger.js';

const router = express.Router();

const LEGACY_SECTION_NAMES: Record<string, string> = {
  'junior-school': 'Junior School',
  'middle-school': 'Middle School',
  'high-school': 'High School',
};

async function resolveSectionId(
  institutionId: string,
  sectionId?: string | null,
  legacySeccion?: string | null
): Promise<string | null> {
  if (sectionId) {
    const section = await findSectionById(sectionId);
    if (section && section.institution_id === institutionId) return section.id;
  }
  if (legacySeccion && LEGACY_SECTION_NAMES[legacySeccion]) {
    const name = LEGACY_SECTION_NAMES[legacySeccion];
    const section = await findSectionByInstitutionAndName(institutionId, name);
    if (section) return section.id;
  }
  const sections = await findSectionsByInstitution(institutionId);
  return sections[0]?.id ?? null;
}

function calcularEstado(promedio?: number): 'excelente' | 'bueno' | 'regular' | 'bajo' {
  if (!promedio || promedio === 0) return 'regular';
  if (promedio >= 4.5) return 'excelente';
  if (promedio >= 4.0) return 'bueno';
  if (promedio >= 3.5) return 'regular';
  return 'bajo';
}

// POST /api/groups/create
router.post('/create', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'admin-general-colegio' && user.role !== 'school_admin') {
      return res.status(403).json({ message: 'Solo administradores generales del colegio pueden crear grupos' });
    }

    const { nombre, seccion, directorGrupoId, sectionId } = req.body;
    if (!nombre) return res.status(400).json({ message: 'Falta el nombre del curso/grupo.' });
    const useLegacySeccion = seccion != null && seccion !== '';
    if (useLegacySeccion) {
      const seccionesValidas = ['junior-school', 'middle-school', 'high-school'];
      if (!seccionesValidas.includes(seccion)) {
        return res.status(400).json({ message: 'Sección inválida. Debe ser: junior-school, middle-school o high-school.' });
      }
    }
    if (!useLegacySeccion && !sectionId) {
      return res.status(400).json({ message: 'Indica la sección (junior-school, middle-school, high-school) o la sección del módulo (sectionId).' });
    }

    if (directorGrupoId) {
      const director = await findUserById(directorGrupoId);
      if (!director) return res.status(404).json({ message: 'Director de grupo no encontrado' });
      if (director.role !== 'profesor') return res.status(400).json({ message: 'El director de grupo debe ser un profesor' });
      if (director.institution_id !== colegioId) return res.status(403).json({ message: 'El director de grupo debe pertenecer al mismo colegio' });
    }

    const nombreCompleto = String(nombre).toUpperCase().trim();
    const existente = await findGroupByNameAndInstitutionCaseInsensitive(colegioId, nombreCompleto);
    if (existente) return res.status(400).json({ message: `El grupo ${nombreCompleto} ya existe` });

    const resolvedSectionId = await resolveSectionId(colegioId, sectionId, useLegacySeccion ? seccion : null);
    if (!resolvedSectionId) {
      return res.status(400).json({ message: 'No se encontró una sección válida. Crea una sección desde el módulo Secciones.' });
    }

    const nuevoGrupo = await createGroup({
      institution_id: colegioId,
      section_id: resolvedSectionId,
      name: nombreCompleto,
      description: `Grupo ${nombreCompleto}`,
    });

    await logAdminAction({
      userId,
      role: user.role,
      action: 'create_group',
      entityType: 'group',
      entityId: nuevoGrupo.id,
      colegioId,
      requestData: { nombre: nombreCompleto, seccion: useLegacySeccion ? seccion : undefined, sectionId: resolvedSectionId },
    }).catch(() => {});

    res.status(201).json({
      message: 'Grupo creado exitosamente',
      grupo: {
        _id: nuevoGrupo.id,
        id: nuevoGrupo.id,
        nombre: nuevoGrupo.name,
        descripcion: nuevoGrupo.description,
        colegioId: nuevoGrupo.institution_id,
        sectionId: nuevoGrupo.section_id,
      },
    });
  } catch (error: unknown) {
    console.error('Error al crear grupo:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al crear el grupo.' });
  }
});

// POST /api/groups/assign-student
router.post('/assign-student', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(403).json({ message: 'No autorizado' });
    const admin = await findUserById(userId);
    if (!admin || (admin.role !== 'admin-general-colegio' && admin.role !== 'school_admin')) {
      return res.status(403).json({ message: 'Solo administradores generales del colegio pueden asignar estudiantes a cursos.' });
    }

    const { grupoId, estudianteId } = req.body;
    if (!grupoId || !estudianteId) return res.status(400).json({ message: 'Faltan grupoId y estudianteId.' });

    const grupoNombre = String(grupoId).toUpperCase().trim();
    const grupo = await findGroupByNameAndInstitution(colegioId, grupoNombre);
    if (!grupo) {
      return res.status(404).json({ message: `El curso/grupo ${grupoNombre} no existe. Créalo primero desde Crear Curso.` });
    }

    const estudiante = await findUserById(estudianteId);
    if (!estudiante || estudiante.role !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (estudiante.institution_id !== colegioId) {
      return res.status(403).json({ message: 'El estudiante debe pertenecer al mismo colegio.' });
    }

    const period = await findActiveAcademicPeriodForInstitution(colegioId);
    const existente = await findEnrollment(estudianteId, grupo.id, period?.id ?? null);
    if (existente) return res.status(400).json({ message: 'El estudiante ya está asignado a este curso.' });

    await createEnrollment({
      student_id: estudianteId,
      group_id: grupo.id,
      academic_period_id: period?.id ?? null,
    });

    // Si el grupo es un grado real (ej: "11H"), también enrollar en sus grupos-materia
    const esGradoReal = /^\d+[A-Za-z]+$/.test(grupo.name);
    if (esGradoReal) {
      const todosGrupos = await findGroupsByInstitution(colegioId);
      const gruposMateria = todosGrupos.filter(
        (g) => /^[^\d]/.test(g.name) && g.name.endsWith(' ' + grupo.name)
      );
      for (const gm of gruposMateria) {
        try {
          await createEnrollment({
            student_id: estudianteId,
            group_id: gm.id,
            academic_period_id: period?.id ?? null,
          });
        } catch (_) {}
      }
    }
    // Mantener config.curso solo con el grado real para compatibilidad (no es fuente de verdad)
    await updateUser(estudianteId, { config: { ...estudiante.config, curso: grupoNombre } });

    await logAdminAction({
      userId,
      role: admin.role,
      action: 'assign_student',
      entityType: 'group',
      entityId: grupo.id,
      colegioId,
      requestData: { grupoId: grupoNombre, estudianteId },
    }).catch(() => {});

    res.status(201).json({
      message: 'Estudiante asignado al curso correctamente.',
      grupoId: grupoNombre,
      estudianteId,
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === '23505') return res.status(400).json({ message: 'El estudiante ya está asignado a este curso.' });
    console.error('Error al asignar estudiante a curso:', (e as Error).message);
    res.status(500).json({ message: 'Error al asignar estudiante al curso.' });
  }
});

// GET /api/groups/all
router.get('/all', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado' });
    const groups = await findGroupsByInstitution(colegioId);
    const groupIds = groups.map((g) => g.id);
    const counts = await countEnrollmentsByGroupIds(groupIds);
    const result = await Promise.all(
      groups.map(async (g) => {
        const materias = await findGroupSubjectsByGroupWithDetails(g.id, colegioId);
        return {
          _id: g.id,
          id: g.id,
          nombre: g.name,
          materias: materias.map((m) => ({
            group_subject_id: m.id,
            subject_id: m.subject_id,
            subject_name: m.subject_name,
            teacher_id: m.teacher_id,
            teacher_name: m.teacher_name,
          })),
          cantidadEstudiantes: counts[g.id] ?? 0,
        };
      })
    );
    res.json(result);
  } catch (error: unknown) {
    console.error('Error al obtener grupos:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/groups/:groupId/students — grupoId puede ser UUID o nombre/legacy
router.get('/:groupId/students', protect, async (req: AuthRequest, res) => {
  try {
    const groupIdParam = decodeURIComponent(req.params.groupId ?? '');
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado' });

    const resolved = await resolveGroupId(groupIdParam, colegioId);
    if (!resolved) return res.status(404).json({ message: 'Grupo no encontrado.' });
    const group = { id: resolved.id, institution_id: colegioId };

    const enrollments = await findEnrollmentsByGroup(resolved.id);
    const studentIds = [...new Set(enrollments.map((e) => e.student_id))];
    const allInstitution = await findUsersByInstitution(colegioId);
    const byId = new Map(allInstitution.filter((u) => studentIds.includes(u.id)).map((u) => [u.id, u]));

    const grades = await findGradesByGroup(resolved.id);
    const promediosPorEstudiante: Record<string, { suma: number; cantidad: number }> = {};
    grades.forEach((g) => {
      const uid = g.user_id;
      if (!promediosPorEstudiante[uid]) promediosPorEstudiante[uid] = { suma: 0, cantidad: 0 };
      if (g.max_score > 0) {
        const norm = g.normalized_score ?? g.score / g.max_score;
        promediosPorEstudiante[uid].suma += norm * 5;
        promediosPorEstudiante[uid].cantidad += 1;
      }
    });

    const students = Array.from(byId.entries()).map(([estudianteId, u]) => {
      const promedioData = promediosPorEstudiante[estudianteId];
      const promedio =
        promedioData && promedioData.cantidad > 0 ? promedioData.suma / promedioData.cantidad : undefined;
      return { _id: estudianteId, nombre: u.full_name || 'Estudiante', estado: calcularEstado(promedio) };
    });

    res.json(students);
  } catch (error: unknown) {
    console.error('Error al obtener estudiantes del grupo:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/groups/:groupId/sync-students
router.post('/:groupId/sync-students', protect, async (req: AuthRequest, res) => {
  try {
    const groupIdParam = decodeURIComponent(req.params.groupId ?? '');
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado' });

    const resolved = await resolveGroupId(groupIdParam, colegioId);
    if (!resolved) return res.status(404).json({ message: 'Grupo no encontrado.' });
    const group = { id: resolved.id, name: resolved.name, institution_id: colegioId };

    const allUsers = await findUsersByInstitution(colegioId);
    const grupoIdNorm = resolved.name.toUpperCase();
    const estudiantesEnUser = allUsers.filter(
      (u) =>
        u.role === 'estudiante' &&
        ((u.config as { curso?: string })?.curso?.toUpperCase() === grupoIdNorm ||
          (u.config as { curso?: string })?.curso === groupIdParam)
    );
    const enrollments = await findEnrollmentsByGroup(resolved.id);
    const idsExistentes = new Set(enrollments.map((e) => e.student_id));
    const period = await findActiveAcademicPeriodForInstitution(colegioId);
    let sincronizados = 0;
    for (const u of estudiantesEnUser) {
      if (idsExistentes.has(u.id)) continue;
      try {
        await createEnrollment({
          student_id: u.id,
          group_id: resolved.id,
          academic_period_id: period?.id ?? null,
        });
        await updateUser(u.id, { config: { ...u.config, curso: resolved.name } });
        sincronizados++;
      } catch (_) {}
    }
    // Si el grupo es grado real, también sincronizar grupos-materia para cada estudiante
    const esGradoReal = /^\d+[A-Za-z]+$/.test(group.name);
    if (esGradoReal) {
      const todosGrupos = await findGroupsByInstitution(colegioId);
      const gruposMateria = todosGrupos.filter(
        (g) => /^[^\d]/.test(g.name) && g.name.endsWith(' ' + group.name)
      );
      for (const u of estudiantesEnUser) {
        for (const gm of gruposMateria) {
          try {
            await createEnrollment({
              student_id: u.id,
              group_id: gm.id,
              academic_period_id: period?.id ?? null,
            });
          } catch (_) {}
        }
      }
    }

    res.json({
      message: sincronizados === 0 ? 'Todos los estudiantes ya están sincronizados' : 'Sincronización completada',
      grupoId: grupoIdNorm,
      estudiantesSincronizados: sincronizados,
      totalEstudiantes: estudiantesEnUser.length,
    });
  } catch (error: unknown) {
    console.error('Error al sincronizar estudiantes:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/groups/lookup/:objectId
router.get('/lookup/:objectId', protect, async (req: AuthRequest, res) => {
  try {
    const { objectId } = req.params;
    const group = await findGroupById(objectId);
    if (!group) {
      return res.status(404).json({
        message: 'Grupo no encontrado.',
        objectId,
        suggestion: 'Este ID no corresponde a ningún grupo en la base de datos.',
      });
    }
    res.json({
      objectId: group.id,
      nombre: group.name,
      descripcion: group.description,
      colegioId: group.institution_id,
      createdAt: group.created_at,
      message: `Este ID corresponde al grupo: ${group.name}`,
    });
  } catch (error: unknown) {
    console.error('Error al buscar grupo:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/groups/:id
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    const group =
      id.length === 36 && id.includes('-')
        ? await findGroupById(id)
        : await findGroupByNameAndInstitution(colegioId || '', id.toUpperCase().trim());
    if (!group) return res.status(404).json({ message: 'Grupo no encontrado.' });
    if (colegioId && group.institution_id !== colegioId) return res.status(404).json({ message: 'Grupo no encontrado.' });
    res.json({
      _id: group.id,
      id: group.id,
      nombre: group.name,
      descripcion: group.description,
      colegioId: group.institution_id,
      sectionId: group.section_id,
    });
  } catch (error: unknown) {
    console.error('Error al obtener grupo:', (error as Error).message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
