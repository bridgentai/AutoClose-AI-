import { getAllCourseGroupsForStudent } from '../repositories/enrollmentRepository.js';
import { findGroupSubjectsByGroupWithDetails } from '../repositories/groupSubjectRepository.js';
import { findAssignmentsByGroupSubject } from '../repositories/assignmentRepository.js';
import { findGradesByUserAndGroup } from '../repositories/gradeRepository.js';
import { findGradingSchemaByGroupSubject } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
import type { AssignmentRow } from '../repositories/assignmentRepository.js';
import {
  weightedGradeWithinLogro,
  courseWeightedFromLogros,
  hasRecordedScore,
} from '../utils/weightedGrades.js';

export async function buildMateriasNotasForStudent(
  studentId: string,
  institutionId: string
): Promise<{
  materias: Array<{
    _id: string;
    nombre: string;
    groupSubjectId: string;
    promedio: number | null;
    ultimaNota: number | null;
    estado: string;
    tendencia: 'stable';
    colorAcento: string;
    notas: Array<{
      assignmentId?: string;
      tareaTitulo?: string;
      nota: number | null;
      fecha: string;
      comentario: null;
      logro: null;
      gradingCategoryId?: string;
      categoryWeightPct?: number | null;
    }>;
  }>;
  total: number;
}> {
  const courseGroups = await getAllCourseGroupsForStudent(studentId, institutionId);
  if (!courseGroups.length) return { materias: [], total: 0 };

  const seenGs = new Set<string>();
  const materias: Array<{
    _id: string;
    nombre: string;
    groupSubjectId: string;
    promedio: number | null;
    ultimaNota: number | null;
    estado: string;
    tendencia: 'stable';
    colorAcento: string;
    notas: Array<{
      assignmentId?: string;
      tareaTitulo?: string;
      nota: number | null;
      fecha: string;
      comentario: null;
      logro: null;
      gradingCategoryId?: string;
      categoryWeightPct?: number | null;
    }>;
  }> = [];

  for (const g of courseGroups) {
    const allGrades = await findGradesByUserAndGroup(studentId, g.id);
    const gradeByAssign = new Map(allGrades.map((gr) => [gr.assignment_id, gr]));

    const gsList = await findGroupSubjectsByGroupWithDetails(g.id, institutionId);
    for (const gs of gsList) {
      if (seenGs.has(gs.id)) continue;
      seenGs.add(gs.id);

      const rawAsg = await findAssignmentsByGroupSubject(gs.id);
      const gradable = rawAsg.filter((a) => a.is_gradable && a.type !== 'reminder');

      // PERF: `findGroupSubjectsByGroupWithDetails` ya trae `group_name` y `subject_name`.
      // Evitar N+1 queries a groups/subjects por cada group_subject.
      const subjectDisplayName = (gs.display_name?.trim() || (gs as any).subject_name || '').trim() || 'Sin materia';
      const groupName = ((gs as any).group_name || '').trim();
      const nombre = ([subjectDisplayName, groupName].filter(Boolean).join(' ').trim() || subjectDisplayName) as string;

      if (gradable.length === 0) {
        materias.push({
          _id: gs.id,
          nombre,
          groupSubjectId: gs.id,
          promedio: null,
          ultimaNota: null,
          estado: 'sin_notas',
          tendencia: 'stable',
          colorAcento: '',
          notas: [],
        });
        continue;
      }

      const schema = await findGradingSchemaByGroupSubject(gs.id, institutionId);
      const categories = schema ? await findGradingCategoriesBySchema(schema.id) : [];
      const logros = [...categories]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({ _id: c.id, porcentaje: Number(c.weight) }));

      const byCat = new Map<string, AssignmentRow[]>();
      const sinCat: AssignmentRow[] = [];
      for (const a of gradable) {
        if (a.assignment_category_id) {
          const k = a.assignment_category_id;
          if (!byCat.has(k)) byCat.set(k, []);
          byCat.get(k)!.push(a);
        } else sinCat.push(a);
      }

      const scoreFor = (aid: string): number | null => {
        const gr = gradeByAssign.get(aid);
        return gr === undefined ? null : Number(gr.score);
      };

      const notas = [...gradable]
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .map((a) => ({
          assignmentId: a.id,
          tareaTitulo: a.title,
          nota: scoreFor(a.id),
          fecha: gradeByAssign.get(a.id)?.recorded_at ?? a.due_date,
          comentario: null as null,
          logro: null as null,
          gradingCategoryId: a.assignment_category_id ?? undefined,
          categoryWeightPct:
            a.category_weight_pct != null && a.category_weight_pct !== undefined
              ? Number(a.category_weight_pct)
              : undefined,
        }));

      const getCategoryGrade = (catId: string): number | null => {
        const list = byCat.get(catId) ?? [];
        if (list.length === 0) return null;
        const scores = list.map((x) => scoreFor(x.id));
        const slots = list.map((x) => ({
          categoryWeightPct: x.category_weight_pct ?? null,
        }));
        return weightedGradeWithinLogro(slots, scores);
      };

      let promedio: number | null =
        logros.length > 0 ? courseWeightedFromLogros(logros, getCategoryGrade) : null;
      if (promedio != null) promedio = Math.round(promedio * 10) / 10;
      if (promedio == null && logros.length > 0 && sinCat.length > 0) {
        const sc = sinCat.map((x) => scoreFor(x.id)).filter(hasRecordedScore) as number[];
        if (sc.length) promedio = Math.round((sc.reduce((x, y) => x + y, 0) / sc.length) * 10) / 10;
      }
      if (promedio == null) {
        const anyScored = gradable.map((x) => scoreFor(x.id)).filter(hasRecordedScore) as number[];
        if (anyScored.length)
          promedio = Math.round((anyScored.reduce((x, y) => x + y, 0) / anyScored.length) * 10) / 10;
      }

      let ultimaNota: number | null = null;
      let ultimaMs = 0;
      for (const a of gradable) {
        const s = scoreFor(a.id);
        if (!hasRecordedScore(s)) continue;
        const fe = gradeByAssign.get(a.id)?.recorded_at ?? a.due_date;
        const ms = new Date(fe).getTime();
        if (!Number.isNaN(ms) && ms >= ultimaMs) {
          ultimaMs = ms;
          ultimaNota = Number(s);
        }
      }

      const estado =
        promedio == null ? 'sin_notas' : promedio >= 65 ? 'aprobado' : 'reprobado';

      materias.push({
        _id: gs.id,
        nombre,
        groupSubjectId: gs.id,
        promedio,
        ultimaNota,
        estado,
        tendencia: 'stable',
        colorAcento: '',
        notas,
      });
    }
  }

  return { materias, total: materias.length };
}
