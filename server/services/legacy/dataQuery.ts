import { Types } from 'mongoose';
import { User, Assignment, Course, Nota, Evento, Notificacion, Mensaje } from '../../models';
import { normalizeIdForQuery } from '../../utils/idGenerator';
import type { IAssignment, ISubmission } from '../../models/Assignment';
import { queryPg } from '../../config/db-pg.js';
import { getFirstGroupForStudent } from '../../repositories/enrollmentRepository.js';
import { findGroupSubjectsByGroupWithDetails, findGroupSubjectsByTeacherWithDetails } from '../../repositories/groupSubjectRepository.js';

/**
 * Servicio centralizado para consultar datos del sistema
 * TODAS las consultas respetan permisos por rol y filtran por colegioId
 */

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Consulta las notas de un estudiante (solo sus propias notas)
 */
export async function queryStudentNotes(
  estudianteId: string,
  colegioId: string,
  cursoId?: string
): Promise<any[]> {
  if (isUuid(estudianteId) && isUuid(colegioId)) {
    const group = await getFirstGroupForStudent(estudianteId, colegioId);
    const groupId = group?.id ?? null;
    // Notas vía grades (PG). Si cursoId viene como group_subject_id, filtramos por eso.
    const r = await queryPg<{
      id: string;
      score: number;
      recorded_at: string;
      assignment_id: string;
      assignment_title: string;
    }>(
      `SELECT g.id, g.score, g.recorded_at, a.id AS assignment_id, a.title AS assignment_title
       FROM grades g
       JOIN assignments a ON a.id = g.assignment_id
       JOIN group_subjects gs ON gs.id = a.group_subject_id
       WHERE g.user_id = $1
         AND ($2::uuid IS NULL OR gs.group_id = $2)
         AND ($3::uuid IS NULL OR a.group_subject_id = $3)
       ORDER BY g.recorded_at DESC
       LIMIT 200`,
      [estudianteId, groupId, cursoId && isUuid(cursoId) ? cursoId : null]
    );
    return r.rows.map((row: {
      id: string;
      score: number;
      recorded_at: string;
      assignment_id: string;
      assignment_title: string;
    }) => ({
      _id: row.id,
      tarea: { _id: row.assignment_id, titulo: row.assignment_title },
      nota: row.score,
      logro: null,
      fecha: row.recorded_at,
      profesor: null,
    }));
  }

  const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
  
  const query: any = {
    estudianteId: normalizedEstudianteId,
  };

  // Si se proporciona cursoId, filtrar tareas por curso
  if (cursoId) {
    const normalizedCursoId = normalizeIdForQuery(cursoId);
    const assignments = await Assignment.find({ 
      cursoId: normalizedCursoId,
      colegioId 
    }).select('_id').lean();
    
    const assignmentIds = assignments.map(a => a._id);
    query.tareaId = { $in: assignmentIds };
  }

  const notas = await Nota.find(query)
    .populate('tareaId', 'titulo fechaEntrega')
    .populate('profesorId', 'nombre')
    .sort({ fecha: -1 })
    .lean();

  return notas.map(nota => ({
    _id: nota._id,
    tarea: nota.tareaId,
    nota: nota.nota,
    logro: nota.logro,
    fecha: nota.fecha,
    profesor: nota.profesorId,
  }));
}

/**
 * Consulta las materias de un estudiante (según su curso)
 */
export async function queryStudentSubjects(
  estudianteId: string,
  colegioId: string
): Promise<any[]> {
  if (isUuid(estudianteId) && isUuid(colegioId)) {
    const group = await getFirstGroupForStudent(estudianteId, colegioId);
    if (!group) return [];
    const rows = await findGroupSubjectsByGroupWithDetails(group.id, colegioId);
    // Shape compatible con el frontend/chat (usa nombre/cursos/profesorIds).
    return rows.map((r) => ({
      _id: r.id, // group_subject_id como “courseId” en PG
      nombre: r.subject_name,
      descripcion: r.subject_description,
      cursos: [r.group_name],
      profesorIds: [{ _id: r.teacher_id, nombre: r.teacher_name, email: r.teacher_email }],
      icono: r.icon ?? null,
      colorAcento: null,
      materiaId: { _id: r.subject_id, nombre: r.subject_name },
    }));
  }

  const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
  
  const estudiante = await User.findById(normalizedEstudianteId).select('curso').lean();
  if (!estudiante || !estudiante.curso) {
    return [];
  }

  const cursoNormalizado = (estudiante.curso as string).toUpperCase().trim();
  
  const materias = await Course.find({
    colegioId,
    cursos: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase()] }
  })
    .populate('profesorIds', 'nombre email')
    .select('nombre descripcion colorAcento icono profesorIds')
    .lean();

  return materias;
}

/**
 * Consulta las tareas de un estudiante (solo sus tareas)
 */
export async function queryStudentAssignments(
  estudianteId: string,
  colegioId: string,
  estado?: 'pendiente' | 'entregada' | 'calificada'
): Promise<any[]> {
  if (isUuid(estudianteId) && isUuid(colegioId)) {
    const group = await getFirstGroupForStudent(estudianteId, colegioId);
    if (!group) return [];
    const r = await queryPg<{
      assignment_id: string;
      title: string;
      description: string | null;
      due_date: string;
      subject_name: string;
      group_name: string;
      teacher_name: string;
      submission_status: string | null;
      grade_id: string | null;
      score: number | null;
    }>(
      `SELECT a.id AS assignment_id,
              a.title,
              a.description,
              a.due_date,
              s.name AS subject_name,
              g.name AS group_name,
              t.full_name AS teacher_name,
              sub.status AS submission_status,
              gr.id AS grade_id,
              gr.score AS score
       FROM assignments a
       JOIN group_subjects gs ON gs.id = a.group_subject_id
       JOIN groups g ON g.id = gs.group_id
       JOIN subjects s ON s.id = gs.subject_id
       JOIN users t ON t.id = gs.teacher_id
       LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = $1
       LEFT JOIN grades gr ON gr.assignment_id = a.id AND gr.user_id = $1
       WHERE gs.institution_id = $2 AND gs.group_id = $3
       ORDER BY a.due_date ASC
       LIMIT 500`,
      [estudianteId, colegioId, group.id]
    );

    const mapped = r.rows.map((row: {
      assignment_id: string;
      title: string;
      description: string | null;
      due_date: string;
      subject_name: string;
      group_name: string;
      teacher_name: string;
      submission_status: string | null;
      grade_id: string | null;
      score: number | null;
    }) => {
      const computedEstado =
        row.grade_id ? 'calificada' : row.submission_status === 'submitted' ? 'entregada' : 'pendiente';
      return {
        _id: row.assignment_id,
        titulo: row.title,
        descripcion: row.description,
        fechaEntrega: row.due_date,
        curso: row.group_name,
        materia: row.subject_name,
        profesor: { nombre: row.teacher_name },
        estado: computedEstado,
      };
    });
    return estado ? mapped.filter((a: { estado: string }) => a.estado === estado) : mapped;
  }

  const normalizedEstudianteId = normalizeIdForQuery(estudianteId);
  
  const estudiante = await User.findById(normalizedEstudianteId).select('curso').lean();
  if (!estudiante || !estudiante.curso) {
    return [];
  }

  const cursoNormalizado = (estudiante.curso as string).toUpperCase().trim();
  
  const query: any = {
    colegioId,
    curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase(), estudiante.curso as string] }
  };

  const assignments = await Assignment.find(query)
    .populate('cursoId', 'nombre')
    .populate('materiaId', 'nombre')
    .populate('profesorId', 'nombre')
    .sort({ fechaEntrega: 1 })
    .lean();

  // Filtrar por estado si se proporciona
  if (estado) {
    return assignments.filter((assignment: any) => {
      const submission = assignment.submissions?.find(
        (s: ISubmission) => s.estudianteId?.toString() === normalizedEstudianteId
      );

      if (!submission) {
        return estado === 'pendiente';
      }

      if (submission.calificacion !== undefined && submission.calificacion !== null) {
        return estado === 'calificada';
      }

      return estado === 'entregada';
    });
  }

  // Agregar estado a cada tarea
  return assignments.map((assignment: any) => {
    const submission = assignment.submissions?.find(
      (s: ISubmission) => s.estudianteId?.toString() === normalizedEstudianteId
    );

    let estado = 'pendiente';
    if (submission) {
      if (submission.calificacion !== undefined && submission.calificacion !== null) {
        estado = 'calificada';
      } else {
        estado = 'entregada';
      }
    }

    return {
      ...assignment,
      estado,
    };
  });
}

/**
 * Consulta las notas de un curso completo (solo para profesores)
 */
export async function queryCourseNotes(
  profesorId: string,
  cursoId: string,
  colegioId: string
): Promise<any[]> {
  if (isUuid(profesorId) && isUuid(cursoId) && isUuid(colegioId)) {
    // cursoId = group_subject_id
    const access = await queryPg<{ ok: boolean }>(
      'SELECT true AS ok FROM group_subjects WHERE id = $1 AND teacher_id = $2 AND institution_id = $3',
      [cursoId, profesorId, colegioId]
    );
    if (!access.rows[0]?.ok) {
      throw new Error('No tienes acceso a este curso o el curso no existe');
    }

    const r = await queryPg<{
      grade_id: string;
      score: number;
      recorded_at: string;
      assignment_id: string;
      assignment_title: string;
      student_id: string;
      student_name: string;
    }>(
      `SELECT gr.id AS grade_id,
              gr.score,
              gr.recorded_at,
              a.id AS assignment_id,
              a.title AS assignment_title,
              u.id AS student_id,
              u.full_name AS student_name
       FROM grades gr
       JOIN assignments a ON a.id = gr.assignment_id
       JOIN users u ON u.id = gr.user_id
       WHERE a.group_subject_id = $1
       ORDER BY gr.recorded_at DESC
       LIMIT 1000`,
      [cursoId]
    );

    return r.rows.map((row: {
      grade_id: string;
      score: number;
      recorded_at: string;
      assignment_id: string;
      assignment_title: string;
      student_id: string;
      student_name: string;
    }) => ({
      _id: row.grade_id,
      tarea: { _id: row.assignment_id, titulo: row.assignment_title },
      estudiante: { _id: row.student_id, nombre: row.student_name },
      nota: row.score,
      logro: null,
      fecha: row.recorded_at,
    }));
  }

  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const normalizedCursoId = normalizeIdForQuery(cursoId);

  // Verificar que el profesor tenga acceso a este curso
  const curso = await Course.findOne({
    _id: normalizedCursoId,
    colegioId,
    profesorIds: normalizedProfesorId
  }).lean();

  if (!curso) {
    throw new Error('No tienes acceso a este curso o el curso no existe');
  }

  // Obtener todas las tareas del curso
  const assignments = await Assignment.find({
    cursoId: normalizedCursoId,
    colegioId
  }).select('_id titulo').lean();

  const assignmentIds = assignments.map(a => a._id);

  // Obtener todas las notas de estas tareas
  const notas = await Nota.find({
    tareaId: { $in: assignmentIds },
    profesorId: normalizedProfesorId
  })
    .populate('tareaId', 'titulo fechaEntrega')
    .populate('estudianteId', 'nombre')
    .sort({ fecha: -1 })
    .lean();

  return notas.map(nota => ({
    _id: nota._id,
    tarea: nota.tareaId,
    estudiante: nota.estudianteId,
    nota: nota.nota,
    logro: nota.logro,
    fecha: nota.fecha,
  }));
}

/**
 * Consulta información de un hijo (solo para padres)
 */
export async function queryChildInfo(
  parentId: string,
  hijoId: string,
  colegioId: string
): Promise<any> {
  if (isUuid(parentId) && isUuid(hijoId) && isUuid(colegioId)) {
    // En PG, la validación padre-hijo se hace con guardian_students.
    const link = await queryPg<{ ok: boolean }>(
      `SELECT true AS ok
       FROM guardian_students
       WHERE guardian_id = $1 AND student_id = $2
       LIMIT 1`,
      [parentId, hijoId]
    );
    if (!link.rows[0]?.ok) {
      throw new Error('No tienes acceso a la información de este estudiante');
    }

    const child = await queryPg<{ id: string; full_name: string }>(
      'SELECT id, full_name FROM users WHERE id = $1 LIMIT 1',
      [hijoId]
    );
    if (!child.rows[0]) {
      throw new Error('El usuario especificado no es un estudiante');
    }

    const group = await getFirstGroupForStudent(hijoId, colegioId);
    const curso = group?.name ?? null;

    const notas = await queryStudentNotes(hijoId, colegioId);
    const tareas = await queryStudentAssignments(hijoId, colegioId);
    const materias = await queryStudentSubjects(hijoId, colegioId);

    return {
      estudiante: {
        _id: child.rows[0].id,
        nombre: child.rows[0].full_name,
        curso,
      },
      notas,
      tareas,
      materias,
    };
  }

  const normalizedParentId = normalizeIdForQuery(parentId);
  const normalizedHijoId = normalizeIdForQuery(hijoId);

  // Verificar que el padre tenga este hijo
  const padre = await User.findById(normalizedParentId).select('hijoId').lean();
  if (!padre || padre.hijoId !== hijoId) {
    throw new Error('No tienes acceso a la información de este estudiante');
  }

  const hijo = await User.findById(normalizedHijoId).select('nombre curso').lean();
  if (!hijo || hijo.rol !== 'estudiante') {
    throw new Error('El usuario especificado no es un estudiante');
  }

  // Obtener notas del hijo
  const notas = await queryStudentNotes(normalizedHijoId, colegioId);
  
  // Obtener tareas del hijo
  const tareas = await queryStudentAssignments(normalizedHijoId, colegioId);
  
  // Obtener materias del hijo
  const materias = await queryStudentSubjects(normalizedHijoId, colegioId);

  return {
    estudiante: {
      _id: hijo._id,
      nombre: hijo.nombre,
      curso: hijo.curso,
    },
    notas,
    tareas,
    materias,
  };
}

/**
 * Resumen de notas de todos los cursos del profesor (solo sus materias y sus estudiantes).
 * Limitado por tamaño para no saturar el contexto del chat.
 */
const NOTAS_PROFESOR_LIMIT_PER_COURSE = 50;
const NOTAS_PROFESOR_MAX_COURSES = 20;

export async function queryProfessorNotesSummary(
  profesorId: string,
  colegioId: string
): Promise<{ materiaNombre: string; grupo: string; notas: { estudianteNombre: string; tareaTitulo: string; nota: number; fecha?: string }[] }[]> {
  if (isUuid(profesorId) && isUuid(colegioId)) {
    const groupSubjects = await findGroupSubjectsByTeacherWithDetails(profesorId, colegioId);
    // Agrupar por group_subject (más directo para grades/assignments) pero devolvemos por materia+grupo.
    const byKey = new Map<string, { materiaNombre: string; grupo: string; notas: { estudianteNombre: string; tareaTitulo: string; nota: number; fecha?: string }[] }>();

    const ids = groupSubjects.map((gs) => gs.id);
    if (ids.length === 0) return [];

    const r = await queryPg<{
      group_subject_id: string;
      subject_name: string;
      group_name: string;
      student_name: string;
      assignment_title: string;
      score: number;
      recorded_at: string;
    }>(
      `SELECT a.group_subject_id,
              COALESCE(gs.display_name, s.name) AS subject_name,
              g.name AS group_name,
              u.full_name AS student_name,
              a.title AS assignment_title,
              gr.score AS score,
              gr.recorded_at AS recorded_at
       FROM grades gr
       JOIN assignments a ON a.id = gr.assignment_id
       JOIN group_subjects gs ON gs.id = a.group_subject_id
       JOIN subjects s ON s.id = gs.subject_id
       JOIN groups g ON g.id = gs.group_id
       JOIN users u ON u.id = gr.user_id
       WHERE gs.teacher_id = $1 AND gs.institution_id = $2
       ORDER BY gr.recorded_at DESC
       LIMIT 1000`,
      [profesorId, colegioId]
    );

    for (const row of r.rows) {
      const key = `${row.subject_name}@@${row.group_name}`;
      const existing = byKey.get(key) ?? { materiaNombre: row.subject_name, grupo: row.group_name, notas: [] as { estudianteNombre: string; tareaTitulo: string; nota: number; fecha?: string }[] };
      existing.notas.push({
        estudianteNombre: row.student_name,
        tareaTitulo: row.assignment_title,
        nota: row.score,
        fecha: row.recorded_at ? new Date(row.recorded_at).toISOString().split('T')[0] : undefined,
      });
      byKey.set(key, existing);
    }

    return Array.from(byKey.values())
      .map((x) => ({ ...x, notas: x.notas.slice(0, 50) }))
      .slice(0, 20);
  }

  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const cursos = await Course.find({
    colegioId,
    profesorIds: normalizedProfesorId,
  })
    .select('_id nombre cursos')
    .limit(NOTAS_PROFESOR_MAX_COURSES)
    .lean();

  const result: { materiaNombre: string; grupo: string; notas: { estudianteNombre: string; tareaTitulo: string; nota: number; fecha?: string }[] }[] = [];

  for (const curso of cursos) {
    const courseId = (curso as any)._id.toString();
    const notas = await queryCourseNotes(profesorId, courseId, colegioId);
    const grupo = Array.isArray((curso as any).cursos) ? (curso as any).cursos[0] : '';
    const materiaNombre = (curso as any).nombre ?? 'Materia';

    const limited = notas.slice(0, NOTAS_PROFESOR_LIMIT_PER_COURSE).map((n: any) => ({
      estudianteNombre: n.estudiante?.nombre ?? 'Estudiante',
      tareaTitulo: n.tarea?.titulo ?? 'Tarea',
      nota: n.nota ?? 0,
      fecha: n.fecha ? new Date(n.fecha).toISOString().split('T')[0] : undefined,
    }));

    if (limited.length > 0) {
      result.push({ materiaNombre, grupo: grupo || courseId, notas: limited });
    }
  }

  return result;
}

/**
 * Busca cursos del profesor que incluyan el grupo (compatible con profesorId o profesorIds y varias formas de escribir el grupo).
 */
async function findCoursesByProfessorAndGroup(
  profesorId: string,
  groupName: string,
  colegioId: string
): Promise<{ _id: any }[]> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');
  const groupVariants = [groupNorm, groupNorm.toLowerCase(), groupName.trim(), groupName.trim().toUpperCase()].filter(Boolean);
  const escaped = groupNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const groupRegex = new RegExp(`^\\s*${escaped}\\s*$`, 'i');

  const profesorCondition = /^[0-9a-fA-F]{24}$/.test(normalizedProfesorId)
    ? {
        $or: [
          { profesorIds: normalizedProfesorId },
          { profesorId: normalizedProfesorId },
          { profesorIds: new Types.ObjectId(normalizedProfesorId) },
          { profesorId: new Types.ObjectId(normalizedProfesorId) },
        ],
      }
    : {
        $or: [
          { profesorIds: normalizedProfesorId },
          { profesorId: normalizedProfesorId },
        ],
      };

  const courses = await Course.find({
    colegioId,
    $and: [
      profesorCondition,
      {
        $or: [
          { cursos: { $in: groupVariants } },
          { cursos: groupRegex },
        ],
      },
    ],
  })
    .select('_id')
    .lean();

  return courses as { _id: any }[];
}

/**
 * Obtiene un courseId para el grupo del profesor (para enlaces a notas/tareas).
 */
export async function queryCourseIdByGroupForProfessor(
  profesorId: string,
  groupName: string,
  colegioId: string
): Promise<{ courseId: string; group: string } | null> {
  if (isUuid(profesorId) && isUuid(colegioId)) {
    const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');
    const r = await queryPg<{ id: string }>(
      `SELECT gs.id
       FROM group_subjects gs
       JOIN groups g ON g.id = gs.group_id
       WHERE gs.teacher_id = $1 AND gs.institution_id = $2
         AND UPPER(TRIM(g.name)) = UPPER(TRIM($3))
       ORDER BY gs.created_at
       LIMIT 1`,
      [profesorId, colegioId, groupNorm]
    );
    const courseId = r.rows[0]?.id ?? null;
    return courseId ? { courseId, group: groupNorm } : null;
  }

  const courses = await findCoursesByProfessorAndGroup(profesorId, groupName, colegioId);
  if (!courses.length) return null;
  const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');
  const courseId = courses[0]._id?.toString?.() ?? courses[0]._id;
  return courseId ? { courseId, group: groupNorm } : null;
}

/**
 * Obtiene el estudiante con mejor promedio en un grupo (solo materias del profesor).
 * Usado para respuestas estructuradas del chat (top_student_card).
 */
export async function queryTopStudentInGroup(
  profesorId: string,
  groupName: string,
  colegioId: string
): Promise<{ studentName: string; studentId: string; average: number; group: string; ranking: number; ctaRoute: string } | null> {
  if (isUuid(profesorId) && isUuid(colegioId)) {
    const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');
    const gs = await queryPg<{ id: string }>(
      `SELECT gs.id
       FROM group_subjects gs
       JOIN groups g ON g.id = gs.group_id
       WHERE gs.teacher_id = $1 AND gs.institution_id = $2
         AND UPPER(TRIM(g.name)) = UPPER(TRIM($3))
       ORDER BY gs.created_at
       LIMIT 20`,
      [profesorId, colegioId, groupNorm]
    );
    const groupSubjectIds = gs.rows.map((x: { id: string }) => x.id);
    if (groupSubjectIds.length === 0) return null;

    const r = await queryPg<{ student_id: string; student_name: string; avg_score: number }>(
      `SELECT u.id AS student_id, u.full_name AS student_name, AVG(gr.score)::float AS avg_score
       FROM grades gr
       JOIN assignments a ON a.id = gr.assignment_id
       JOIN users u ON u.id = gr.user_id
       WHERE a.group_subject_id = ANY($1::uuid[])
       GROUP BY u.id, u.full_name
       ORDER BY avg_score DESC
       LIMIT 1`,
      [groupSubjectIds]
    );
    const top = r.rows[0];
    if (!top) return null;
    const first = groupSubjectIds[0];
    return {
      studentName: top.student_name,
      studentId: top.student_id,
      average: Math.round((top.avg_score ?? 0) * 10) / 10,
      group: groupNorm,
      ranking: 1,
      ctaRoute: first ? `/profesor/cursos/${first}/notas` : `/profesor/academia/notas`,
    };
  }

  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');

  const courses = await findCoursesByProfessorAndGroup(profesorId, groupName, colegioId);
  if (!courses.length) return null;

  const courseIds = courses.map((c: any) => c._id);
  const assignments = await Assignment.find({
    cursoId: { $in: courseIds },
    colegioId,
  })
    .select('_id')
    .lean();
  const assignmentIds = assignments.map((a: any) => a._id);
  if (!assignmentIds.length) return null;

  const studentsInGroup = await User.find({
    rol: 'estudiante',
    colegioId,
    $or: [
      { curso: groupNorm },
      { curso: groupNorm.toLowerCase() },
      { curso: { $regex: new RegExp(`^${groupNorm}$`, 'i') } },
    ],
  })
    .select('_id nombre')
    .lean();
  const studentIds = studentsInGroup.map((s: any) => s._id);
  if (!studentIds.length) return null;

  const notas = await Nota.find({
    tareaId: { $in: assignmentIds },
    estudianteId: { $in: studentIds },
    profesorId: normalizedProfesorId,
  })
    .select('estudianteId nota')
    .lean();

  const sumByStudent: Record<string, { sum: number; count: number }> = {};
  for (const n of notas) {
    const id = (n as any).estudianteId?.toString?.() ?? (n as any).estudianteId;
    if (!id) continue;
    if (!sumByStudent[id]) sumByStudent[id] = { sum: 0, count: 0 };
    sumByStudent[id].sum += (n as any).nota ?? 0;
    sumByStudent[id].count += 1;
  }

  const averages = Object.entries(sumByStudent)
    .filter(([, v]) => v.count > 0)
    .map(([estudianteId, v]) => ({ estudianteId, average: v.sum / v.count }));
  if (!averages.length) return null;

  averages.sort((a, b) => b.average - a.average);
  const top = averages[0];
  const student = studentsInGroup.find((s: any) => s._id.toString() === top.estudianteId);
  const studentName = (student as any)?.nombre ?? 'Estudiante';

  const firstCourseId = courseIds[0]?.toString?.() ?? (courseIds[0] as any);
  const ctaRoute = firstCourseId ? `/profesor/cursos/${firstCourseId}/notas` : `/profesor/cursos/${groupNorm}/notas`;
  return {
    studentName,
    studentId: top.estudianteId,
    average: Math.round(top.average * 10) / 10,
    group: groupNorm,
    ranking: 1,
    ctaRoute,
  };
}

/**
 * Tareas de un grupo para el profesor (vista resumen para chat tasks_overview).
 */
export async function queryAssignmentsOverviewByGroup(
  profesorId: string,
  groupName: string,
  colegioId: string
): Promise<{ group: string; tasks: { title: string; dueDate: string; status: string }[]; ctaRoute: string } | null> {
  if (isUuid(profesorId) && isUuid(colegioId)) {
    const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');
    const gs = await queryPg<{ id: string }>(
      `SELECT gs.id
       FROM group_subjects gs
       JOIN groups g ON g.id = gs.group_id
       WHERE gs.teacher_id = $1 AND gs.institution_id = $2
         AND UPPER(TRIM(g.name)) = UPPER(TRIM($3))
       ORDER BY gs.created_at
       LIMIT 20`,
      [profesorId, colegioId, groupNorm]
    );
    const groupSubjectIds = gs.rows.map((x: { id: string }) => x.id);
    if (groupSubjectIds.length === 0) return null;

    const a = await queryPg<{ id: string; title: string; due_date: string }>(
      `SELECT id, title, due_date
       FROM assignments
       WHERE group_subject_id = ANY($1::uuid[])
       ORDER BY due_date ASC
       LIMIT 20`,
      [groupSubjectIds]
    );
    const ids = a.rows.map((x: { id: string }) => x.id);
    const subs = ids.length
      ? await queryPg<{ assignment_id: string; submitted: boolean }>(
          `SELECT assignment_id, BOOL_OR(status = 'submitted') AS submitted
           FROM submissions
           WHERE assignment_id = ANY($1::uuid[])
           GROUP BY assignment_id`,
          [ids]
        )
      : { rows: [] as Array<{ assignment_id: string; submitted: boolean }> };
    const submittedBy = new Map<string, boolean>(
      subs.rows.map((r: { assignment_id: string; submitted: boolean }) => [r.assignment_id, r.submitted])
    );

    const tasks = a.rows.map((row: { id: string; title: string; due_date: string }) => ({
      title: row.title ?? 'Tarea',
      dueDate: row.due_date ? new Date(row.due_date).toISOString().split('T')[0] : '',
      status: submittedBy.get(row.id) ? 'Entregado' : 'Pendiente',
    }));
    const first = groupSubjectIds[0];
    return { group: groupNorm, tasks, ctaRoute: first ? `/profesor/cursos/${first}/tareas` : `/profesor/academia/tareas` };
  }

  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const groupNorm = String(groupName).trim().toUpperCase().replace(/\s+/g, '');

  const courses = await findCoursesByProfessorAndGroup(profesorId, groupName, colegioId);
  if (!courses.length) return null;

  const courseIds = courses.map((c: any) => c._id);
  const assignments = await Assignment.find({
    cursoId: { $in: courseIds },
    colegioId,
    profesorId: normalizedProfesorId,
  })
    .select('titulo fechaEntrega submissions')
    .sort({ fechaEntrega: 1 })
    .limit(20)
    .lean();

  const tasks = assignments.map((a: any) => ({
    title: a.titulo ?? 'Tarea',
    dueDate: a.fechaEntrega ? new Date(a.fechaEntrega).toISOString().split('T')[0] : '',
    status: Array.isArray(a.submissions) && a.submissions.length > 0 ? 'Entregado' : 'Pendiente',
  }));

  const firstCourseId = courseIds[0]?.toString?.() ?? (courseIds[0] as any);
  const ctaRoute = firstCourseId
    ? `/profesor/cursos/${firstCourseId}/tareas`
    : `/profesor/academia/tareas`;

  return { group: groupNorm, tasks, ctaRoute };
}

/**
 * Tendencia de notas del profesor por mes (para gráfico grade_trend_analysis).
 */
export async function queryGradeTrendForProfessor(
  profesorId: string,
  colegioId: string,
  monthsBack: number = 6
): Promise<{ period: string; average: number; count: number }[]> {
  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);

  const docs = await Nota.aggregate([
    { $match: { profesorId: normalizedProfesorId, fecha: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$fecha' } },
        average: { $avg: '$nota' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return docs.map((d: any) => ({
    period: d._id,
    average: Math.round((d.average ?? 0) * 10) / 10,
    count: d.count ?? 0,
  }));
}

/**
 * Consulta los cursos asignados a un profesor
 */
export async function queryProfessorCourses(
  profesorId: string,
  colegioId: string
): Promise<any[]> {
  if (isUuid(profesorId) && isUuid(colegioId)) {
    const rows = await findGroupSubjectsByTeacherWithDetails(profesorId, colegioId);
    // Agrupar por materia para simular el shape legacy Course.
    const bySubject = new Map<string, { _id: string; nombre: string; descripcion: string | null; cursos: string[] }>();
    for (const r of rows as Array<{
      id: string;
      subject_id: string;
      subject_name: string;
      subject_description: string | null;
      group_name: string;
    }>) {
      const existing = bySubject.get(r.subject_id) ?? { _id: r.subject_id, nombre: r.subject_name, descripcion: r.subject_description, cursos: [] as string[] };
      if (!existing.cursos.includes(r.group_name)) existing.cursos.push(r.group_name);
      bySubject.set(r.subject_id, existing);
    }
    return Array.from(bySubject.values()).map((c) => ({
      _id: c._id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      cursos: c.cursos,
      materiaId: { _id: c._id, nombre: c.nombre },
      colorAcento: null,
      icono: null,
    }));
  }

  const normalizedProfesorId = normalizeIdForQuery(profesorId);

  const cursos = await Course.find({
    colegioId,
    profesorIds: normalizedProfesorId
  })
    .populate('materiaId', 'nombre')
    .select('nombre descripcion materiaId cursos colorAcento icono')
    .sort({ nombre: 1 })
    .lean();

  return cursos;
}

/**
 * Consulta los estudiantes de un curso (solo para profesores)
 */
export async function queryCourseStudents(
  profesorId: string,
  cursoId: string,
  colegioId: string
): Promise<any[]> {
  if (isUuid(profesorId) && isUuid(cursoId) && isUuid(colegioId)) {
    // cursoId = group_subject_id
    const gs = await queryPg<{ group_id: string }>(
      'SELECT group_id FROM group_subjects WHERE id = $1 AND teacher_id = $2 AND institution_id = $3',
      [cursoId, profesorId, colegioId]
    );
    const groupId = gs.rows[0]?.group_id ?? null;
    if (!groupId) {
      throw new Error('No tienes acceso a este curso o el curso no existe');
    }
    const r = await queryPg<{ id: string; full_name: string; email: string; group_name: string }>(
      `SELECT u.id, u.full_name, u.email, g.name AS group_name
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       JOIN groups g ON g.id = e.group_id
       WHERE e.group_id = $1
       ORDER BY u.full_name`,
      [groupId]
    );
    return r.rows.map((row: { id: string; full_name: string; email: string; group_name: string }) => ({
      _id: row.id,
      nombre: row.full_name,
      email: row.email,
      curso: row.group_name,
    }));
  }

  const normalizedProfesorId = normalizeIdForQuery(profesorId);
  const normalizedCursoId = normalizeIdForQuery(cursoId);

  // Verificar que el profesor tenga acceso a este curso
  const curso = await Course.findOne({
    _id: normalizedCursoId,
    colegioId,
    profesorIds: normalizedProfesorId
  }).select('cursos').lean();

  if (!curso) {
    throw new Error('No tienes acceso a este curso o el curso no existe');
  }

  // Obtener estudiantes del curso
  const cursoNormalizado = curso.cursos && curso.cursos.length > 0 
    ? curso.cursos[0].toUpperCase().trim()
    : null;

  if (!cursoNormalizado) {
    return [];
  }

  const estudiantes = await User.find({
    rol: 'estudiante',
    curso: { $in: [cursoNormalizado, cursoNormalizado.toLowerCase()] },
    colegioId
  })
    .select('nombre email curso')
    .sort({ nombre: 1 })
    .lean();

  return estudiantes;
}

/**
 * Consulta eventos del calendario
 */
export async function queryCalendarEvents(
  userId: string,
  colegioId: string,
  cursoId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  const query: any = { colegioId };

  if (cursoId) {
    const normalizedCursoId = normalizeIdForQuery(cursoId);
    query.cursoId = normalizedCursoId;
    query.tipo = 'curso';
  } else {
    query.tipo = 'colegio';
  }

  if (startDate || endDate) {
    query.fecha = {};
    if (startDate) query.fecha.$gte = startDate;
    if (endDate) query.fecha.$lte = endDate;
  }

  const eventos = await Evento.find(query)
    .sort({ fecha: 1 })
    .lean();

  return eventos;
}

/**
 * Consulta notificaciones de un usuario
 */
export async function queryUserNotifications(
  userId: string,
  colegioId: string,
  limit: number = 20
): Promise<any[]> {
  const normalizedUserId = normalizeIdForQuery(userId);

  const notificaciones = await Notificacion.find({
    usuarioId: normalizedUserId
  })
    .sort({ fecha: -1 })
    .limit(limit)
    .lean();

  return notificaciones;
}

/**
 * Consulta mensajes de un usuario
 */
export async function queryUserMessages(
  userId: string,
  colegioId: string,
  limit: number = 50
): Promise<any[]> {
  const normalizedUserId = normalizeIdForQuery(userId);

  const mensajes = await Mensaje.find({
    remitenteId: normalizedUserId
  })
    .populate('chatId', 'titulo')
    .sort({ fecha: -1 })
    .limit(limit)
    .lean();

  return mensajes;
}

