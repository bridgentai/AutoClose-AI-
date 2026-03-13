import express, { Response, NextFunction } from 'express';
import { protect, AuthRequest, checkAdminColegioOnly } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { logAdminAction } from '../services/auditLogger.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupById, findGroupByNameAndInstitution, findGroupsByInstitution } from '../repositories/groupRepository.js';
import { getFirstGroupNameForStudent, getFirstGroupForStudent, getAllCourseGroupsForStudent } from '../repositories/enrollmentRepository.js';
import {
  findSubjectById,
  findSubjectsByInstitution,
  findSubjectByNameAndInstitution,
  createSubject,
  updateSubject,
} from '../repositories/subjectRepository.js';
import {
  findGroupSubjectsByGroup,
  findGroupSubjectsByGroupWithDetails,
  findGroupSubjectsByTeacher,
  findGroupSubjectsByTeacherWithDetails,
  findGroupSubjectById,
  createGroupSubject,
} from '../repositories/groupSubjectRepository.js';
import { findAcademicFeedWithDetails, createAnnouncement } from '../repositories/announcementRepository.js';
import { findEnrollmentsByGroup } from '../repositories/enrollmentRepository.js';
import { findGuardianStudentsByGuardian } from '../repositories/guardianStudentRepository.js';
import { findUsersByIds } from '../repositories/userRepository.js';
import { findGradingSchemaByGroup } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';

const router = express.Router();

const checkIsDirectivo = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.rol === 'directivo') next();
  else res.status(403).json({ message: 'Acceso denegado. Solo Directivos pueden realizar esta acción.' });
};

const checkIsDirectivoOrAdminColegio = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && (req.user.rol === 'directivo' || req.user.rol === 'admin-general-colegio' || req.user.rol === 'school_admin')) next();
  else res.status(403).json({ message: 'Acceso denegado. Solo Directivos o Administradores del Colegio pueden realizar esta acción.' });
};

function toCourseResponse(gs: { id: string; subject_id: string; group_id: string; teacher_id: string; institution_id: string; created_at: string }, subject: { id: string; name: string; description: string | null } | null, teacher: { id: string; full_name: string; email: string } | null, groupName?: string) {
  return {
    _id: gs.id,
    id: gs.id,
    nombre: subject?.name ?? '',
    descripcion: subject?.description ?? '',
    colorAcento: '',
    icono: '',
    cursos: groupName ? [groupName] : [],
    profesorIds: teacher ? [{ _id: teacher.id, nombre: teacher.full_name, email: teacher.email }] : [],
    colegioId: gs.institution_id,
  };
}

// Rutas con path fijo primero (antes de /:id)
// GET /api/courses/for-group/:grupo
router.get('/for-group/:grupo', protect, async (req: AuthRequest, res) => {
  try {
    const { grupo } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'profesor') return res.status(403).json({ message: 'Solo los profesores pueden acceder a esta ruta' });
    const group = await findGroupByNameAndInstitution(colegioId, grupo.toUpperCase().trim());
    if (!group) return res.json([]);
    const list = await findGroupSubjectsByGroupWithDetails(group.id, colegioId);
    const byTeacher = list.filter((gs) => gs.teacher_id === userId);
    const courses = byTeacher.map((gs) =>
      toCourseResponse(gs, { id: gs.subject_id, name: gs.subject_name, description: gs.subject_description }, { id: gs.teacher_id, full_name: gs.teacher_name, email: gs.teacher_email }, gs.group_name)
    );
    res.json(courses);
  } catch (error: unknown) {
    console.error('Error al obtener materias para grupo:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// GET /api/courses/by-name
router.get('/by-name', protect, async (req: AuthRequest, res) => {
  const name = (req.query.name || req.query.nombre) as string;
  if (!name || typeof name !== 'string') return res.status(400).json({ message: 'El parámetro de nombre es obligatorio.' });
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado' });
    const subject = await findSubjectByNameAndInstitution(colegioId, name);
    if (!subject) return res.status(404).json({ message: 'Materia no encontrada con ese nombre en este colegio.' });
    res.json({ _id: subject.id, nombre: subject.name, id: subject.id });
  } catch (error: unknown) {
    console.error('Error al buscar materia por nombre:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/courses/academic-feed — notificaciones académicas (nuevas tareas, notas)
router.get('/academic-feed', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByGroupWithDetails>>[number];
    let gsList: GsDetails[] = [];
    if (user.role === 'estudiante') {
      let curso = (user.config as { curso?: string })?.curso;
      if (!curso) curso = await getFirstGroupNameForStudent(userId) ?? undefined;
      const group = curso ? await findGroupByNameAndInstitution(colegioId, curso.toUpperCase().trim()) : null;
      const groupFallback = group ?? await getFirstGroupForStudent(userId, colegioId);
      if (groupFallback) gsList = await findGroupSubjectsByGroupWithDetails(groupFallback.id, colegioId);
    } else if (user.role === 'profesor') {
      gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) gsList.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    const groupSubjectIds = gsList.length ? gsList.map((gs) => gs.id) : undefined;
    const feed = await findAcademicFeedWithDetails(colegioId, { groupSubjectIds });
    res.json(feed.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      assignment_id: row.assignment_id,
      group_subject_id: row.group_subject_id,
      created_at: row.created_at,
      subject_name: row.subject_name,
      group_name: row.group_name,
    })));
  } catch (error: unknown) {
    console.error('Error al obtener feed académico:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// GET /api/courses/group-subjects-options — opciones para "Enviar a" (profesor/directivo/asistente)
router.get('/group-subjects-options', protect, requireRole('profesor', 'directivo', 'asistente', 'admin-general-colegio', 'school_admin'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByGroupWithDetails>>[number];
    let gsList: GsDetails[] = [];
    if (user.role === 'profesor') {
      gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) gsList.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    res.json(gsList.map((gs) => ({ id: gs.id, subject_name: gs.subject_name, group_name: gs.group_name })));
  } catch (error: unknown) {
    console.error('Error al obtener opciones de envío:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// POST /api/courses/academic-message — enviar mensaje académico a un curso (profesor/directivo/asistente)
router.post('/academic-message', protect, requireRole('profesor', 'directivo', 'asistente', 'admin-general-colegio', 'school_admin'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId ?? req.user?.institution_id;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const body = req.body as { title?: string; body?: string; group_subject_id?: string; groupSubjectId?: string };
    const title = body?.title;
    const groupSubjectId = body?.group_subject_id ?? body?.groupSubjectId;
    if (!title || typeof title !== 'string' || title.trim() === '') return res.status(400).json({ message: 'El título es obligatorio.' });
    if (!groupSubjectId || typeof groupSubjectId !== 'string') return res.status(400).json({ message: 'Debe indicar el curso de destino (group_subject_id).' });
    const gs = await findGroupSubjectById(groupSubjectId);
    if (!gs || gs.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const user = await findUserById(userId);
    if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });
    if (user.role === 'profesor') {
      const myGs = await findGroupSubjectsByTeacher(userId, colegioId);
      if (!myGs.some((x) => x.id === groupSubjectId)) return res.status(403).json({ message: 'Solo puede enviar mensajes a sus propios cursos.' });
    }
    const created = await createAnnouncement({
      institution_id: colegioId,
      title: title.trim(),
      body: body.body && typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : null,
      type: 'mensaje_academico',
      group_id: gs.group_id,
      group_subject_id: groupSubjectId,
      created_by_id: userId,
    });
    res.status(201).json({ id: created.id, title: created.title, created_at: created.created_at });
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    console.error('Error al enviar mensaje académico:', err.message, err.stack);
    const message = err.code === '23503' ? 'Datos inconsistentes (curso o institución no encontrada).' : (err.message || 'Error en el servidor.');
    res.status(500).json({ message });
  }
});

// GET /api/courses/academic-groups
router.get('/academic-groups', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByGroupWithDetails>>[number];
    let gsList: GsDetails[] = [];
    if (user.role === 'estudiante') {
      let curso = (user.config as { curso?: string })?.curso;
      if (!curso) curso = await getFirstGroupNameForStudent(userId) ?? undefined;
      let group = curso ? await findGroupByNameAndInstitution(colegioId, curso.toUpperCase().trim()) : null;
      if (!group) group = await getFirstGroupForStudent(userId, colegioId);
      if (group) gsList = await findGroupSubjectsByGroupWithDetails(group.id, colegioId);
    } else if (user.role === 'profesor') {
      gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) gsList.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    const bySubject = new Map<string, { materiaId: string; materiaNombre: string; materiaDescripcion: string | null; profesores: { _id: string; nombre: string; email: string }[]; estudiantes: { _id: string; nombre: string; email: string }[]; cursos: string[] }>();
    for (const gs of gsList) {
      const sid = gs.subject_id;
      if (!bySubject.has(sid)) {
        bySubject.set(sid, { materiaId: sid, materiaNombre: gs.subject_name, materiaDescripcion: gs.subject_description, profesores: [], estudiantes: [], cursos: [] });
      }
      const row = bySubject.get(sid)!;
      if (!row.profesores.some((p) => p._id === gs.teacher_id)) row.profesores.push({ _id: gs.teacher_id, nombre: gs.teacher_name, email: gs.teacher_email });
      if (!row.cursos.includes(gs.group_name)) row.cursos.push(gs.group_name);
      const enrollments = await findEnrollmentsByGroup(gs.group_id);
      const studentIds = enrollments.map((e) => e.student_id);
      if (studentIds.length) {
        const users = await findUsersByIds(studentIds);
        users.forEach((u) => { if (!row.estudiantes.some((e) => e._id === u.id)) row.estudiantes.push({ _id: u.id, nombre: u.full_name, email: u.email }); });
      }
    }
    res.json(Array.from(bySubject.values()));
  } catch (error: unknown) {
    console.error('Error al obtener grupos académicos:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al obtener grupos académicos.' });
  }
});

// GET /api/courses - Listar cursos según rol
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    type GsDetails = Awaited<ReturnType<typeof findGroupSubjectsByTeacherWithDetails>>[number];
    let list: GsDetails[] = [];
    if (user.role === 'profesor') {
      list = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    } else {
      const groups = await findGroupsByInstitution(colegioId);
      for (const g of groups) list.push(...(await findGroupSubjectsByGroupWithDetails(g.id, colegioId)));
    }
    const courses = list.map((gs) =>
      toCourseResponse(gs, { id: gs.subject_id, name: gs.subject_name, description: gs.subject_description }, { id: gs.teacher_id, full_name: gs.teacher_name, email: gs.teacher_email }, gs.group_name)
    );
    res.json(courses);
  } catch (error: unknown) {
    console.error('Error al cargar cursos:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al cargar los cursos.' });
  }
});

// GET /api/courses/:id/details
router.get('/:id/details', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'estudiante' && user.role !== 'padre') {
      return res.status(403).json({ message: 'Solo estudiantes y padres pueden acceder a los detalles de materias desde esta ruta' });
    }

    const gs = await findGroupSubjectById(id);
    const subject = gs ? await findSubjectById(gs.subject_id) : await findSubjectById(id);
    if (!subject) return res.status(404).json({ message: 'Materia no encontrada' });
    if (subject.institution_id !== colegioId) return res.status(403).json({ message: 'No tienes acceso a esta materia.' });

    let cursoPermitido = false;
    if (user.role === 'estudiante') {
      const courseGroups = await getAllCourseGroupsForStudent(userId, colegioId);
      if (gs) {
        cursoPermitido = courseGroups.some((g) => g.id === gs.group_id);
      } else {
        const allGs = (await Promise.all(
          courseGroups.map((g) => findGroupSubjectsByGroup(g.id))
        )).flat();
        cursoPermitido = allGs.some((x) => x.subject_id === id);
      }
    } else if (user.role === 'padre') {
      const links = await findGuardianStudentsByGuardian(userId);
      for (const link of links) {
        const hijoGroups = await getAllCourseGroupsForStudent(link.student_id, colegioId);
        if (gs) {
          if (hijoGroups.some((g) => g.id === gs.group_id)) {
            cursoPermitido = true;
            break;
          }
        } else {
          const allGs = (await Promise.all(
            hijoGroups.map((g) => findGroupSubjectsByGroup(g.id))
          )).flat();
          if (allGs.some((x) => x.subject_id === id)) {
            cursoPermitido = true;
            break;
          }
        }
      }
    }
    if (!cursoPermitido) return res.status(403).json({ message: 'No tienes acceso a esta materia.' });

    const teacher = gs ? await findUserById(gs.teacher_id) : null;
    const cursoAsignado = user.role === 'estudiante' ? (await getFirstGroupNameForStudent(userId)) ?? undefined : undefined;
    res.json({
      _id: subject.id,
      nombre: subject.name,
      descripcion: subject.description,
      colorAcento: '',
      icono: '',
      cursos: gs ? [(await findGroupById(gs.group_id))?.name].filter(Boolean) : [],
      cursoAsignado,
      profesor: teacher ? { _id: teacher.id, nombre: teacher.full_name, email: teacher.email } : null,
      profesorIds: teacher ? [{ _id: teacher.id, nombre: teacher.full_name, email: teacher.email }] : [],
    });
  } catch (error: unknown) {
    console.error('Error al obtener materia:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al obtener la materia.' });
  }
});

// GET /api/courses/:id/grading-schema
router.get('/:id/grading-schema', protect, async (req: AuthRequest, res) => {
  try {
    const courseId = req.params.id;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const gs = await findGroupSubjectById(courseId);
    const groupId = gs?.group_id ?? courseId;
    const schema = await findGradingSchemaByGroup(groupId, gs?.institution_id);
    if (!schema) return res.json({ schema: null, categories: [] });
    const categories = await findGradingCategoriesBySchema(schema.id);
    return res.json({
      schema: { _id: schema.id, ...schema },
      categories: categories.map((c) => ({ _id: c.id, ...c })),
    });
  } catch (e: unknown) {
    console.error('Error GET grading-schema:', e);
    return res.status(500).json({ message: 'Error al obtener esquema de calificación.' });
  }
});

// GET /api/courses/:id/snapshots | forecast | risk | insights | analytics-summary | intelligence - stubs
router.get('/:id/snapshots', protect, async (_req, res) => res.json([]));
router.get('/:id/forecast', protect, async (_req, res) => res.json({ forecast: [] }));
router.get('/:id/risk', protect, async (_req, res) => res.json({ risks: [] }));
router.get('/:id/insights', protect, async (_req, res) => res.json({ insights: [] }));
router.get('/:id/analytics-summary', protect, async (_req, res) => res.json({ summary: null }));
router.get('/:id/intelligence', protect, async (_req, res) => res.json({ intelligence: null }));

// POST /api/courses - Crear curso (subject + group_subjects)
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (user.role !== 'profesor' && user.role !== 'directivo') {
      return res.status(403).json({ message: 'Solo profesores y directivos pueden crear cursos' });
    }
    const { nombre, descripcion, cursos, colorAcento, icono } = req.body;
    const name = String(nombre || '').trim();
    if (!name) return res.status(400).json({ message: 'Falta el nombre del curso.' });
    let subject = await findSubjectByNameAndInstitution(colegioId, name);
    if (!subject) subject = await createSubject({ institution_id: colegioId, name, description: descripcion || `Materia ${name}` });
    const groupNames = Array.isArray(cursos) ? cursos.map((c: string) => String(c).toUpperCase().trim()) : [];
    const teacherId = user.role === 'profesor' ? userId : userId;
    for (const gName of groupNames) {
      const group = await findGroupByNameAndInstitution(colegioId, gName);
      if (group) {
        try {
          await createGroupSubject({
            institution_id: colegioId,
            group_id: group.id,
            subject_id: subject.id,
            teacher_id: teacherId,
          });
        } catch (_) {}
      }
    }
    if (user.role === 'profesor') {
      const materias = (user.config as { materias?: string[] })?.materias ?? [];
      if (!materias.includes(name)) await import('../repositories/userRepository.js').then(({ updateUser }) => updateUser(userId, { config: { ...user.config, materias: [...materias, name] } }));
    }
    res.status(201).json({
      _id: subject.id,
      nombre: subject.name,
      descripcion: subject.description,
      colorAcento: colorAcento || '',
      icono: icono || '',
      cursos: groupNames,
      colegioId,
    });
  } catch (error: unknown) {
    console.error('Error al crear curso:', (error as Error).message);
    res.status(500).json({ message: 'Error en el servidor al crear el curso.' });
  }
});

// POST /api/courses/assign-professor-to-groups
router.post('/assign-professor-to-groups', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(400).json({ message: 'Colegio no definido.' });
    const { professorId, groupNames } = req.body as { professorId?: string; groupNames?: string[] };
    if (!professorId || !Array.isArray(groupNames) || groupNames.length === 0) {
      return res.status(400).json({ message: 'Se requiere professorId y groupNames (array de nombres de curso/grupo).' });
    }
    const professor = await findUserById(professorId);
    if (!professor || professor.role !== 'profesor') return res.status(404).json({ message: 'Profesor no encontrado o rol incorrecto.' });
    if (professor.institution_id !== colegioId) return res.status(403).json({ message: 'El profesor debe pertenecer a tu colegio.' });
    const materias = (professor.config as { materias?: string[] })?.materias;
    const materiaNombre = Array.isArray(materias) && materias.length > 0 ? String(materias[0]).trim() : '';
    if (!materiaNombre) return res.status(400).json({ message: 'El profesor debe tener al menos una materia asignada.' });
    const normalizedGroups = groupNames.map((g: string) => String(g).toUpperCase().trim()).filter(Boolean);
    let subject = await findSubjectByNameAndInstitution(colegioId, materiaNombre);
    if (!subject) subject = await createSubject({ institution_id: colegioId, name: materiaNombre, description: `Materia ${materiaNombre}` });
    for (const gName of normalizedGroups) {
      const group = await findGroupByNameAndInstitution(colegioId, gName);
      if (!group) return res.status(400).json({ message: `El curso/grupo "${gName}" no existe. Créalo primero.` });
      try {
        await createGroupSubject({ institution_id: colegioId, group_id: group.id, subject_id: subject.id, teacher_id: professorId });
      } catch (_) {}
    }
    await logAdminAction({
      userId: req.user!.id!,
      role: req.user?.rol ?? 'admin-general-colegio',
      action: 'assign_professor_to_groups',
      entityType: 'course',
      entityId: subject.id,
      colegioId,
      requestData: { professorId, groupNames: normalizedGroups, materiaNombre },
    }).catch(() => {});
    return res.status(200).json({
      message: `Profesor asignado a los cursos ${normalizedGroups.join(', ')} para la materia ${materiaNombre}.`,
      course: { _id: subject.id, nombre: subject.name, cursos: normalizedGroups },
    });
  } catch (error: unknown) {
    console.error('Error en assign-professor-to-groups:', error);
    res.status(500).json({ message: 'Error al asignar profesor a los cursos.' });
  }
});

// PUT /api/courses/assign-professor
router.put('/assign-professor', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
  try {
    const { courseId, professorId } = req.body;
    if (!courseId || !professorId) return res.status(400).json({ message: 'Se requiere el ID del curso y el ID del profesor.' });
    const gs = await findGroupSubjectById(courseId);
    if (!gs) return res.status(404).json({ message: 'Curso no encontrado.' });
    const professor = await findUserById(professorId);
    if (!professor || professor.role !== 'profesor') return res.status(404).json({ message: 'Profesor no encontrado o rol incorrecto.' });
    const { queryPg } = await import('../config/db-pg.js');
    await queryPg('UPDATE group_subjects SET teacher_id = $1 WHERE id = $2 RETURNING 1', [professorId, courseId]);
    const subject = await findSubjectById(gs.subject_id);
    await logAdminAction({
      userId: req.user!.id!,
      role: req.user?.rol ?? 'admin-general-colegio',
      action: 'assign_professor',
      entityType: 'course',
      entityId: courseId,
      colegioId: gs.institution_id,
      requestData: { courseId, professorId, courseName: subject?.name },
    }).catch(() => {});
    res.status(200).json({ message: `Profesor asignado correctamente al curso ${subject?.name}.`, course: { _id: gs.id }, professor: { _id: professor.id, nombre: professor.full_name } });
  } catch (error: unknown) {
    console.error('Error al asignar profesor:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/courses/enroll-students - En PG la inscripción es por grupo (enrollments), no por "curso" Mongo
router.put('/enroll-students', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
  try {
    const { courseId, studentIds } = req.body;
    if (!courseId || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Se requiere el ID del curso y una lista de IDs de estudiantes.' });
    }
    const gs = await findGroupSubjectById(courseId);
    if (!gs) return res.status(404).json({ message: 'Curso no encontrado.' });
    const { createEnrollment } = await import('../repositories/enrollmentRepository.js');
    const { findActiveAcademicPeriodForInstitution } = await import('../repositories/academicPeriodRepository.js');
    const period = await findActiveAcademicPeriodForInstitution(gs.institution_id);
    const group = await findGroupById(gs.group_id);
    for (const sid of studentIds) {
      try {
        await createEnrollment({ student_id: sid, group_id: gs.group_id, academic_period_id: period?.id ?? null });
      } catch (_) {}
    }
    await logAdminAction({
      userId: req.user!.id!,
      role: req.user?.rol ?? 'admin-general-colegio',
      action: 'enroll_students',
      entityType: 'course',
      entityId: courseId,
      colegioId: gs.institution_id,
      requestData: { courseId, studentIds },
    }).catch(() => {});
    res.status(200).json({
      message: `Estudiantes inscritos en el curso ${group?.name ?? courseId}.`,
      course: { _id: courseId },
      studentIds,
    });
  } catch (error: unknown) {
    console.error('Error al inscribir estudiantes:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/courses/:id
router.put('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado' });
    const subject = await findSubjectById(id);
    if (!subject || subject.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const { nombre, descripcion } = req.body;
    const updated = await updateSubject(id, colegioId, { name: nombre ?? subject.name, description: descripcion ?? subject.description });
    res.json(updated ?? subject);
  } catch (error: unknown) {
    console.error('Error al actualizar curso:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/courses/assign - stub
router.post('/assign', protect, checkIsDirectivoOrAdminColegio, async (req: AuthRequest, res) => {
  res.status(200).json({ message: 'Usa POST /assign-professor-to-groups o PUT /assign-professor.' });
});

// DELETE /api/courses/:id - No borramos subject si hay group_subjects; solo para compatibilidad
router.delete('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado' });
    const subject = await findSubjectById(id);
    if (!subject || subject.institution_id !== colegioId) return res.status(404).json({ message: 'Curso no encontrado.' });
    const { queryPg } = await import('../config/db-pg.js');
    await queryPg('DELETE FROM group_subjects WHERE subject_id = $1 AND institution_id = $2', [id, colegioId]);
    res.json({ message: 'Curso eliminado.', _id: id });
  } catch (error: unknown) {
    console.error('Error al eliminar curso:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
