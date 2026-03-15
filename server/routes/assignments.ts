import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
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
import { findGradeByAssignmentAndUser, findGradesByAssignment, upsertGrade } from '../repositories/gradeRepository.js';
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
}, extra: { submissions?: unknown[]; estado?: string; materiaNombre?: string; curso?: string; groupId?: string; subjectId?: string; logroCalificacionId?: string } = {}) {
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
    createdAt: a.created_at,
    ...extra,
  };
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
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    let assignments: AssignmentRow[] = [];
    const groupSubjectIds: string[] = [];

    if (courseId && typeof courseId === 'string') {
      groupSubjectIds.push(courseId);
    } else if (user.role === 'profesor') {
      if (groupId && typeof groupId === 'string') {
        const resolved = await resolveGroupId(groupId.trim(), user.institution_id ?? '');
        if (resolved) {
          const gsList = await findGroupSubjectsByGroupWithDetails(resolved.id, user.institution_id ?? undefined);
          const byTeacher = gsList.filter((gs) => gs.teacher_id === userId);
          groupSubjectIds.push(...byTeacher.map((gs) => gs.id));
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
        ? await findAssignmentsByGroupSubjectAndDue(gsId, fromDate, toDate)
        : await findAssignmentsByGroupSubject(gsId);
      if (user.role === 'profesor') {
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
        const extra: { estado: string; submissions?: { estudianteId: string; calificacion?: number; fechaEntrega?: string }[]; curso?: string; materiaNombre?: string; groupId?: string; subjectId?: string; logroCalificacionId?: string } = {
          estado: state,
          curso: group?.name,
          materiaNombre: subject?.name ?? undefined,
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
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { titulo, descripcion, contenidoDocumento, courseId, fechaEntrega, type, isGradable, categoryId, grading_category_id, logroCalificacionId } = req.body;
    const userId = getUserId(req);
    if (!titulo || !descripcion || !courseId || !fechaEntrega) {
      return res.status(400).json({ message: 'Faltan campos obligatorios (titulo, descripcion, courseId, fechaEntrega).' });
    }

    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    if (user.role !== 'profesor') return res.status(403).json({ message: 'Solo los profesores pueden crear tareas.' });

    const gs = await findGroupSubjectById(courseId);
    if (!gs || gs.teacher_id !== userId) return res.status(403).json({ message: 'No tienes permiso para crear tareas en este curso.' });

    let assignmentCategoryId: string | null = categoryId ?? grading_category_id ?? logroCalificacionId ?? null;
    if (!assignmentCategoryId) {
      assignmentCategoryId = await getDefaultGradingCategoryIdForGroup(gs.group_id, gs.institution_id);
    }

    const created = await createAssignment({
      group_subject_id: courseId,
      title: titulo,
      description: descripcion,
      content_document: contenidoDocumento ?? null,
      due_date: new Date(fechaEntrega).toISOString(),
      created_by: userId,
      type: type ?? 'assignment',
      is_gradable: isGradable !== false,
      assignment_category_id: assignmentCategoryId,
    });

    await createAnnouncement({
      institution_id: gs.institution_id,
      title: `Nueva tarea: ${titulo}`,
      body: (descripcion ?? '').slice(0, 500) || null,
      type: 'nueva_asignacion',
      group_id: gs.group_id,
      group_subject_id: courseId,
      assignment_id: created.id,
      created_by_id: userId,
    }).catch((err) => console.error('Error al crear notificación académica:', (err as Error).message));

    return res.status(201).json(assignmentToApi(created));
  } catch (err: unknown) {
    console.error('Error al crear tarea:', (err as Error).message);
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
        return assignmentToApi(a, { estado: state, materiaNombre: subject?.name ?? 'Sin materia', curso: cursoNombre, groupId: gs?.group_id, subjectId: gs?.subject_id });
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
        return assignmentToApi(a, { estado: state, materiaNombre: subject?.name ?? 'Sin materia', curso: group.name, groupId: gs?.group_id, subjectId: gs?.subject_id });
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
      created_at: string;
      group_name: string;
      subject_name: string;
    }>(
      `SELECT DISTINCT ON (a.id) a.id, a.group_subject_id, a.title, a.description, a.content_document, a.due_date, a.max_score, a.created_by, a.type, a.is_gradable, a.created_at, g.name AS group_name, s.name AS subject_name
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

    const { titulo, descripcion, contenidoDocumento, fechaEntrega, type, isGradable } = req.body;
    const updated = await updateAssignment(req.params.id, {
      ...(titulo && { title: titulo }),
      ...(descripcion !== undefined && { description: descripcion }),
      ...(contenidoDocumento !== undefined && { content_document: contenidoDocumento }),
      ...(fechaEntrega && { due_date: new Date(fechaEntrega).toISOString() }),
      ...(type && { type }),
      ...(typeof isGradable === 'boolean' && { is_gradable: isGradable }),
    });

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
router.put('/:id/grade', protect, async (req: AuthRequest, res) => {
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

    const score = clearGrade ? 0 : Number(calificacion);
    const maxScore = assignment.max_score;

    await upsertGrade({
      assignment_id: assignment.id,
      user_id: estudianteId,
      group_id: gs.group_id,
      grading_category_id: gradingCategoryId,
      score,
      max_score: maxScore,
      recorded_by_id: userId,
    });

    const sub = await findSubmissionByAssignmentAndStudent(assignment.id, estudianteId);
    if (sub) {
      await updateSubmission(sub.id, {
        score: clearGrade ? null : score,
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
    const materiaNombre = subject?.name ?? undefined;
    const groupId = gsForInst.group_id;

    const subs = await findSubmissionsByAssignment(assignment.id);
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
