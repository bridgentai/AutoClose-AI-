import * as dataQuery from './dataQuery';
import { handleTopStudentInGroup } from './academicIntentService';

export type StructuredMessageType = 'text' | 'top_student_card' | 'tasks_overview' | 'grade_trend_analysis' | 'notes_overview';

export interface StructuredPayload {
  type: StructuredMessageType;
  content: string;
  data?: Record<string, unknown>;
}

/**
 * Handler para "mejor promedio en [grupo]".
 */
export async function handleTopStudent(
  profesorId: string,
  group: string | undefined,
  colegioId: string
): Promise<StructuredPayload> {
  const groupName = group || (await inferFirstGroup(profesorId, colegioId));
  if (!groupName) {
    return {
      type: 'text',
      content: 'No pude identificar el grupo. Indica el grupo, por ejemplo: "Muéstrame el mejor promedio en 11H".',
    };
  }
  const result = await handleTopStudentInGroup(profesorId, groupName, colegioId);
  return {
    type: result.type as StructuredMessageType,
    content: result.content,
    data: result.data as Record<string, unknown> | undefined,
  };
}

/**
 * Handler para "tareas del [grupo]".
 */
export async function handleTasksOverview(
  profesorId: string,
  group: string | undefined,
  colegioId: string
): Promise<StructuredPayload> {
  const groupName = group || (await inferFirstGroup(profesorId, colegioId));
  if (!groupName) {
    return {
      type: 'text',
      content: 'Indica el grupo, por ejemplo: "Muéstrame las tareas del 11H".',
    };
  }
  const result = await dataQuery.queryAssignmentsOverviewByGroup(profesorId, groupName, colegioId);
  if (!result) {
    return {
      type: 'text',
      content: `No encontré tareas para el grupo ${groupName}. Verifica que tengas asignaciones en ese curso.`,
    };
  }
  return {
    type: 'tasks_overview',
    content: `Hay ${result.tasks.length} tarea(s) en ${result.group}.`,
    data: {
      group: result.group,
      tasks: result.tasks,
      ctaRoute: result.ctaRoute,
    },
  };
}

/**
 * Handler para "tendencias / análisis de notas".
 */
export async function handleGradeTrendAnalysis(
  profesorId: string,
  colegioId: string,
  _period?: string
): Promise<StructuredPayload> {
  const monthsBack = 6;
  const chartData = await dataQuery.queryGradeTrendForProfessor(profesorId, colegioId, monthsBack);
  if (!chartData.length) {
    return {
      type: 'text',
      content: 'Aún no hay suficientes calificaciones para mostrar tendencias. Sigue cargando notas.',
    };
  }
  const last = chartData[chartData.length - 1];
  const first = chartData[0];
  const trend = last && first ? (last.average >= first.average ? 'mejora' : 'descenso') : 'estable';
  const aiInsights = `En los últimos ${monthsBack} meses el promedio mensual ${trend === 'mejora' ? 'ha mejorado' : trend === 'descenso' ? 'ha bajado' : 'se mantiene'}. Último periodo: ${last?.average ?? 0} (${last?.count ?? 0} notas).`;
  return {
    type: 'grade_trend_analysis',
    content: aiInsights,
    data: {
      chartData,
      aiInsights,
    },
  };
}

/**
 * Handler para "notas del grupo X" / "ver notas de 11H": redirige a la tabla de notas del curso.
 */
export async function handleNotesOverview(
  profesorId: string,
  group: string | undefined,
  colegioId: string
): Promise<StructuredPayload> {
  const groupName = group || (await inferFirstGroup(profesorId, colegioId));
  if (!groupName) {
    return {
      type: 'text',
      content: 'Indica el grupo para ver sus notas, por ejemplo: "Muéstrame las notas del 11H" o "Ver notas de 11H".',
    };
  }
  const result = await dataQuery.queryCourseIdByGroupForProfessor(profesorId, groupName, colegioId);
  if (!result) {
    return {
      type: 'text',
      content: `No encontré un curso asignado al grupo ${groupName} en tu perfil. Verifica que tengas ese grupo en Academia > Cursos.`,
    };
  }
  const ctaRoute = `/profesor/cursos/${result.courseId}/notas`;
  return {
    type: 'notes_overview',
    content: `Puedes ver la tabla de notas del grupo ${result.group} aquí.`,
    data: {
      group: result.group,
      ctaRoute,
    },
  };
}

async function inferFirstGroup(profesorId: string, colegioId: string): Promise<string | null> {
  const courses = await dataQuery.queryProfessorCourses(profesorId, colegioId);
  const first = courses[0] as any;
  if (!first?.cursos?.length) return null;
  return (first.cursos[0] as string)?.toUpperCase?.() ?? null;
}
