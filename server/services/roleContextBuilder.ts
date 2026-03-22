import { queryPg } from '../config/db-pg.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGuardianStudentsByGuardian } from '../repositories/guardianStudentRepository.js';
import { getFirstGroupForStudent, getFirstGroupNameForStudent } from '../repositories/enrollmentRepository.js';
import {
  findGroupSubjectsByGroupWithDetails,
  findGroupSubjectsByTeacherWithDetails,
  type GroupSubjectWithDetails,
} from '../repositories/groupSubjectRepository.js';
import { sanitizeContextObject, type SanitizerContext } from './llmSanitizer.js';

/**
 * Servicio que construye contexto específico por rol
 * Este contexto se inyecta en el system prompt para personalizar las respuestas del AI
 */

export interface RoleContext {
  role: string;
  curso?: string;
  materias?: any[];
  cursosAsignados?: any[];
  tareasPendientes?: number;
  notasRecientes?: number;
  hijos?: any[];
  permisos?: string[];
  /** Resumen de notas de los estudiantes del profesor (solo sus cursos) */
  resumenNotasProfesor?: { materiaNombre: string; grupo: string; notas: { estudianteNombre: string; tareaTitulo: string; nota: number; fecha?: string }[] }[];
}

function groupBySubject(rows: GroupSubjectWithDetails[]): Array<{
  _id: string;
  nombre: string;
  descripcion?: string | null;
  cursos: string[];
  materiaId?: { _id: string; nombre: string };
}> {
  const map = new Map<string, { _id: string; nombre: string; descripcion?: string | null; cursos: string[]; materiaId?: { _id: string; nombre: string } }>();
  for (const r of rows) {
    const key = r.subject_id;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        _id: r.subject_id,
        nombre: r.subject_name,
        descripcion: r.subject_description,
        cursos: [r.group_name],
        materiaId: { _id: r.subject_id, nombre: r.subject_name },
      });
    } else if (!existing.cursos.includes(r.group_name)) {
      existing.cursos.push(r.group_name);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Construye el contexto específico para un estudiante
 */
export async function buildStudentContext(
  userId: string,
  colegioId: string
): Promise<RoleContext> {
  const estudiante = await findUserById(userId);
  if (!estudiante) {
    return {
      role: 'estudiante',
      permisos: ['consultar_notas_estudiante', 'consultar_materias', 'consultar_tareas', 'entregar_tarea', 'consultar_calendario']
    };
  }

  const group = await getFirstGroupForStudent(userId, colegioId);
  const cursoNombre = group?.name ?? null;
  if (!cursoNombre || !group) {
    return {
      role: 'estudiante',
      permisos: ['consultar_notas_estudiante', 'consultar_materias', 'consultar_tareas', 'entregar_tarea', 'consultar_calendario']
    };
  }

  const materiasRows = await findGroupSubjectsByGroupWithDetails(group.id, colegioId);
  const materias = materiasRows.map((r) => ({
    _id: r.subject_id,
    nombre: r.subject_name,
    descripcion: r.subject_description,
    profesor: { _id: r.teacher_id, nombre: r.teacher_name },
    curso: r.group_name,
    groupSubjectId: r.id,
  }));

  const tareasPendientesRes = await queryPg<{ c: number }>(
    `SELECT COUNT(*)::int AS c
     FROM assignments a
     JOIN group_subjects gs ON gs.id = a.group_subject_id
     WHERE gs.group_id = $1 AND gs.institution_id = $2
       AND NOT EXISTS (
         SELECT 1 FROM submissions s
         WHERE s.assignment_id = a.id AND s.student_id = $3 AND s.status = 'submitted'
       )`,
    [group.id, colegioId, userId]
  );
  const tareasPendientes = tareasPendientesRes.rows[0]?.c ?? 0;

  const notasRecientesRes = await queryPg<{ c: number }>(
    `SELECT COUNT(*)::int AS c
     FROM (
       SELECT 1
       FROM grades g
       WHERE g.user_id = $1 AND g.recorded_at IS NOT NULL
       ORDER BY g.recorded_at DESC
       LIMIT 5
     ) t`,
    [userId]
  );
  const notasRecientes = notasRecientesRes.rows[0]?.c ?? 0;

  return {
    role: 'estudiante',
    curso: cursoNombre,
    materias,
    tareasPendientes,
    notasRecientes,
    permisos: [
      'consultar_notas_estudiante',
      'consultar_materias',
      'consultar_tareas',
      'entregar_tarea',
      'consultar_calendario',
      'consultar_notificaciones'
    ]
  };
}

/**
 * Construye el contexto específico para un profesor
 */
export async function buildProfessorContext(
  userId: string,
  colegioId: string
): Promise<RoleContext> {
  const teacher = await findUserById(userId);
  if (!teacher) {
    return { role: 'profesor', permisos: [] };
  }

  const rows = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
  const cursos = groupBySubject(rows);

  const cursosConGrupos = cursos.map((curso) => ({
    ...curso,
    grupos: curso.cursos || [],
    courseId: curso._id,
  }));

  // Resumen ligero: últimas calificaciones registradas en tareas creadas por este profesor, agrupadas por materia+grupo.
  const resumenRes = await queryPg<{
    subject_name: string;
    group_name: string;
    student_name: string;
    assignment_title: string;
    score: number;
    recorded_at: string;
  }>(
    `SELECT s.name AS subject_name,
            g.name AS group_name,
            stu.full_name AS student_name,
            a.title AS assignment_title,
            gr.score AS score,
            gr.recorded_at AS recorded_at
     FROM grades gr
     JOIN assignments a ON a.id = gr.assignment_id
     JOIN group_subjects gs ON gs.id = a.group_subject_id
     JOIN subjects s ON s.id = gs.subject_id
     JOIN groups g ON g.id = gs.group_id
     JOIN users stu ON stu.id = gr.user_id
     WHERE a.created_by = $1 AND gs.institution_id = $2
     ORDER BY gr.recorded_at DESC
     LIMIT 150`,
    [userId, colegioId]
  );
  const resumenMap = new Map<string, { materiaNombre: string; grupo: string; notas: { estudianteNombre: string; tareaTitulo: string; nota: number; fecha?: string }[] }>();
  for (const r of resumenRes.rows) {
    const key = `${r.subject_name}@@${r.group_name}`;
    const existing = resumenMap.get(key);
    const entry = existing ?? { materiaNombre: r.subject_name, grupo: r.group_name, notas: [] as { estudianteNombre: string; tareaTitulo: string; nota: number; fecha?: string }[] };
    entry.notas.push({
      estudianteNombre: r.student_name,
      tareaTitulo: r.assignment_title,
      nota: r.score,
      fecha: r.recorded_at ? new Date(r.recorded_at).toISOString().split('T')[0] : undefined,
    });
    resumenMap.set(key, entry);
  }
  const resumenNotasProfesor = Array.from(resumenMap.values())
    .map((x) => ({ ...x, notas: x.notas.slice(0, 50) }))
    .slice(0, 20);

  return {
    role: 'profesor',
    cursosAsignados: cursosConGrupos,
    resumenNotasProfesor,
    permisos: [
      'consultar_notas_curso',
      'consultar_materias',
      'consultar_tareas',
      'asignar_tarea',
      'calificar_tarea',
      'subir_nota',
      'modificar_fecha_tarea',
      'enviar_comentario',
      'crear_boletin',
      'consultar_estudiantes_curso',
      'consultar_calendario',
      'consultar_notificaciones'
    ]
  };
}

/**
 * Construye el contexto específico para un padre
 */
export async function buildParentContext(
  userId: string,
  colegioId: string
): Promise<RoleContext> {
  const guardian = await findUserById(userId);
  if (!guardian) {
    return {
      role: 'padre',
      permisos: ['consultar_informacion_hijo', 'crear_permiso', 'consultar_calendario', 'consultar_notificaciones']
    };
  }

  const links = await findGuardianStudentsByGuardian(userId);
  const studentIds = links.map((l) => l.student_id);
  if (studentIds.length === 0) {
    return {
      role: 'padre',
      permisos: ['consultar_informacion_hijo', 'crear_permiso', 'consultar_calendario', 'consultar_notificaciones']
    };
  }

  const childrenRes = await queryPg<{ id: string; full_name: string }>(
    'SELECT id, full_name FROM users WHERE id = ANY($1::uuid[])',
    [studentIds]
  );
  const hijos = await Promise.all(childrenRes.rows.map(async (c: { id: string; full_name: string }) => {
    const curso = await getFirstGroupNameForStudent(c.id);
    return { _id: c.id, nombre: c.full_name, curso: curso ?? undefined };
  }));

  return {
    role: 'padre',
    hijos,
    permisos: [
      'consultar_informacion_hijo',
      'crear_permiso',
      'consultar_calendario',
      'consultar_notificaciones'
    ]
  };
}

/**
 * Construye el contexto específico para un directivo
 */
export async function buildDirectivoContext(
  userId: string,
  colegioId: string
): Promise<RoleContext> {
  return {
    role: 'directivo',
    permisos: [
      'consultar_notas_curso',
      'consultar_materias',
      'consultar_tareas',
      'modificar_fecha_tarea',
      'crear_boletin',
      'consultar_estudiantes_curso',
      'consultar_calendario',
      'consultar_notificaciones'
    ]
  };
}

/**
 * Construye el contexto específico para un asistente.
 * Recibe reportes de asistencia (como directivo), puede crear permisos de salida y escribir a padres.
 */
export async function buildAsistenteContext(
  userId: string,
  colegioId: string
): Promise<RoleContext> {
  return {
    role: 'asistente',
    permisos: [
      'crear_permiso',
      'consultar_asistencia',
      'consultar_reportes_asistencia',
      'consultar_calendario',
      'consultar_notificaciones',
      'escribir_a_padres'
    ]
  };
}

/**
 * Construye el contexto según el rol del usuario
 */
export async function buildRoleContext(
  userId: string,
  role: string,
  colegioId: string
): Promise<RoleContext> {
  switch (role) {
    case 'estudiante':
      return await buildStudentContext(userId, colegioId);
    case 'profesor':
      return await buildProfessorContext(userId, colegioId);
    case 'padre':
      return await buildParentContext(userId, colegioId);
    case 'directivo':
      return await buildDirectivoContext(userId, colegioId);
    case 'asistente':
      return await buildAsistenteContext(userId, colegioId);
    default:
      return {
        role,
        permisos: []
      };
  }
}

/**
 * Nombres conocidos del contexto para sustituir por tokens al enviar al LLM.
 */
export function buildSanitizerContextFromRoleContext(ctx: RoleContext): SanitizerContext {
  const studentNames: string[] = [];
  const teacherNames: string[] = [];

  if (ctx.materias) {
    for (const m of ctx.materias) {
      const prof = m?.profesor as { nombre?: string } | undefined;
      const n = prof?.nombre;
      if (typeof n === 'string' && n.trim()) teacherNames.push(n);
    }
  }

  if (ctx.resumenNotasProfesor) {
    for (const block of ctx.resumenNotasProfesor) {
      for (const n of block.notas) {
        if (n.estudianteNombre?.trim()) studentNames.push(n.estudianteNombre);
      }
    }
  }

  if (ctx.hijos) {
    for (const h of ctx.hijos) {
      if (h.nombre?.trim()) studentNames.push(h.nombre);
    }
  }

  return {
    studentNames: Array.from(new Set(studentNames)),
    teacherNames: Array.from(new Set(teacherNames)),
  };
}

/**
 * Formatea el contexto para incluir en el system prompt
 */
export function formatContextForPrompt(context: RoleContext): string {
  const safeContext = sanitizeContextObject(context as unknown as Record<string, unknown>) as unknown as RoleContext;

  let prompt = `\n\nCONTEXTO DEL USUARIO:\n`;
  prompt += `- Rol: ${safeContext.role}\n`;

  if (safeContext.curso) {
    prompt += `- Curso: ${safeContext.curso}\n`;
  }

  if (safeContext.materias && safeContext.materias.length > 0) {
    prompt += `- Materias asignadas: ${safeContext.materias.map((m) => m.nombre).join(', ')}\n`;
  }

  if (safeContext.cursosAsignados && safeContext.cursosAsignados.length > 0) {
    prompt += `- Materias asignadas (con sus grupos/cursos):\n`;
    safeContext.cursosAsignados.forEach((c: Record<string, unknown>) => {
      const grupos = c.grupos && Array.isArray(c.grupos) ? (c.grupos as string[]).join(', ') : 'Sin grupos';
      prompt += `  * ${c.nombre} (materia): Grupos/Cursos [${grupos}]\n`;
      prompt += `    - Cuando el usuario menciona cualquiera de estos grupos (${grupos}), se refiere a esta materia\n`;
    });
    prompt += `\nIMPORTANTE: Los "cursos" son los grupos (12C, 12D, etc.), NO las materias. Cuando el usuario dice "12C" o "curso 12C", se refiere al GRUPO 12C.\n`;
  }

  if (safeContext.resumenNotasProfesor && safeContext.resumenNotasProfesor.length > 0) {
    prompt += `\n- NOTAS DE TUS ESTUDIANTES (solo de tus cursos):\n`;
    safeContext.resumenNotasProfesor.forEach((materia: Record<string, unknown>) => {
      prompt += `  * ${materia.materiaNombre} (grupo ${materia.grupo}):\n`;
      (materia.notas as Array<Record<string, unknown>>).forEach((n) => {
        prompt += `    - ${n.estudianteNombre}: "${n.tareaTitulo}" = ${n.nota}${n.fecha ? ` (${n.fecha})` : ''}\n`;
      });
    });
    prompt += `\nUsa esta información cuando te pregunten por notas, promedios o rendimiento de sus estudiantes.\n`;
  }

  if (safeContext.tareasPendientes !== undefined) {
    prompt += `- Tareas pendientes: ${safeContext.tareasPendientes}\n`;
  }

  if (safeContext.hijos && safeContext.hijos.length > 0) {
    prompt += `- Hijos: ${safeContext.hijos.map((h) => h.nombre).join(', ')}\n`;
  }

  if (safeContext.permisos && safeContext.permisos.length > 0) {
    prompt += `- Funciones disponibles: ${safeContext.permisos.join(', ')}\n`;
  }

  return prompt;
}

