import { User, Course, Assignment } from '../models';
import { normalizeIdForQuery } from '../utils/idGenerator';
import * as dataQuery from './dataQuery';

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

/**
 * Construye el contexto específico para un estudiante
 */
export async function buildStudentContext(
  userId: string,
  colegioId: string
): Promise<RoleContext> {
  const normalizedUserId = normalizeIdForQuery(userId);
  const estudiante = await User.findById(normalizedUserId).select('curso').lean();
  
  if (!estudiante || !estudiante.curso) {
    return {
      role: 'estudiante',
      permisos: ['consultar_notas_estudiante', 'consultar_materias', 'consultar_tareas', 'entregar_tarea', 'consultar_calendario']
    };
  }

  // Obtener materias del estudiante
  const materias = await dataQuery.queryStudentSubjects(userId, colegioId);
  
  // Obtener tareas pendientes
  const tareas = await dataQuery.queryStudentAssignments(userId, colegioId, 'pendiente');
  
  // Obtener notas recientes (últimas 5)
  const notas = await dataQuery.queryStudentNotes(userId, colegioId);
  const notasRecientes = notas.slice(0, 5);

  return {
    role: 'estudiante',
    curso: estudiante.curso as string,
    materias,
    tareasPendientes: tareas.length,
    notasRecientes: notasRecientes.length,
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
  // Obtener cursos asignados al profesor
  const cursos = await dataQuery.queryProfessorCourses(userId, colegioId);
  
  // Enriquecer cursos con información de grupos
  const cursosConGrupos = cursos.map(curso => ({
    ...curso,
    grupos: curso.cursos || [], // Array de grupos asignados (ej: ["11D", "12H", "12C"])
    courseId: curso._id.toString(), // ID del curso para usar en asignar_tarea
    materiaId: curso.materiaId?._id?.toString() || curso.materiaId?.toString() || curso._id.toString()
  }));
  
  // Contar estudiantes totales en todos los cursos
  let totalEstudiantes = 0;
  for (const curso of cursos) {
    const estudiantes = await dataQuery.queryCourseStudents(userId, curso._id.toString(), colegioId);
    totalEstudiantes += estudiantes.length;
  }

  const resumenNotasProfesor = await dataQuery.queryProfessorNotesSummary(userId, colegioId);

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
  const normalizedUserId = normalizeIdForQuery(userId);
  const padre = await User.findById(normalizedUserId).select('hijoId').lean();
  
  if (!padre || !padre.hijoId) {
    return {
      role: 'padre',
      permisos: ['consultar_informacion_hijo', 'crear_permiso', 'consultar_calendario', 'consultar_notificaciones']
    };
  }

  // Obtener información del hijo
  const hijoInfo = await dataQuery.queryChildInfo(userId, padre.hijoId, colegioId);

  return {
    role: 'padre',
    hijos: [hijoInfo.estudiante],
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
    default:
      return {
        role,
        permisos: []
      };
  }
}

/**
 * Formatea el contexto para incluir en el system prompt
 */
export function formatContextForPrompt(context: RoleContext): string {
  let prompt = `\n\nCONTEXTO DEL USUARIO:\n`;
  prompt += `- Rol: ${context.role}\n`;
  
  if (context.curso) {
    prompt += `- Curso: ${context.curso}\n`;
  }
  
  if (context.materias && context.materias.length > 0) {
    prompt += `- Materias asignadas: ${context.materias.map(m => m.nombre).join(', ')}\n`;
  }
  
  if (context.cursosAsignados && context.cursosAsignados.length > 0) {
    prompt += `- Materias asignadas (con sus grupos/cursos):\n`;
    context.cursosAsignados.forEach((c: any) => {
      const grupos = c.grupos && Array.isArray(c.grupos) ? c.grupos.join(', ') : 'Sin grupos';
      prompt += `  * ${c.nombre} (materia): Grupos/Cursos [${grupos}]\n`;
      prompt += `    - Cuando el usuario menciona cualquiera de estos grupos (${grupos}), se refiere a esta materia\n`;
    });
    prompt += `\nIMPORTANTE: Los "cursos" son los grupos (12C, 12D, etc.), NO las materias. Cuando el usuario dice "12C" o "curso 12C", se refiere al GRUPO 12C.\n`;
  }

  if (context.resumenNotasProfesor && context.resumenNotasProfesor.length > 0) {
    prompt += `\n- NOTAS DE TUS ESTUDIANTES (solo de tus cursos):\n`;
    context.resumenNotasProfesor.forEach((materia: any) => {
      prompt += `  * ${materia.materiaNombre} (grupo ${materia.grupo}):\n`;
      materia.notas.forEach((n: any) => {
        prompt += `    - ${n.estudianteNombre}: "${n.tareaTitulo}" = ${n.nota}${n.fecha ? ` (${n.fecha})` : ''}\n`;
      });
    });
    prompt += `\nUsa esta información cuando te pregunten por notas, promedios o rendimiento de sus estudiantes.\n`;
  }
  
  if (context.tareasPendientes !== undefined) {
    prompt += `- Tareas pendientes: ${context.tareasPendientes}\n`;
  }
  
  if (context.hijos && context.hijos.length > 0) {
    prompt += `- Hijos: ${context.hijos.map(h => h.nombre).join(', ')}\n`;
  }
  
  if (context.permisos && context.permisos.length > 0) {
    prompt += `- Funciones disponibles: ${context.permisos.join(', ')}\n`;
  }
  
  return prompt;
}

