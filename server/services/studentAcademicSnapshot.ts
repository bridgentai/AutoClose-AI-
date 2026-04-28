import { getAllCourseGroupsForStudent } from '../repositories/enrollmentRepository.js';
import {
  findGroupSubjectsByGroupWithDetails,
  findGroupSubjectWithDetailsById,
} from '../repositories/groupSubjectRepository.js';
import type { GroupSubjectWithDetails } from '../repositories/groupSubjectRepository.js';
import { findAssignmentsByGroupSubject } from '../repositories/assignmentRepository.js';
import type { AssignmentRow } from '../repositories/assignmentRepository.js';
import { findGradesByUserAndGroup } from '../repositories/gradeRepository.js';
import type { GradeRow } from '../repositories/gradeRepository.js';
import { findGradingSchemaByGroupSubject } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
import { findGradingOutcomesBySchema } from '../repositories/gradingOutcomeRepository.js';
import {
  weightedGradeWithinLogro,
  courseWeightedFromLogros,
  courseGradeFromOutcomes,
  hasRecordedScore,
} from '../utils/weightedGrades.js';

type TrendPoint = { fecha: string; promedio: number };

export interface StudentAssignmentGradeItem {
  assignmentId?: string;
  tareaTitulo?: string;
  nota: number | null;
  fecha: string;
  comentario: null;
  logro: null;
  gradingCategoryId?: string;
  categoryWeightPct?: number | null;
}

export interface StudentLogroSummary {
  id: string;
  nombre: string;
  peso: number | null;
  promedio: number | null;
  notas: number[];
  actividades: number;
}

export interface StudentSubjectPerformanceDetail {
  _id: string;
  nombre: string;
  groupSubjectId: string;
  groupId: string;
  promedio: number | null;
  ultimaNota: number | null;
  estado: string;
  tendencia: 'stable';
  colorAcento: string;
  profesor: string;
  groupName: string;
  subjectName: string;
  notas: StudentAssignmentGradeItem[];
  logros: StudentLogroSummary[];
  evolucion: TrendPoint[];
}

export interface StudentPerformanceSummary {
  materias: StudentSubjectPerformanceDetail[];
  total: number;
}

function roundToTenth(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()}/${date.toLocaleString('es', { month: 'short' })}`;
}

function getSubjectDisplayName(
  displayName: string | null | undefined,
  subjectName: string | undefined,
  groupName: string | undefined
): { nombre: string; subjectDisplayName: string; groupDisplayName: string } {
  const subjectDisplayName = (displayName?.trim() || subjectName || '').trim() || 'Sin materia';
  const groupDisplayName = (groupName || '').trim();
  return {
    nombre: [subjectDisplayName, groupDisplayName].filter(Boolean).join(' ').trim() || subjectDisplayName,
    subjectDisplayName,
    groupDisplayName,
  };
}

function buildEvolution(notas: StudentAssignmentGradeItem[]): TrendPoint[] {
  const gradedItems = notas
    .filter((nota) => hasRecordedScore(nota.nota))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const evolution: TrendPoint[] = [];
  let runningSum = 0;
  let runningCount = 0;
  for (const item of gradedItems) {
    runningSum += Number(item.nota);
    runningCount += 1;
    evolution.push({
      fecha: formatShortDate(item.fecha),
      promedio: Math.round((runningSum / runningCount) * 10) / 10,
    });
  }
  return evolution;
}

function buildLatestGrade(gradable: AssignmentRow[], scoreFor: (assignmentId: string) => number | null, gradeByAssign: Map<string, GradeRow>): number | null {
  let ultimaNota: number | null = null;
  let ultimaMs = 0;
  for (const assignment of gradable) {
    const score = scoreFor(assignment.id);
    if (!hasRecordedScore(score)) continue;
    const dateValue = gradeByAssign.get(assignment.id)?.recorded_at ?? assignment.due_date;
    const currentMs = new Date(dateValue).getTime();
    if (!Number.isNaN(currentMs) && currentMs >= ultimaMs) {
      ultimaMs = currentMs;
      ultimaNota = Number(score);
    }
  }
  return ultimaNota;
}

function buildLogrosFromCategories(
  categories: Array<{ id: string; name: string; weight: number; grading_outcome_id: string | null }>,
  byCat: Map<string, AssignmentRow[]>,
  scoreFor: (assignmentId: string) => number | null
): StudentLogroSummary[] {
  return categories.map((category) => {
    const assignments = byCat.get(category.id) ?? [];
    const scores = assignments.map((assignment) => scoreFor(assignment.id)).filter(hasRecordedScore) as number[];
    const promedio = weightedGradeWithinLogro(
      assignments.map((assignment) => ({ categoryWeightPct: assignment.category_weight_pct ?? null })),
      assignments.map((assignment) => scoreFor(assignment.id))
    );
    return {
      id: category.id,
      nombre: category.name,
      peso: Number(category.weight),
      promedio: roundToTenth(promedio),
      notas: scores.map((score) => roundToTenth(score) ?? 0),
      actividades: scores.length,
    };
  });
}

function buildLogrosFromOutcomes(
  outcomes: Array<{ id: string; description: string; weight: number }>,
  categories: Array<{ id: string; name: string; weight: number; grading_outcome_id: string | null }>,
  byCat: Map<string, AssignmentRow[]>,
  scoreFor: (assignmentId: string) => number | null
): StudentLogroSummary[] {
  return outcomes.map((outcome) => {
    const nestedCategories = categories.filter((category) => category.grading_outcome_id === outcome.id);
    const promedio = courseWeightedFromLogros(
      nestedCategories.map((category) => ({ _id: category.id, porcentaje: Number(category.weight) })),
      (categoryId) => {
        const assignments = byCat.get(categoryId) ?? [];
        return weightedGradeWithinLogro(
          assignments.map((assignment) => ({ categoryWeightPct: assignment.category_weight_pct ?? null })),
          assignments.map((assignment) => scoreFor(assignment.id))
        );
      }
    );
    const notas = nestedCategories.flatMap((category) => {
      const assignments = byCat.get(category.id) ?? [];
      return assignments
        .map((assignment) => scoreFor(assignment.id))
        .filter(hasRecordedScore)
        .map((score) => roundToTenth(Number(score)) ?? 0);
    });
    return {
      id: outcome.id,
      nombre: outcome.description?.trim() || 'Logro',
      peso: Number(outcome.weight),
      promedio: roundToTenth(promedio),
      notas,
      actividades: notas.length,
    };
  });
}

function buildSubjectAverage(
  categories: Array<{ id: string; weight: number; grading_outcome_id: string | null }>,
  outcomes: Array<{ id: string; weight: number }>,
  byCat: Map<string, AssignmentRow[]>,
  sinCat: AssignmentRow[],
  gradable: AssignmentRow[],
  scoreFor: (assignmentId: string) => number | null
): number | null {
  const getCategoryGrade = (categoryId: string): number | null => {
    const assignments = byCat.get(categoryId) ?? [];
    if (assignments.length === 0) return null;
    return weightedGradeWithinLogro(
      assignments.map((assignment) => ({ categoryWeightPct: assignment.category_weight_pct ?? null })),
      assignments.map((assignment) => scoreFor(assignment.id))
    );
  };

  let promedio: number | null = null;
  if (outcomes.length > 0) {
    promedio = courseGradeFromOutcomes(
      outcomes.map((outcome) => ({
        id: outcome.id,
        pesoEnCurso: Number(outcome.weight),
        indicadores: categories
          .filter((category) => category.grading_outcome_id === outcome.id)
          .map((category) => ({ id: category.id, porcentaje: Number(category.weight) })),
      })),
      getCategoryGrade
    );
  } else if (categories.length > 0) {
    promedio = courseWeightedFromLogros(
      categories.map((category) => ({ _id: category.id, porcentaje: Number(category.weight) })),
      getCategoryGrade
    );
  }

  promedio = roundToTenth(promedio);
  if (promedio == null && categories.length > 0 && sinCat.length > 0) {
    const uncategorizedScores = sinCat.map((assignment) => scoreFor(assignment.id)).filter(hasRecordedScore) as number[];
    if (uncategorizedScores.length) {
      promedio = roundToTenth(
        uncategorizedScores.reduce((sum, score) => sum + score, 0) / uncategorizedScores.length
      );
    }
  }

  if (promedio == null) {
    const anyScored = gradable.map((assignment) => scoreFor(assignment.id)).filter(hasRecordedScore) as number[];
    if (anyScored.length) {
      promedio = roundToTenth(anyScored.reduce((sum, score) => sum + score, 0) / anyScored.length);
    }
  }

  return promedio;
}

async function buildOneSubjectPerformance(args: {
  studentId: string;
  institutionId: string;
  groupId: string;
  groupSubject: GroupSubjectWithDetails;
  allGrades: GradeRow[];
}): Promise<StudentSubjectPerformanceDetail> {
  const { institutionId, groupId, groupSubject, allGrades } = args;
  const gradeByAssign = new Map(allGrades.map((grade) => [grade.assignment_id, grade]));
  const rawAssignments = await findAssignmentsByGroupSubject(groupSubject.id);
  const gradable = rawAssignments.filter((assignment) => assignment.is_gradable && assignment.type !== 'reminder');
  const { nombre, subjectDisplayName, groupDisplayName } = getSubjectDisplayName(
    groupSubject.display_name,
    groupSubject.subject_name,
    groupSubject.group_name
  );

  if (gradable.length === 0) {
    return {
      _id: groupSubject.id,
      nombre,
      groupSubjectId: groupSubject.id,
      groupId,
      promedio: null,
      ultimaNota: null,
      estado: 'sin_notas',
      tendencia: 'stable',
      colorAcento: '',
      profesor: groupSubject.teacher_name,
      groupName: groupDisplayName,
      subjectName: subjectDisplayName,
      notas: [],
      logros: [],
      evolucion: [],
    };
  }

  const schema = await findGradingSchemaByGroupSubject(groupSubject.id, institutionId);
  const categories = schema ? await findGradingCategoriesBySchema(schema.id) : [];
  const outcomes = schema ? await findGradingOutcomesBySchema(schema.id) : [];

  const byCat = new Map<string, AssignmentRow[]>();
  const sinCat: AssignmentRow[] = [];
  for (const assignment of gradable) {
    if (assignment.assignment_category_id) {
      const key = assignment.assignment_category_id;
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(assignment);
    } else {
      sinCat.push(assignment);
    }
  }

  const scoreFor = (assignmentId: string): number | null => {
    const grade = gradeByAssign.get(assignmentId);
    return grade === undefined ? null : Number(grade.score);
  };

  const notas = [...gradable]
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .map((assignment) => ({
      assignmentId: assignment.id,
      tareaTitulo: assignment.title,
      nota: scoreFor(assignment.id),
      fecha: gradeByAssign.get(assignment.id)?.recorded_at ?? assignment.due_date,
      comentario: null as null,
      logro: null as null,
      gradingCategoryId: assignment.assignment_category_id ?? undefined,
      categoryWeightPct:
        assignment.category_weight_pct != null ? Number(assignment.category_weight_pct) : undefined,
    }));

  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const sortedOutcomes = [...outcomes].sort((a, b) => a.sort_order - b.sort_order);

  const promedio = buildSubjectAverage(sortedCategories, sortedOutcomes, byCat, sinCat, gradable, scoreFor);
  const logros =
    sortedOutcomes.length > 0
      ? buildLogrosFromOutcomes(sortedOutcomes, sortedCategories, byCat, scoreFor)
      : buildLogrosFromCategories(sortedCategories, byCat, scoreFor);

  const ultimaNota = buildLatestGrade(gradable, scoreFor, gradeByAssign);
  const estado = promedio == null ? 'sin_notas' : promedio >= 65 ? 'aprobado' : 'reprobado';

  return {
    _id: groupSubject.id,
    nombre,
    groupSubjectId: groupSubject.id,
    groupId,
    promedio,
    ultimaNota,
    estado,
    tendencia: 'stable',
    colorAcento: '',
    profesor: groupSubject.teacher_name,
    groupName: groupDisplayName,
    subjectName: subjectDisplayName,
    notas,
    logros,
    evolucion: buildEvolution(notas),
  };
}

export async function buildDetailedMateriasNotasForStudent(
  studentId: string,
  institutionId: string,
  options?: { groupId?: string }
): Promise<StudentPerformanceSummary> {
  const courseGroups = await getAllCourseGroupsForStudent(studentId, institutionId);
  const filteredGroups = options?.groupId
    ? courseGroups.filter((group) => group.id === options.groupId)
    : courseGroups;

  if (!filteredGroups.length) {
    return { materias: [], total: 0 };
  }

  const materias: StudentSubjectPerformanceDetail[] = [];
  const seenGroupSubjects = new Set<string>();

  for (const group of filteredGroups) {
    const allGrades = await findGradesByUserAndGroup(studentId, group.id);
    const groupSubjects = await findGroupSubjectsByGroupWithDetails(group.id, institutionId);

    for (const groupSubject of groupSubjects) {
      if (seenGroupSubjects.has(groupSubject.id)) continue;
      seenGroupSubjects.add(groupSubject.id);
      materias.push(
        await buildOneSubjectPerformance({
          studentId,
          institutionId,
          groupId: group.id,
          groupSubject,
          allGrades,
        })
      );
    }
  }

  return { materias, total: materias.length };
}

export async function buildDetailedSingleSubjectPerformance(
  studentId: string,
  institutionId: string,
  groupSubjectId: string
): Promise<StudentSubjectPerformanceDetail | null> {
  const groupSubject = await findGroupSubjectWithDetailsById(groupSubjectId, institutionId);
  if (!groupSubject) return null;
  const allGrades = await findGradesByUserAndGroup(studentId, groupSubject.group_id);
  return buildOneSubjectPerformance({
    studentId,
    institutionId,
    groupId: groupSubject.group_id,
    groupSubject,
    allGrades,
  });
}
