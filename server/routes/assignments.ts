import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { auditAction } from '../middleware/auditMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupByNameAndInstitution, findGroupById } from '../repositories/groupRepository.js';
import { findGroupSubjectById, findGroupSubjectsByTeacher, findGroupSubjectsByGroup, findGroupSubjectsByGroupWithDetails } from '../repositories/groupSubjectRepository.js';
import { resolveGroupId } from '../utils/resolveLegacyCourse.js';
import {
  type AssignmentRow,
  findAssignmentById,
  findAssignmentsByGroupSubject,
  findAssignmentsByGroupSubjectAndDue,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '../repositories/assignmentRepository.js';
import {
  findSubmissionByAssignmentAndStudent,
  findSubmissionsByAssignment,
  createSubmission,
  updateSubmission,
} from '../repositories/submissionRepository.js';
import {
  findGradeByAssignmentAndUser,
  findGradesByAssignment,
  upsertGrade,
  deleteGradeByAssignmentAndUser,
} from '../repositories/gradeRepository.js';
import { findGradingSchemaByGroup } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
import { findEnrollmentsByStudent, getFirstGroupNameForStudent, getFirstGroupForStudent, getAllCourseGroupsForStudent } from '../repositories/enrollmentRepository.js';
import { findGuardianStudent } from '../repositories/guardianStudentRepository.js';
import { findSubjectById } from '../repositories/subjectRepository.js';
import { createAnnouncement } from '../repositories/announcementRepository.js';
import { queryPg } from '../config/db-pg.js';

const router = express.Router();

function getUserId(req: AuthRequest): string {
  return (req.user?.id ?? req.userId ?? '') as string;
}

async function getDefaultGradingCategoryIdForGroup(groupId: string, institutionId?: string): Promise<string | null> {
  const schema = await findGradingSchemaByGroup(groupId, institutionId);
  if (!schema) return null;
  const categories = await findGradingCategoriesBySchema(schema.id);
  return categories[0]?.id ?? null;
}

function assignmentToApi(a: {
  id: string;
  group_subject_id: string;
  title: string;
  description: string | null;
  content_document: string | null;
  due_date: string;
  max_score: number;
  created_by: string;
  type: string;
  is_gradable: boolean;
  created_at: string;
  requires_submission?: boolean;
}, extra: { submissions?: unknown[]; estado?: string; materiaNombre?: string; curso?: string; groupId?: string; subjectId?: string; logroCalificacionId?: string; categoryWeightPct?: number | null } = {}) {
  const requiresSubmission =
    a.type === 'reminder' ? false : a.requires_submission === false ? false : true;
  const term = (a as { academic_term?: number }).academic_term;
  const trimestre = term === 1 || term === 2 || term === 3 ? term : 1;
  return {
    _id: a.id,
    titulo: a.title,
    descripcion: a.description,
    contenidoDocumento: a.content_document,
    courseId: a.group_subject_id,
    fechaEntrega: a.due_date,
    profesorId: a.created_by,
    maxScore: a.max_score,
    type: a.type,
    isGradable: a.is_gradable,
    requiresSubmission,
    createdAt: a.created_at,
    ...extra,
    categoryWeightPct:
      (a as { category_weight_pct?: number | null }).category_weight_pct ?? extra.categoryWeightPct,
    trimestre,
  };
}

function parseTrimestreQuery(query: Record<string, unknown>): number | undefined {
  const raw = query.trimestre ?? query.t;
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return undefined;
}

function submissionState(submission: { score: number | null; submitted_at: string | null } | null): 'pendiente' | 'entregada' | 'calificada' {
  if (!submission) return 'pendiente';
  if (submission.score != null) return 'calificada';
  if (submission.submitted_at) return 'entregada';
  return 'pendiente';
}

// GET /api/assignments - Listar tareas (courseId = group_subject_id, month, year, estado)
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const { courseId, groupId, month, year, estado } = req.query;
    const trimestreFilter = parseTrimestreQuery(req.query as Record<string, unknown>);
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    let assignments: AssignmentRow[] = [];
    const groupSubjectIds: string[] = [];
    /** Profesor con ?groupId= (sin courseId): vista calendario del curso completo — todas las materías y tareas del grupo. */
    let professorGroupWideCalendar = false;

    if (courseId && typeof courseId === 'string') {
      if (user.role === 'estudiante') {
        const gsCheck = await findGroupSubjectById(courseId);
        if (!gsCheck || gsCheck.institution_id !== user.institution_id) {
          return res.status(403).json({ message: 'No tienes acceso a las tareas de este curso.' });
        }
        const studentGroups = await getAllCourseGroupsForStudent(userId, user.institution_id);
        const enrolledGroupIds = new Set(studentGroups.map((g) => g.id));
        if (!enrolledGroupIds.has(gsCheck.group_id)) {
          return res.status(403).json({ message: 'No tienes acceso a las tareas de este curso.' });
        }
      }
      groupSubjectIds.push(courseId);
    } else if (user.role === 'profesor') {
      if (groupId && typeof groupId === 'string') {
        const resolved = await resolveGroupId(groupId.trim(), user.institution_id ?? '');
        if (resolved) {
          const gsList = await findGroupSubjectsByGroupWithDetails(resolved.id, user.institution_id ?? undefined);
          const teachesInGroup = gsList.some((gs) => gs.teacher_id === userId);
          if (!teachesInGroup) {
            return res.status(403).json({ message: 'No dictas ninguna materia en este grupo.' });
          }
          professorGroupWideCalendar = true;
          groupSubjectIds.push(...gsList.map((gs) => gs.id));
        }
      } else {
        const gsList = await findGroupSubjectsByTeacher(userId);
        groupSubjectIds.push(...gsList.map((gs) => gs.id));
      }
    } else if (user.role === 'estudiante') {
      let curso = (user.config as { curso?: string })?.curso;
      if (!curso) curso = await getFirstGroupNameForStudent(userId) ?? undefined;
      let group = curso ? await findGroupByNameAndInstitution(user.institution_id, curso.toUpperCase().trim()) : null;
      if (!group) group = await getFirstGroupForStudent(userId, user.institution_id);
      if (!group) return res.json([]);
      const gsList = await findGroupSubjectsByGroup(group.id);
      groupSubjectIds.push(...gsList.map((gs) => gs.id));
    } else {
      return res.json([]);
    }

    if (groupSubjectIds.length === 0) return res.json([]);

    const fromDate = month && year ? `${year}-${String(month).padStart(2, '0')}-01` : undefined;
    const toDate = month && year ? `${year}-${String(month).padStart(2, '0')}-31` : undefined;

    for (const gsId of groupSubjectIds) {
      const list = fromDate || toDate
        ? await findAssignmentsByGroupSubjectAndDue(gsId, fromDate, toDate, trimestreFilter)
        : await findAssignmentsByGroupSubject(gsId, trimestreFilter);
      if (user.role === 'profesor' && !professorGroupWideCalendar) {
        assignments = assignments.concat(list.filter((a) => a.created_by === userId));
      } else {
        assignments = assignments.concat(list);
      }
    }

    if (estado && (estado === 'pendiente' || estado === 'entregada' || estado === 'calificada')) {
      const filtered = await Promise.all(
        assignments.map(async (a) => {
          const sub = user.role === 'estudiante' ? await findSubmissionByAssignmentAndStudent(a.id, userId) : null;
          const state = submissionState(sub);
          return state === estado ? a : null;
        })
      );
      assignments = filtered.filter((a): a is NonNullable<typeof a> => a != null);
    }

    const withState = await Promise.all(
      assignments.map(async (a) => {
        const sub = user.role === 'estudiante' ? await findSubmissionByAssignmentAndStudent(a.id, userId) : null;
        const state = submissionState(sub);
        const gs = await findGroupSubjectById(a.group_subject_id);
        const group = gs ? await findGroupById(gs.group_id) : null;
        const subject = gs ? await findSubjectById(gs.subject_id) : null;
        const displayName = (gs?.display_name?.trim() || subject?.name) ?? undefined;
        const extra: { estado: string; submissions?: { estudianteId: string; calificacion?: number; fechaEntrega?: string }[]; curso?: string; materiaNombre?: string; groupId?: string; subjectId?: string; logroCalificacionId?: string } = {
          estado: state,
          curso: group?.name,
          materiaNombre: displayName,
          groupId: gs?.group_id,
          subjectId: gs?.subject_id,
          logroCalificacionId: a.assignment_category_id ?? undefined,
        };
        if (user.role === 'profesor') {
          const grades = await findGradesByAssignment(a.id);
          extra.submissions = grades.map((g) => ({
            estudianteId: g.user_id,
            calificacion: g.score,
          }));
        }
        return assignmentToApi(a, extra);
      })
    );

    return res.json(withState);
  } catch (err: unknown) {
    console.error('Error al obtener tareas:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/assignments - Crear tarea (courseId = group_subject_id obligatorio)
router.post('/', protect, requirePermission('assignments', 'create'), async (req: AuthRequest, res) => {
  try {
    const { titulo, descripcion, contenidoDocumento, courseId, fechaEntrega, type, isGradable, categoryId, grading_category_id, logroCalificacionId, requiresSubmission: bodyRequiresSubmission, trimestre: bodyTrimestre } = req.body as Record<string, unknown>;
    const userId = getUserId(req);
    const tituloStr = String(titulo || '').trim();
    const descripcionStr = (String(descripcion || '').trim() || tituloStr).trim();
    const courseIdStr = String(courseId || '').trim();
    const fechaStr = fechaEntrega != null ? String(fechaEntrega) : '';
    if (!tituloStr || !descripcionStr || !courseIdStr || !fechaStr) {
      return res.status(400).json({ message: 'Faltan campos obligatorios (titulo, descripcion, courseId, fechaEntrega).' });
    }

    const due = new Date(fechaStr);
    if (Number.isNaN(due.getTime())) {
      return res.status(400).json({ message: 'Fecha de entrega no válida.' });
    }
    const dueIso = due.toISOString();

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    if (user.role !== 'profesor') return res.status(403).json({ message: 'Solo los profesores pueden crear tareas.' });

    const gs = await findGroupSubjectById(courseIdStr);
    if (!gs || gs.teacher_id !== userId) return res.status(403).json({ message: 'No tienes permiso para crear tareas en este curso.' });

    let assignmentCategoryId: string | null = categoryId ?? grading_category_id ?? logroCalificacionId ?? null;
    if (!assignmentCategoryId) {
      assignmentCategoryId = await getDefaultGradingCategoryIdForGroup(gs.group_id, gs.institution_id);
    }

    const requiresSubmission =
      typeof bodyRequiresSubmission === 'boolean' ? bodyRequiresSubmission : true;

    const cwRaw = (req.body as { categoryWeightPct?: unknown }).categoryWeightPct;
    let category_weight_pct: number | null = null;
    if (cwRaw != null && cwRaw !== '') {
      const w = Number(cwRaw);
      if (!Number.isNaN(w) && w > 0 && w <= 100) category_weight_pct = w;
    }

    let academic_term = 1;
    if (bodyTrimestre != null && bodyTrimestre !== '') {
      const tn = Number(bodyTrimestre);
      if (tn === 1 || tn === 2 || tn === 3) academic_term = tn;
    }

    const contentDoc =
      contenidoDocumento != null && typeof contenidoDocumento === 'string'
        ? contenidoDocumento
        : null;

    const buildRow = (cat: string | null) => ({
      group_subject_id: courseIdStr,
      title: tituloStr,
      description: descripcionStr,
      content_document: contentDoc,
      due_date: dueIso,
      created_by: userId,
      type: 'assignment' as const,
      is_gradable: requiresSubmission ? isGradable !== false : false,
      requires_submission: requiresSubmission,
      assignment_category_id: cat,
      max_score: requiresSubmission ? undefined : 0,
      category_weight_pct,
      academic_term,
    });

    let created;
    try {
      created = await createAssignment(buildRow(assignmentCategoryId));
    } catch (first: unknown) {
      const err = first as { code?: string; detail?: string; message?: string };
      // FK antigua (assignment_categories) o logro inexistente → reintentar sin categoría
      if (err.code === '23503' && assignmentCategoryId) {
        console.warn('[assignments] FK al crear con logro, reintentando sin categoría:', err.detail || err.message);
        try {
          created = await createAssignment(buildRow(null));
        } catch (second) {
          throw first;
        }
      } else {
        throw first;
      }
    }

    await createAnnouncement({
      institution_id: gs.institution_id,
      title: `Nueva tarea: ${tituloStr}`,
      body: descripcionStr.slice(0, 500) || null,
      type: 'nueva_asignacion',
      group_id: gs.group_id,
      group_subject_id: courseIdStr,
      assignment_id: created.id,
      created_by_id: userId,
    }).catch((err) => console.error('Error al crear notificación académica:', (err as Error).message));

    return res.status(201).json(assignmentToApi(created));
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string; detail?: string };
    console.error('Error al crear tarea:', e.message, e.code || '', e.detail || '');
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/student - Tareas del estudiante autenticado
router.get('/student', protect, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    if (user.role !== 'estudiante') return res.status(403).json({ message: 'Solo los estudiantes pueden acceder.' });

    const courseGroups = await getAllCourseGroupsForStudent(userId, user.institution_id);
    if (!courseGroups.length) return res.json([]);

    const gsList = (await Promise.all(
      courseGroups.map((g) => findGroupSubjectsByGroup(g.id))
    )).flat();

    const list: AssignmentRow[] = [];
    for (const gs of gsList) {
      const as = await findAssignmentsByGroupSubject(gs.id);
      list.push(...as);
    }

    const groupIdToName = new Map(courseGroups.map((g) => [g.id, g.name]));

    const withState = await Promise.all(
      list.map(async (a) => {
        const sub = await findSubmissionByAssignmentAndStudent(a.id, userId);
        const state = submissionState(sub);
        const gs = await findGroupSubjectById(a.group_subject_id);
        const subject = await findSubjectById(gs?.subject_id ?? '');
        const cursoNombre = groupIdToName.get(gs?.group_id ?? '') ?? 'Sin grupo';
        const materiaNombre = (gs?.display_name?.trim() || subject?.name) ?? 'Sin materia';
        return assignmentToApi(a, { estado: state, materiaNombre, curso: cursoNombre, groupId: gs?.group_id, subjectId: gs?.subject_id });
      })
    );

    return res.json(withState);
  } catch (err: unknown) {
    console.error('Error al obtener tareas del estudiante:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/hijo/:estudianteId - Tareas de un hijo (padre/directivo)
router.get('/hijo/:estudianteId', protect, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const estudianteId = req.params.estudianteId;
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    const allowed = user.role === 'directivo' || user.role === 'admin-general-colegio';
    if (!allowed && user.role === 'padre') {
      const link = await findGuardianStudent(userId, estudianteId);
      if (!link) return res.status(403).json({ message: 'No autorizado a ver las tareas de este estudiante.' });
    } else if (!allowed) {
      return res.status(403).json({ message: 'Solo padre, directivo o administrador pueden acceder.' });
    }

    const estudiante = await findUserById(estudianteId);
    if (!estudiante || estudiante.role !== 'estudiante') return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (estudiante.institution_id !== user.institution_id) return res.status(403).json({ message: 'No autorizado.' });

    let curso = (estudiante.config as { curso?: string })?.curso;
    if (!curso) curso = await getFirstGroupNameForStudent(estudianteId) ?? undefined;
    let group = curso ? await findGroupByNameAndInstitution(estudiante.institution_id, curso.toUpperCase().trim()) : null;
    if (!group) group = await getFirstGroupForStudent(estudianteId, estudiante.institution_id);
    if (!group) return res.json([]);

    const gsList = await findGroupSubjectsByGroup(group.id);
    const list: AssignmentRow[] = [];
    for (const gs of gsList) {
      const as = await findAssignmentsByGroupSubject(gs.id);
      list.push(...as);
    }

    const withState = await Promise.all(
      list.map(async (a) => {
        const sub = await findSubmissionByAssignmentAndStudent(a.id, estudianteId);
        const state = submissionState(sub);
        const gs = await findGroupSubjectById(a.group_subject_id);
        const subject = await findSubjectById(gs?.subject_id ?? '');
        const materiaNombre = (gs?.display_name?.trim() || subject?.name) ?? 'Sin materia';
        return assignmentToApi(a, { estado: state, materiaNombre, curso: group.name, groupId: gs?.group_id, subjectId: gs?.subject_id });
      })
    );

    return res.json(withState);
  } catch (err: unknown) {
    console.error('Error al obtener tareas del hijo:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/curso/:curso/:mes/:año - Stub (retorna [])
router.get('/curso/:curso/:mes/:año', protect, async (_req, res) => {
  try {
    return res.json([]);
  } catch {
    return res.status(500).json({ message: 'Error interno.' });
  }
});

// GET /api/assignments/profesor/:profesorId/pending-review - Tareas con al menos una entrega sin calificar
router.get('/profesor/:profesorId/pending-review', protect, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const { profesorId } = req.params;
    if (userId !== profesorId) return res.status(403).json({ message: 'Solo puedes ver tus propias tareas por revisar.' });

    const r = await queryPg<{
      id: string;
      group_subject_id: string;
      title: string;
      description: string | null;
      content_document: string | null;
      due_date: string;
      max_score: number;
      created_by: string;
      type: string;
      is_gradable: boolean;
      requires_submission: boolean;
      created_at: string;
      group_name: string;
      subject_name: string;
    }>(
      `SELECT DISTINCT ON (a.id) a.id, a.group_subject_id, a.title, a.description, a.content_document, a.due_date, a.max_score, a.created_by, a.type, a.is_gradable, a.requires_submission, a.created_at, g.name AS group_name, COALESCE(gs.display_name, s.name) AS subject_name
       FROM assignments a
       JOIN group_subjects gs ON gs.id = a.group_subject_id
       JOIN groups g ON g.id = gs.group_id
       JOIN subjects s ON s.id = gs.subject_id
       JOIN submissions sub ON sub.assignment_id = a.id AND sub.submitted_at IS NOT NULL AND sub.score IS NULL
       WHERE a.created_by = $1
       ORDER BY a.id`,
      [profesorId]
    );

    type PendingRow = {
      id: string;
      group_subject_id: string;
      title: string;
      description: string | null;
      content_document: string | null;
      due_date: string;
      max_score: number;
      created_by: string;
      type: string;
      is_gradable: boolean;
      requires_submission: boolean;
      created_at: string;
      group_name: string;
      subject_name: string;
    };
    const list = r.rows.map((row: PendingRow) => {
      const a = {
        id: row.id,
        group_subject_id: row.group_subject_id,
        title: row.title,
        description: row.description,
        content_document: row.content_document,
        due_date: row.due_date,
        max_score: row.max_score,
        created_by: row.created_by,
        type: row.type,
        is_gradable: row.is_gradable,
        requires_submission: row.requires_submission,
        created_at: row.created_at,
      };
      return assignmentToApi(a, { curso: row.group_name, materiaNombre: row.subject_name });
    });
    return res.json(list);
  } catch (err: unknown) {
    console.error('Error en pending-review:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/profesor/:profesorId/mis-asignaciones — Todas las creadas por el profesor (recordatorios + asignaciones), recientes primero
router.get('/profesor/:profesorId/mis-asignaciones', protect, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const { profesorId } = req.params;
    if (userId !== profesorId) return res.status(403).json({ message: 'Solo puedes ver tus propias asignaciones.' });

    const cursoId = (req.query.cursoId as string | undefined) ?? undefined;

    const r = await queryPg<{
      id: string;
      group_subject_id: string;
      title: string;
      description: string | null;
      content_document: string | null;
      due_date: string;
      max_score: number;
      created_by: string;
      type: string;
      is_gradable: boolean;
      requires_submission: boolean;
      created_at: string;
      group_name: string;
      subject_name: string;
      pendientes_calificar: number;
    }>(
      `SELECT a.id, a.group_subject_id, a.title, a.description, a.content_document, a.due_date, a.max_score, a.created_by, a.type, a.is_gradable, a.requires_submission, a.created_at,
              g.name AS group_name, COALESCE(gs.display_name, s.name) AS subject_name,
              COALESCE((
                SELECT COUNT(*)::int FROM submissions sub
                WHERE sub.assignment_id = a.id AND sub.submitted_at IS NOT NULL AND sub.score IS NULL
              ), 0) AS pendientes_calificar
       FROM assignments a
       JOIN group_subjects gs ON gs.id = a.group_subject_id
       JOIN groups g ON g.id = gs.group_id
       JOIN subjects s ON s.id = gs.subject_id
       WHERE a.created_by = $1
       ${cursoId ? 'AND g.id = $2' : ''}
       ORDER BY a.created_at DESC
       LIMIT 400`,
      cursoId ? [profesorId, cursoId] : [profesorId]
    );

    type Row = {
      id: string;
      group_subject_id: string;
      title: string;
      description: string | null;
      content_document: string | null;
      due_date: string;
      max_score: number;
      created_by: string;
      type: string;
      is_gradable: boolean;
      requires_submission: boolean;
      created_at: string;
      group_name: string;
      subject_name: string;
      pendientes_calificar: number;
    };
    const list = r.rows.map((row: Row) => {
      const a = {
        id: row.id,
        group_subject_id: row.group_subject_id,
        title: row.title,
        description: row.description,
        content_document: row.content_document,
        due_date: row.due_date,
        max_score: row.max_score,
        created_by: row.created_by,
        type: row.type,
        is_gradable: row.is_gradable,
        requires_submission: row.requires_submission,
        created_at: row.created_at,
      };
      return assignmentToApi(a, {
        curso: row.group_name,
        materiaNombre: row.subject_name,
        pendientesCalificar: row.pendientes_calificar,
      });
    });
    return res.json(list);
  } catch (err: unknown) {
    console.error('Error en mis-asignaciones:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/profesor/:profesorId/:mes/:year - Stub
router.get('/profesor/:profesorId/:mes/:year', protect, async (_req, res) => {
  return res.json([]);
});

// PUT /api/assignments/:id - Editar tarea
router.put('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const assignment = await findAssignmentById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Tarea no encontrada.' });
    if (assignment.created_by !== userId) return res.status(403).json({ message: 'No tienes permiso para editar esta tarea.' });

    const { titulo, descripcion, contenidoDocumento, fechaEntrega, type, isGradable, categoryWeightPct, trimestre: putTrimestre } = req.body as Record<string, unknown>;
    let category_weight_pct: number | null | undefined = undefined;
    if (categoryWeightPct !== undefined) {
      if (categoryWeightPct === null || categoryWeightPct === '') category_weight_pct = null;
      else {
        const w = Number(categoryWeightPct);
        if (!Number.isNaN(w) && w > 0 && w <= 100) category_weight_pct = w;
      }
    }
    let academic_term: number | undefined;
    if (putTrimestre !== undefined) {
      const tn = Number(putTrimestre);
      if (tn === 1 || tn === 2 || tn === 3) academic_term = tn;
    }

    const patch: Parameters<typeof updateAssignment>[1] = {};
    if (titulo != null && String(titulo).trim()) patch.title = String(titulo).trim();
    if (descripcion !== undefined) patch.description = descripcion as string | null;
    if (contenidoDocumento !== undefined) {
      patch.content_document =
        contenidoDocumento != null && typeof contenidoDocumento === 'string' ? contenidoDocumento : null;
    }
    if (fechaEntrega != null && String(fechaEntrega).trim()) {
      patch.due_date = new Date(String(fechaEntrega)).toISOString();
    }
    if (type != null && String(type).trim()) patch.type = String(type);
    if (typeof isGradable === 'boolean') patch.is_gradable = isGradable;
    if (category_weight_pct !== undefined) patch.category_weight_pct = category_weight_pct;
    if (academic_term !== undefined) patch.academic_term = academic_term;

    const updated = await updateAssignment(req.params.id, patch);

    return res.json(assignmentToApi(updated ?? assignment));
  } catch (err: unknown) {
    console.error('Error al editar tarea:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// POST /api/assignments/:id/submit - Enviar entrega
router.post('/:id/submit', protect, async (req: AuthRequest, res) => {
  try {
    const userId = getUserId(req);
    const user = await findUserById(userId);
    if (!user || user.role !== 'estudiante') return res.status(403).json({ message: 'Solo los estudiantes pueden enviar entregas.' });

    const assignment = await findAssignmentById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Tarea no encontrada.' });
    if (assignment.type === 'reminder' || !assignment.requires_submission) {
      return res.status(400).json({ message: 'Esta actividad no requiere entrega.' });
    }

    const gs = await findGroupSubjectById(assignment.group_subject_id);
    if (!gs) return res.status(404).json({ message: 'Curso no encontrado.' });

    // Comprobar inscripción real del estudiante en el grupo de la tarea (no solo config.curso)
    const enrollments = await findEnrollmentsByStudent(userId);
    const isInGroup = enrollments.some((e) => e.group_id === gs.group_id);
    if (!isInGroup) {
      return res.status(403).json({ message: 'No perteneces al curso de esta tarea.' });
    }

    const comentario = (req.body as { comentario?: string }).comentario;
    const archivos = (req.body as { archivos?: unknown[] }).archivos;
    const existing = await findSubmissionByAssignmentAndStudent(assignment.id, userId);
    const now = new Date().toISOString();
    if (existing) {
      await updateSubmission(existing.id, {
        status: 'submitted',
        submitted_at: now,
        comment: comentario != null ? String(comentario) : undefined,
        attachments: Array.isArray(archivos) ? archivos : undefined,
      });
    } else {
      await createSubmission({
        assignment_id: assignment.id,
        student_id: userId,
        status: 'submitted',
        submitted_at: now,
        comment: comentario != null ? String(comentario) : null,
        attachments: Array.isArray(archivos) ? archivos : [],
      });
    }

    const updatedAssignment = await findAssignmentById(req.params.id);
    return res.json({ message: 'Entrega enviada exitosamente.', assignment: updatedAssignment ? assignmentToApi(updatedAssignment) : null });
  } catch (err: unknown) {
    console.error('Error al enviar entrega:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// PUT /api/assignments/:id/grade - Calificar
router.put(
  '/:id/grade',
  protect,
  requirePermission('grades', 'update'),
  auditAction('grade_assignment', 'assignment'),
  async (req: AuthRequest, res) => {
  try {
    const { estudianteId, calificacion, retroalimentacion } = req.body;
    const userId = getUserId(req);
    if (!estudianteId) return res.status(400).json({ message: 'Falta estudianteId.' });

    const user = await findUserById(userId);
    if (!user || user.role !== 'profesor') return res.status(403).json({ message: 'Solo los profesores pueden calificar.' });

    const assignment = await findAssignmentById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Tarea no encontrada.' });
    if (assignment.created_by !== userId) return res.status(403).json({ message: 'Solo el profesor que creó la tarea puede calificarla.' });

    const clearGrade = calificacion == null || calificacion === '';
    if (!clearGrade && (Number(calificacion) < 0 || Number(calificacion) > 100)) {
      return res.status(400).json({ message: 'La calificación debe estar entre 0 y 100.' });
    }

    const gs = await findGroupSubjectById(assignment.group_subject_id);
    if (!gs) return res.status(500).json({ message: 'Curso no encontrado.' });
    let gradingCategoryId = assignment.assignment_category_id;
    if (!gradingCategoryId) {
      gradingCategoryId = await getDefaultGradingCategoryIdForGroup(gs.group_id, gs.institution_id);
    }
    if (!gradingCategoryId) {
      return res.status(400).json({ message: 'No hay esquema de calificación para este grupo. Configure categorías primero.' });
    }

    const maxScore = assignment.max_score;
    const numericScore = Number(calificacion);

    if (clearGrade) {
      await deleteGradeByAssignmentAndUser(assignment.id, estudianteId);
    } else {
      await upsertGrade({
        assignment_id: assignment.id,
        user_id: estudianteId,
        group_id: gs.group_id,
        grading_category_id: gradingCategoryId,
        score: numericScore,
        max_score: maxScore,
        recorded_by_id: userId,
      });
    }

    const sub = await findSubmissionByAssignmentAndStudent(assignment.id, estudianteId);
    if (sub) {
      await updateSubmission(sub.id, {
        score: clearGrade ? null : numericScore,
        feedback: retroalimentacion ?? sub.feedback,
      });
    }

    return res.json({ message: 'Calificación guardada.' });
  } catch (err: unknown) {
    console.error('Error al calificar:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// GET /api/assignments/:id - Una tarea
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const assignment = await findAssignmentById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Tarea no encontrada.' });

    const userId = getUserId(req);
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const gsForInst = await findGroupSubjectById(assignment.group_subject_id);
    if (!gsForInst || gsForInst.institution_id !== user.institution_id) {
      return res.status(403).json({ message: 'No tienes acceso a esta tarea.' });
    }
    if (user.role === 'profesor' && assignment.created_by !== userId) {
      return res.status(403).json({ message: 'No tienes acceso a esta tarea.' });
    }

    const group = await findGroupById(gsForInst.group_id);
    const subject = await findSubjectById(gsForInst.subject_id);
    const curso = group?.name ?? undefined;
    const materiaNombre = (gsForInst.display_name?.trim() || subject?.name) ?? undefined;
    const groupId = gsForInst.group_id;

    let subs = await findSubmissionsByAssignment(assignment.id);
    if (user.role === 'estudiante') {
      subs = subs.filter((s) => s.student_id === userId);
    }
    const submissions = subs.map((s) => {
      const attachments = s.attachments != null && Array.isArray(s.attachments) ? s.attachments : [];
      return {
        estudianteId: s.student_id,
        estudianteNombre: '',
        calificacion: s.score,
        retroalimentacion: s.feedback,
        fechaEntrega: s.submitted_at,
        comentario: s.comment ?? undefined,
        archivos: attachments as { tipo?: string; nombre?: string; url?: string }[],
      };
    });

    let estado: string | undefined;
    if (user.role === 'estudiante') {
      const sub = await findSubmissionByAssignmentAndStudent(assignment.id, userId);
      estado = submissionState(sub);
    }

    return res.json(assignmentToApi(assignment, { submissions, estado, curso, materiaNombre, groupId, subjectId: gsForInst?.subject_id, logroCalificacionId: assignment.assignment_category_id ?? undefined }));
  } catch (err: unknown) {
    console.error('Error al obtener tarea:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// DELETE /api/assignments/:id
router.delete('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const assignment = await findAssignmentById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Tarea no encontrada.' });
    const userId = getUserId(req);
    if (assignment.created_by !== userId) return res.status(403).json({ message: 'No tienes permiso para eliminar esta tarea.' });

    await deleteAssignment(req.params.id);
    return res.json({ message: 'Tarea eliminada exitosamente.' });
  } catch (err: unknown) {
    console.error('Error al eliminar tarea:', (err as Error).message);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
