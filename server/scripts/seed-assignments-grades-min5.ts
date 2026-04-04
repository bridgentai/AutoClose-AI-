/**
 * Asegura al menos 5 calificaciones por estudiante y por materia (group_subject).
 * Solo crea asignaciones nuevas si el mínimo de notas entre los inscritos es < 5.
 * Cada nueva asignación se califica para todos los estudiantes del grupo (rol estudiante).
 *
 * Al inicio elimina todas las asignaciones marcadas con SEED_ASSIGNMENT_DESCRIPTION de esta
 * institución (creadas por corridas anteriores de este script); submissions y grades caen en CASCADE.
 *
 * Fechas de entrega: como máximo una tarea por día por curso (grupo), repartidas en días hábiles
 * entre el inicio del mes de hace DUE_DATE_WINDOW_MONTHS_BACK meses y hoy (incluye mes pasado y actual).
 *
 * Uso (raíz del repo):
 *   INSTITUTION_ID=<uuid> npx tsx server/scripts/seed-assignments-grades-min5.ts
 * Por defecto INSTITUTION_ID = demo Caobos (CLAUDE.md).
 *
 * Requiere DATABASE_URL (PostgreSQL).
 */
import 'dotenv/config';
import { queryPg } from '../config/db-pg.js';
import { createAssignment } from '../repositories/assignmentRepository.js';
import { upsertGrade } from '../repositories/gradeRepository.js';
import { findGradingSchemaByGroup } from '../repositories/gradingSchemaRepository.js';
import { findGradingCategoriesBySchema } from '../repositories/gradingCategoryRepository.js';
const DEFAULT_INSTITUTION = 'f0000000-0000-0000-0000-000000000001';
const MIN_GRADES_PER_STUDENT = 5;
/** Huella para borrar/recrear solo lo generado por este seed (no tocar tareas manuales). */
const SEED_ASSIGNMENT_DESCRIPTION = 'Datos generados automáticamente para pruebas de la demo.';
/** Ventana de fechas: desde el día 1 de hace N meses (incl. mes pasado) hasta hoy. */
const DUE_DATE_WINDOW_MONTHS_BACK = 3;
/** Hora UTC de entrega (evita que todas caigan a medianoche). */
const DUE_HOUR_UTC = 17;

type UsedDueDatesByGroup = Map<string, Set<string>>;

function toYmdUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Primer día del mes, hace `monthsBack` meses (0 = mes actual). */
function firstDayOfMonthUTC(monthsBack: number): Date {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() - monthsBack;
  const d = new Date(Date.UTC(y, m, 1, 12, 0, 0, 0));
  return d;
}

function isWeekendUTC(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Carga YYYY-MM-DD ya ocupados por curso (todas las materias del grupo).
 */
async function loadUsedDueDatesByGroup(institutionId: string): Promise<UsedDueDatesByGroup> {
  const r = await queryPg<{ group_id: string; ymd: string }>(
    `SELECT gs.group_id::text AS group_id,
            to_char((a.due_date AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS ymd
     FROM assignments a
     INNER JOIN group_subjects gs ON gs.id = a.group_subject_id
     WHERE gs.institution_id = $1`,
    [institutionId]
  );
  const map: UsedDueDatesByGroup = new Map();
  for (const row of r.rows) {
    if (!row.ymd) continue;
    let set = map.get(row.group_id);
    if (!set) {
      set = new Set<string>();
      map.set(row.group_id, set);
    }
    set.add(row.ymd);
  }
  return map;
}

function ensureGroupSet(map: UsedDueDatesByGroup, groupId: string): Set<string> {
  let s = map.get(groupId);
  if (!s) {
    s = new Set<string>();
    map.set(groupId, s);
  }
  return s;
}

/**
 * Elige un día hábil en [rangeStart, rangeEnd] que el curso aún no tenga con tarea.
 * Si no hay cupo en la ventana, sigue hacia atrás (incl. fines de semana) hasta encontrar día libre.
 */
function pickDueDateIsoForGroup(
  usedYmdByGroup: UsedDueDatesByGroup,
  groupId: string,
  rangeStart: Date,
  rangeEnd: Date
): string {
  const used = ensureGroupSet(usedYmdByGroup, groupId);

  const tryPick = (allowWeekend: boolean): string | null => {
    let d = new Date(rangeEnd);
    d.setUTCHours(12, 0, 0, 0);
    const minTs = Date.UTC(
      rangeStart.getUTCFullYear(),
      rangeStart.getUTCMonth(),
      rangeStart.getUTCDate()
    );
    while (d.getTime() >= minTs) {
      const ymd = toYmdUTC(d);
      if (!used.has(ymd) && (allowWeekend || !isWeekendUTC(d))) {
        used.add(ymd);
        return `${ymd}T${String(DUE_HOUR_UTC).padStart(2, '0')}:00:00.000Z`;
      }
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return null;
  };

  let iso = tryPick(false);
  if (iso) return iso;

  let d = new Date(rangeStart);
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(12, 0, 0, 0);
  for (let i = 0; i < 400; i++) {
    const ymd = toYmdUTC(d);
    if (!used.has(ymd)) {
      used.add(ymd);
      return `${ymd}T${String(DUE_HOUR_UTC).padStart(2, '0')}:00:00.000Z`;
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  throw new Error(`No se pudo asignar fecha de entrega libre para el grupo ${groupId}`);
}

interface GroupSubjectSeedRow {
  id: string;
  group_id: string;
  institution_id: string;
  teacher_id: string | null;
  subject_name: string;
  group_name: string;
}

function scoreForStudent(studentId: string, salt: number): number {
  const s = `${studentId}:${salt}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return 55 + (h % 46);
}

async function ensureGradingCategoryId(groupId: string, institutionId: string): Promise<string> {
  let schema = await findGradingSchemaByGroup(groupId, institutionId);
  if (!schema) {
    await queryPg(
      `INSERT INTO grading_schemas (group_id, institution_id, name, version, is_active)
       VALUES ($1, $2, $3, 1, true)`,
      [groupId, institutionId, 'Esquema demo (seed calificaciones)']
    );
    schema = await findGradingSchemaByGroup(groupId, institutionId);
  }
  if (!schema) {
    throw new Error(`No se pudo crear u obtener grading_schemas para group_id=${groupId}`);
  }

  let categories = await findGradingCategoriesBySchema(schema.id);
  if (categories.length === 0) {
    const out = await queryPg<{ id: string }>(
      `INSERT INTO grading_outcomes (grading_schema_id, institution_id, description, weight, sort_order)
       VALUES ($1, $2, '', 100, 0) RETURNING id`,
      [schema.id, institutionId]
    );
    const outcomeId = out.rows[0]?.id;
    if (!outcomeId) throw new Error('No se pudo crear grading_outcome');
    const cat = await queryPg<{ id: string }>(
      `INSERT INTO grading_categories (grading_schema_id, institution_id, grading_outcome_id, name, weight, sort_order, evaluation_type, risk_impact_multiplier)
       VALUES ($1, $2, $3, $4, 100, 0, 'summative', 1) RETURNING id`,
      [schema.id, institutionId, outcomeId, 'Evaluación continua']
    );
    const id = cat.rows[0]?.id;
    if (!id) throw new Error('No se pudo crear grading_category');
    return id;
  }
  return categories[0].id;
}

async function loadGroupSubjects(institutionId: string): Promise<GroupSubjectSeedRow[]> {
  const r = await queryPg<GroupSubjectSeedRow>(
    `SELECT gs.id, gs.group_id, gs.institution_id, gs.teacher_id,
            COALESCE(gs.display_name, s.name) AS subject_name,
            g.name AS group_name
     FROM group_subjects gs
     JOIN groups g ON g.id = gs.group_id AND g.institution_id = gs.institution_id
     JOIN subjects s ON s.id = gs.subject_id
     WHERE gs.institution_id = $1
     ORDER BY g.name, subject_name`,
    [institutionId]
  );
  return r.rows;
}

async function studentIdsForGroup(groupId: string, institutionId: string): Promise<string[]> {
  const r = await queryPg<{ student_id: string }>(
    `SELECT DISTINCT e.student_id
     FROM enrollments e
     INNER JOIN users u ON u.id = e.student_id AND u.institution_id = $2
     INNER JOIN groups g ON g.id = e.group_id AND g.institution_id = $2
     WHERE e.group_id = $1 AND u.role = 'estudiante'`,
    [groupId, institutionId]
  );
  return r.rows.map((x: { student_id: string }) => x.student_id);
}

async function gradeCountsByStudent(groupSubjectId: string): Promise<Map<string, number>> {
  const r = await queryPg<{ user_id: string; cnt: string }>(
    `SELECT g.user_id, COUNT(*)::text AS cnt
     FROM grades g
     INNER JOIN assignments a ON a.id = g.assignment_id
     WHERE a.group_subject_id = $1
     GROUP BY g.user_id`,
    [groupSubjectId]
  );
  const m = new Map<string, number>();
  for (const row of r.rows) {
    m.set(row.user_id, parseInt(row.cnt, 10) || 0);
  }
  return m;
}

async function nextAssignmentOrdinal(groupSubjectId: string): Promise<number> {
  const r = await queryPg<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM assignments WHERE group_subject_id = $1`,
    [groupSubjectId]
  );
  return (parseInt(r.rows[0]?.c ?? '0', 10) || 0) + 1;
}

/** Profesor del group_subject, o uno del mismo curso, o cualquier profesor de la institución (solo datos demo). */
function resolveProfessorUserId(
  gs: GroupSubjectSeedRow,
  teacherByGroupId: Map<string, string>,
  institutionProfessorId: string | null
): { userId: string; usedFallback: boolean } {
  if (gs.teacher_id) {
    return { userId: gs.teacher_id, usedFallback: false };
  }
  const fromGroup = teacherByGroupId.get(gs.group_id);
  if (fromGroup) {
    return { userId: fromGroup, usedFallback: true };
  }
  if (institutionProfessorId) {
    return { userId: institutionProfessorId, usedFallback: true };
  }
  return { userId: '', usedFallback: false };
}

async function loadTeacherByGroupMap(institutionId: string): Promise<Map<string, string>> {
  const r = await queryPg<{ group_id: string; teacher_id: string }>(
    `SELECT group_id, teacher_id FROM group_subjects
     WHERE institution_id = $1 AND teacher_id IS NOT NULL`,
    [institutionId]
  );
  const m = new Map<string, string>();
  for (const row of r.rows) {
    if (!m.has(row.group_id)) m.set(row.group_id, row.teacher_id);
  }
  return m;
}

async function loadAnyInstitutionProfessorId(institutionId: string): Promise<string | null> {
  const r = await queryPg<{ id: string }>(
    `SELECT id FROM users WHERE institution_id = $1 AND role = 'profesor' ORDER BY created_at LIMIT 1`,
    [institutionId]
  );
  return r.rows[0]?.id ?? null;
}

/** Quita asignaciones previas generadas por este script en la institución. */
async function deletePreviousSeedAssignments(institutionId: string): Promise<number> {
  const r = await queryPg<{ id: string }>(
    `DELETE FROM assignments a
     USING group_subjects gs
     WHERE a.group_subject_id = gs.id
       AND gs.institution_id = $1
       AND a.description = $2
     RETURNING a.id`,
    [institutionId, SEED_ASSIGNMENT_DESCRIPTION]
  );
  return r.rows.length;
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definido. Este seed solo aplica a PostgreSQL.');
  }

  const institutionId = (process.env.INSTITUTION_ID ?? DEFAULT_INSTITUTION).trim();
  const instCheck = await queryPg<{ id: string }>('SELECT id FROM institutions WHERE id = $1', [institutionId]);
  if (!instCheck.rows[0]) {
    throw new Error(`Institución no encontrada: ${institutionId}`);
  }

  const removed = await deletePreviousSeedAssignments(institutionId);
  console.log(`[seed] Eliminadas ${removed} asignación(es) previas del seed (descripción huella).`);

  const groupSubjects = await loadGroupSubjects(institutionId);
  const teacherByGroupId = await loadTeacherByGroupMap(institutionId);
  const institutionProfessorId = await loadAnyInstitutionProfessorId(institutionId);
  const usedYmdByGroup = await loadUsedDueDatesByGroup(institutionId);
  const dueRangeStart = firstDayOfMonthUTC(DUE_DATE_WINDOW_MONTHS_BACK);
  const dueRangeEnd = new Date();
  dueRangeEnd.setUTCHours(23, 59, 59, 999);
  console.log(`[seed] Institución ${institutionId}: ${groupSubjects.length} group_subjects`);
  console.log(
    `[seed] Ventana de fechas (UTC): ${toYmdUTC(dueRangeStart)} .. ${toYmdUTC(dueRangeEnd)}; máx. 1 entrega/día por curso`
  );

  let totalAssignments = 0;
  let totalGrades = 0;
  let skippedNoProfessor = 0;
  let skippedNoStudents = 0;
  let skippedSatisfied = 0;
  let usedFallbackProfessor = 0;

  for (const gs of groupSubjects) {
    const { userId: professorId, usedFallback } = resolveProfessorUserId(
      gs,
      teacherByGroupId,
      institutionProfessorId
    );
    if (!professorId) {
      skippedNoProfessor++;
      console.warn(`[seed] Sin profesor resoluble, se omite: ${gs.group_name} / ${gs.subject_name}`);
      continue;
    }

    const students = await studentIdsForGroup(gs.group_id, gs.institution_id);
    if (students.length === 0) {
      skippedNoStudents++;
      continue;
    }

    const counts = await gradeCountsByStudent(gs.id);
    const perStudent = students.map((sid) => counts.get(sid) ?? 0);
    const minGrades = Math.min(...perStudent);
    const need = Math.max(0, MIN_GRADES_PER_STUDENT - minGrades);

    if (need === 0) {
      skippedSatisfied++;
      continue;
    }

    if (usedFallback) usedFallbackProfessor++;

    let categoryId: string;
    try {
      categoryId = await ensureGradingCategoryId(gs.group_id, gs.institution_id);
    } catch (e) {
      console.error(`[seed] Esquema de calificación en ${gs.group_name} / ${gs.subject_name}:`, e);
      continue;
    }

    let ordinal = await nextAssignmentOrdinal(gs.id);

    for (let n = 0; n < need; n++) {
      const due = pickDueDateIsoForGroup(usedYmdByGroup, gs.group_id, dueRangeStart, dueRangeEnd);
      const title = `Evaluación de prueba ${ordinal} — ${gs.subject_name}`;
      const assignment = await createAssignment({
        group_subject_id: gs.id,
        title,
        description: SEED_ASSIGNMENT_DESCRIPTION,
        due_date: due,
        max_score: 100,
        assignment_category_id: categoryId,
        created_by: professorId,
        type: 'assignment',
        is_gradable: true,
        requires_submission: true,
        academic_term: 1,
      });

      totalAssignments++;

      for (const studentId of students) {
        const score = scoreForStudent(studentId, ordinal * 1000 + n);
        await upsertGrade({
          assignment_id: assignment.id,
          user_id: studentId,
          group_id: gs.group_id,
          grading_category_id: categoryId,
          score,
          max_score: 100,
          normalized_score: null,
          recorded_by_id: professorId,
        });
        totalGrades++;
      }

      ordinal++;
    }

    console.log(
      `[seed] ${gs.group_name} / ${gs.subject_name}: +${need} asignación(es), ${students.length} estudiantes c/u`
    );
  }

  console.log(
    `[seed] Listo. Asignaciones nuevas: ${totalAssignments}, calificaciones insertadas: ${totalGrades}. ` +
      `Materias con profesor sustituto (seed): ${usedFallbackProfessor}. ` +
      `Omisión: sin profesor=${skippedNoProfessor}, sin estudiantes=${skippedNoStudents}, ya ≥${MIN_GRADES_PER_STUDENT}=${skippedSatisfied}`
  );
}

run().catch((e) => {
  console.error('[seed] Error:', e);
  process.exit(1);
});
