/**
 * Acciones ejecutables del agente Kiwi.
 * Cada función recibe (institutionId, userId, params) y usa queryPg directamente.
 * Sin imports de openai.ts — sin dependencia circular.
 * NUNCA retorna full_name de estudiantes.
 */

import { queryPg } from '../config/db-pg.js';
import { getBoletinDataForStudent } from './boletinService.js';
import { findGroupSubjectsByTeacherWithDetails } from '../repositories/groupSubjectRepository.js';
import { findGroupSubjectById } from '../repositories/groupSubjectRepository.js';
import { createAssignment } from '../repositories/assignmentRepository.js';
import { createAnnouncement } from '../repositories/announcementRepository.js';
import { findSubjectById } from '../repositories/subjectRepository.js';
import { findEnrollmentsByGroup } from '../repositories/enrollmentRepository.js';
import { notify } from '../repositories/notificationRepository.js';
import { runAfterAssignmentCreatedPg } from './assignmentSideEffectsService.js';
import { findGuardianStudentsByGuardian } from '../repositories/guardianStudentRepository.js';
import { findProfessorScheduleByProfessor, findGroupScheduleByGroup } from '../repositories/scheduleRepository.js';
import { findEnrollmentsByStudent } from '../repositories/enrollmentRepository.js';
import { searchKnowledge } from './embeddingService.js';
import { triggerWorkflow, listAvailableWorkflows } from './workflowService.js';
import { generateEvoDocPDF } from './evoDocsRenderer.js';
import type { EvoDocData, EvoDocMetric, EvoDocSection, EvoDocChartBar, EvoDocChartLine } from './evoDocTemplate.js';

// ─── Tipos de retorno ─────────────────────────────────────────────────────────

export interface AnalyticsResult {
  institutionId: string;
  totalStudents: number;
  totalTeachers: number;
  totalGroups: number;
  attendancePercentage: number;
}

export interface AttendanceRow {
  groupName: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

export interface RiskRow {
  anonStudentId: string;
  groupName: string;
  average: number | null;
  subjectCount: number;
}

export interface ConfirmationPending {
  requiresConfirmation: true;
  preview: unknown;
}

export interface ComunicadoResult {
  success: true;
  announcementId: string;
  recipientCount: number;
}

export interface ListMyCoursesRow {
  courseId: string; // group_subject_id
  groupId: string;
  groupName: string;
  subjectId: string;
  subjectName: string;
  displayName?: string | null;
}

export type KiwiActionResult =
  | { success: true; data: unknown }
  | { success: false; error: string }
  | { success: false; requiresConfirmation: true; preview: unknown };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function anonStudentId(internalCode: string | null, studentId: string): string {
  if (internalCode && internalCode.trim()) return internalCode.trim();
  return 'EST-' + studentId.slice(0, 4).toUpperCase();
}

async function getUserEmail(userId: string): Promise<string | undefined> {
  try {
    const r = await queryPg<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
    const email = r.rows[0]?.email;
    return typeof email === 'string' && email.trim() ? email.trim() : undefined;
  } catch {
    return undefined;
  }
}

// ─── Profesor: list_my_courses ────────────────────────────────────────────────

async function listMyCourses(
  institutionId: string,
  userId: string,
  _params: Record<string, unknown>
): Promise<ListMyCoursesRow[]> {
  const gsList = await findGroupSubjectsByTeacherWithDetails(userId, institutionId);
  return gsList.map((gs) => ({
    courseId: gs.id,
    groupId: gs.group_id,
    groupName: gs.group_name,
    subjectId: gs.subject_id,
    subjectName: gs.subject_name,
    displayName: gs.display_name ?? null,
  }));
}

// ─── Profesor: create_assignment ──────────────────────────────────────────────

async function resolveCourseIdForTeacher(params: Record<string, unknown>, institutionId: string, teacherId: string): Promise<string> {
  const rawCourseId = typeof params.courseId === 'string' ? params.courseId.trim() : '';
  if (rawCourseId) return rawCourseId;

  const group = typeof params.group === 'string' ? params.group.trim() : '';
  const subject = typeof params.subject === 'string' ? params.subject.trim() : '';
  if (!group || !subject) {
    throw new Error('Para asignar una tarea necesito "courseId" o (group + subject).');
  }

  const r = await queryPg<{ id: string }>(
    `SELECT gs.id
     FROM group_subjects gs
     JOIN groups g ON g.id = gs.group_id
     JOIN subjects s ON s.id = gs.subject_id
     WHERE gs.institution_id = $1
       AND gs.teacher_id = $2
       AND UPPER(TRIM(g.name)) = UPPER(TRIM($3))
       AND (
         UPPER(TRIM(COALESCE(gs.display_name, s.name))) = UPPER(TRIM($4))
         OR UPPER(TRIM(s.name)) = UPPER(TRIM($4))
       )
     LIMIT 1`,
    [institutionId, teacherId, group, subject]
  );
  const id = r.rows[0]?.id;
  if (!id) {
    throw new Error(`No encontré un courseId para ${group} - ${subject} que esté asignado a ti.`);
  }
  return id;
}

async function createTeacherAssignment(
  institutionId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<ConfirmationPending | { success: true; assignmentId: string }> {
  const title = String(params.title ?? '').trim();
  const description = String(params.description ?? '').trim() || title;
  const dueDateRaw = String(params.dueDate ?? '').trim();
  if (!title || !description || !dueDateRaw) {
    throw new Error('Faltan campos obligatorios: title, description, dueDate.');
  }

  const due = new Date(dueDateRaw);
  if (Number.isNaN(due.getTime())) {
    throw new Error('dueDate no es una fecha válida.');
  }
  const dueIso = due.toISOString();

  const courseId = await resolveCourseIdForTeacher(params, institutionId, userId);
  const gs = await findGroupSubjectById(courseId);
  if (!gs || gs.institution_id !== institutionId) {
    throw new Error('No tienes acceso a ese courseId.');
  }
  if (gs.teacher_id !== userId) {
    throw new Error('No tienes permiso para crear tareas en ese curso.');
  }

  const requiresSubmission = typeof params.requiresSubmission === 'boolean' ? params.requiresSubmission : true;
  const trimestre = Number(params.trimestre ?? 1);
  const academic_term = trimestre === 1 || trimestre === 2 || trimestre === 3 ? trimestre : 1;

  const rawWeight = params.categoryWeightPct;
  let category_weight_pct: number | null = null;
  if (rawWeight != null && rawWeight !== '') {
    const w = Number(rawWeight);
    if (!Number.isNaN(w) && w > 0 && w <= 100) category_weight_pct = w;
  }

  const categoryId =
    typeof params.categoryId === 'string' && params.categoryId.trim() ? params.categoryId.trim() : null;

  // Guard: requiere confirmación explícita antes de escribir
  if (!params.confirmed) {
    return {
      requiresConfirmation: true,
      preview: {
        tool: 'create_assignment',
        params: {
          title,
          description,
          dueDate: dueIso,
          courseId,
          requiresSubmission,
          trimestre: academic_term,
          categoryId,
          categoryWeightPct: category_weight_pct,
        },
      },
    };
  }

  // Crear assignment (PG)
  let created;
  try {
    created = await createAssignment({
      group_subject_id: courseId,
      title,
      description,
      content_document: null,
      due_date: dueIso,
      created_by: userId,
      type: 'assignment',
      is_gradable: requiresSubmission,
      requires_submission: requiresSubmission,
      assignment_category_id: categoryId,
      category_weight_pct,
      academic_term,
    });
  } catch (first: unknown) {
    const err = first as { code?: string; detail?: string; message?: string };
    // FK de categoría puede fallar → reintentar sin categoría
    if (err.code === '23503' && categoryId) {
      created = await createAssignment({
        group_subject_id: courseId,
        title,
        description,
        content_document: null,
        due_date: dueIso,
        created_by: userId,
        type: 'assignment',
        is_gradable: requiresSubmission,
        requires_submission: requiresSubmission,
        assignment_category_id: null,
        category_weight_pct,
        academic_term,
      });
    } else {
      throw first;
    }
  }

  // Crear anuncio académico (best-effort)
  createAnnouncement({
    institution_id: gs.institution_id,
    title: `Nueva tarea: ${title}`,
    body: description.slice(0, 500) || null,
    type: 'nueva_asignacion',
    group_id: gs.group_id,
    group_subject_id: courseId,
    assignment_id: created.id,
    created_by_id: userId,
  }).catch(() => {});

  // Side-effects (Drive / etc) best-effort
  void runAfterAssignmentCreatedPg({
    assignmentId: created.id,
    groupSubjectId: courseId,
    groupId: gs.group_id,
    institutionId: gs.institution_id,
    teacherId: userId,
    title,
    description,
    dueDateIso: created.due_date,
    adjuntosFromBody: undefined,
  });

  // Notificar estudiantes del grupo (best-effort)
  try {
    const enrollments = await findEnrollmentsByGroup(gs.group_id);
    const studentIds = enrollments.map((e) => e.student_id);
    const subject = await findSubjectById(gs.subject_id);
    const materia = (gs.display_name?.trim() || subject?.name || 'Materia').trim();
    const dueLabel = new Date(created.due_date).toLocaleString('es-CO');
    await Promise.all(
      studentIds.map(async (sid) => {
        const email = await getUserEmail(sid);
        await notify({
          institution_id: gs.institution_id,
          user_id: sid,
          user_email: email,
          type: 'nueva_tarea',
          entity_type: 'assignment',
          entity_id: created.id,
          action_url: `/assignment/${created.id}`,
          title: `Nueva tarea: ${created.title}`,
          body: `Tienes una nueva tarea en ${materia} con vencimiento ${dueLabel}`,
        });
      })
    );
  } catch {
    // ignore
  }

  return { success: true, assignmentId: created.id };
}

// ─── Función 1: getInstitutionAnalytics ──────────────────────────────────────

async function getInstitutionAnalytics(
  institutionId: string,
  _userId: string,
  _params: Record<string, unknown>
): Promise<AnalyticsResult> {
  const [students, teachers, groups, att] = await Promise.all([
    queryPg<{ count: string }>(
      `SELECT COUNT(DISTINCT e.student_id) AS count
       FROM enrollments e
       JOIN academic_periods ap ON ap.id = e.academic_period_id
       WHERE ap.institution_id = $1 AND ap.is_active = true`,
      [institutionId]
    ),
    queryPg<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM users
       WHERE institution_id = $1 AND role = 'profesor' AND status = 'active'`,
      [institutionId]
    ),
    queryPg<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM groups
       WHERE institution_id = $1`,
      [institutionId]
    ),
    queryPg<{ present: string; total: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE a.status = 'present') AS present,
         COUNT(*) AS total
       FROM attendance a
       JOIN group_subjects gs ON gs.id = a.group_subject_id
       WHERE gs.institution_id = $1
         AND a.date >= COALESCE(
           (SELECT start_date FROM academic_periods
            WHERE institution_id = $1 AND is_active = true
            ORDER BY start_date DESC LIMIT 1),
           CURRENT_DATE - INTERVAL '6 months'
         )`,
      [institutionId]
    ),
  ]);

  const present = toNumber(att.rows[0]?.present);
  const total = toNumber(att.rows[0]?.total);
  const attendancePercentage = total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0;

  return {
    institutionId,
    totalStudents: toNumber(students.rows[0]?.count),
    totalTeachers: toNumber(teachers.rows[0]?.count),
    totalGroups: toNumber(groups.rows[0]?.count),
    attendancePercentage,
  };
}

// ─── Función 2: getAttendanceReport ──────────────────────────────────────────

async function getAttendanceReport(
  institutionId: string,
  _userId: string,
  params: Record<string, unknown>
): Promise<AttendanceRow[]> {
  const groupId = params.groupId as string | undefined;
  const startDate = params.startDate as string | null ?? null;
  const endDate = params.endDate as string | null ?? null;

  let rows: Array<{ group_name: string; present: string; absent: string; total: string }>;

  if (groupId) {
    const r = await queryPg<{ group_name: string; present: string; absent: string; total: string }>(
      `SELECT
         g.name AS group_name,
         COUNT(*) FILTER (WHERE a.status = 'present') AS present,
         COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent,
         COUNT(*) AS total
       FROM attendance a
       JOIN group_subjects gs ON gs.id = a.group_subject_id
       JOIN groups g ON g.id = gs.group_id
       WHERE gs.institution_id = $1
         AND gs.group_id = $2
         AND ($3::date IS NULL OR a.date >= $3::date)
         AND ($4::date IS NULL OR a.date <= $4::date)
       GROUP BY g.name`,
      [institutionId, groupId, startDate, endDate]
    );
    rows = r.rows;
  } else {
    const r = await queryPg<{ group_name: string; present: string; absent: string; total: string }>(
      `SELECT
         g.name AS group_name,
         COUNT(*) FILTER (WHERE a.status = 'present') AS present,
         COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent,
         COUNT(*) AS total
       FROM attendance a
       JOIN group_subjects gs ON gs.id = a.group_subject_id
       JOIN groups g ON g.id = gs.group_id
       WHERE gs.institution_id = $1
         AND ($2::date IS NULL OR a.date >= $2::date)
         AND ($3::date IS NULL OR a.date <= $3::date)
       GROUP BY g.id, g.name
       ORDER BY g.name
       LIMIT 20`,
      [institutionId, startDate, endDate]
    );
    rows = r.rows;
  }

  return rows.map((row) => {
    const present = toNumber(row.present);
    const absent = toNumber(row.absent);
    const total = toNumber(row.total);
    const percentage = total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0;
    return { groupName: row.group_name, present, absent, total, percentage };
  });
}

// ─── Función 3: getAcademicRiskReport ────────────────────────────────────────

async function getAcademicRiskReport(
  institutionId: string,
  _userId: string,
  params: Record<string, unknown>
): Promise<RiskRow[]> {
  const threshold = toNumber(params.threshold, 60);

  const r = await queryPg<{
    internal_code: string | null;
    student_id: string;
    group_name: string;
    average: string | null;
    subject_count: string;
  }>(
    `SELECT
       u.internal_code,
       u.id AS student_id,
       g.name AS group_name,
       AVG(gr.normalized_score) AS average,
       COUNT(DISTINCT gr.assignment_id) AS subject_count
     FROM grades gr
     JOIN users u ON u.id = gr.user_id
     JOIN groups g ON g.id = gr.group_id
     JOIN enrollments e ON e.student_id = u.id AND e.group_id = g.id
     WHERE g.institution_id = $1
       AND u.institution_id = $1
     GROUP BY u.id, u.internal_code, g.name
     HAVING AVG(gr.normalized_score) < $2
     ORDER BY average ASC NULLS LAST
     LIMIT 50`,
    [institutionId, threshold]
  );

  return r.rows.map((row: { internal_code: string | null; student_id: string; group_name: string; average: string | null; subject_count: string }) => ({
    anonStudentId: anonStudentId(row.internal_code, row.student_id),
    groupName: row.group_name,
    average: row.average !== null ? Math.round(toNumber(row.average) * 10) / 10 : null,
    subjectCount: toNumber(row.subject_count),
  }));
}

// ─── Función 4: createInstitutionalComunicado ─────────────────────────────────

async function createInstitutionalComunicado(
  institutionId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<ConfirmationPending | ComunicadoResult> {
  const title = params.title as string;
  const content = params.content as string;
  const targetAudience = (params.targetAudience as string) || 'all';

  // Guard: requiere confirmación explícita antes de escribir
  if (!params.confirmed) {
    return {
      requiresConfirmation: true,
      preview: { title, content, targetAudience },
    };
  }

  // INSERT en announcements
  const annResult = await queryPg<{ id: string }>(
    `INSERT INTO announcements
       (institution_id, title, body, type, created_by_id, published_at, status, audience)
     VALUES ($1, $2, $3, 'institutional', $4, now(), 'sent', $5)
     RETURNING id`,
    [institutionId, title, content, userId, targetAudience]
  );

  const announcementId = annResult.rows[0].id;

  // INSERT masivo en announcement_recipients
  const recipResult = await queryPg<{ count: string }>(
    `WITH inserted AS (
       INSERT INTO announcement_recipients (announcement_id, user_id)
       SELECT $1, id FROM users
       WHERE institution_id = $2
         AND status = 'active'
         AND (
           $3 = 'all'
           OR (role = 'padre'    AND $3 = 'parents')
           OR (role = 'profesor' AND $3 = 'teachers')
         )
       ON CONFLICT DO NOTHING
       RETURNING user_id
     )
     SELECT COUNT(*) AS count FROM inserted`,
    [announcementId, institutionId, targetAudience]
  );

  return {
    success: true,
    announcementId,
    recipientCount: toNumber(recipResult.rows[0]?.count),
  };
}

// ─── Función 5: sendEvoSendMessage ───────────────────────────────────────────

interface EvoSendResult {
  success: true;
  messageId: string;
}

async function sendEvoSendMessage(
  institutionId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<{ requiresConfirmation: true; preview: unknown } | EvoSendResult> {
  const channelId = params.channelId as string;
  const message = params.message as string;
  const userRole = (params.userRole as string | undefined) ?? undefined;
  const isDirectorLike = userRole === 'directivo' || userRole === 'admin-general-colegio' || userRole === 'school_admin';

  // Step 1: verificar que el thread pertenece a la institución
  const threadRes = await queryPg<{ type: string }>(
    `SELECT type FROM announcements WHERE id = $1 AND institution_id = $2 LIMIT 1`,
    [channelId, institutionId]
  );
  if (!threadRes.rows[0]) {
    throw new Error('No tienes acceso a ese canal');
  }
  const threadType = threadRes.rows[0].type;

  // Step 2: para tipos no-grupales, verificar membresía explícita en recipients
  if (threadType !== 'evo_chat') {
    // Directivo/school_admin: puede escribir en hilos staff/direct de su institución
    if (isDirectorLike && (threadType === 'evo_chat_staff' || threadType === 'evo_chat_direct')) {
      // ok
    } else {
    const memberRes = await queryPg<{ n: number }>(
      `SELECT 1 AS n FROM announcement_recipients WHERE announcement_id = $1 AND user_id = $2 LIMIT 1`,
      [channelId, userId]
    );
    if (!memberRes.rows[0]) {
      throw new Error('No tienes acceso a ese canal');
    }
    }
  } else {
    // evo_chat: permitir a directivo/school_admin escribir; otros roles deben ser participantes implícitos (grupo/profe/estudiante)
    if (!isDirectorLike) {
      const annRes = await queryPg<{ group_id: string | null; group_subject_id: string | null; created_by_id: string }>(
        `SELECT group_id, group_subject_id, created_by_id FROM announcements WHERE id = $1 AND institution_id = $2 LIMIT 1`,
        [channelId, institutionId]
      );
      const ann = annRes.rows[0];
      if (!ann?.group_id) {
        throw new Error('No tienes acceso a ese canal');
      }

      // estudiantes del grupo o creador (profe) pueden escribir
      const [enr, creator] = await Promise.all([
        queryPg<{ n: number }>(`SELECT 1 AS n FROM enrollments WHERE group_id = $1 AND student_id = $2 LIMIT 1`, [
          ann.group_id,
          userId,
        ]),
        queryPg<{ n: number }>(`SELECT 1 AS n WHERE $1::uuid = $2::uuid`, [userId, ann.created_by_id]),
      ]);
      if (enr.rows.length === 0 && creator.rows.length === 0) {
        throw new Error('No tienes acceso a ese canal');
      }
    }
  }

  // Step 3: guard de confirmación
  if (!params.confirmed) {
    return { requiresConfirmation: true, preview: { channelId, message, threadType } };
  }

  // Step 4: obtener rol del sender para el INSERT
  const senderRes = await queryPg<{ full_name: string; role: string }>(
    `SELECT full_name, role FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const sender = senderRes.rows[0];
  const senderRole = sender?.role ?? 'directivo';
  const senderName = sender?.full_name ?? '';

  // Step 5: INSERT del mensaje
  const msgRes = await queryPg<{ id: string; content: string; content_type: string; priority: string; created_at: string }>(
    `INSERT INTO announcement_messages
       (announcement_id, sender_id, sender_role, content, content_type, priority)
     VALUES ($1, $2, $3, $4, 'texto', 'normal')
     RETURNING id, content, content_type, priority, created_at`,
    [channelId, userId, senderRole, message]
  );
  const msg = msgRes.rows[0];

  // Step 6: obtener participantes para el emit en tiempo real
  let participantIds: string[] = [];
  if (threadType === 'evo_chat') {
    const annRes = await queryPg<{ group_id: string | null; created_by_id: string }>(
      `SELECT group_id, created_by_id FROM announcements WHERE id = $1 LIMIT 1`,
      [channelId]
    );
    const ann = annRes.rows[0];
    if (ann?.group_id) {
      const studentsRes = await queryPg<{ student_id: string }>(
        `SELECT student_id FROM enrollments WHERE group_id = $1`,
        [ann.group_id]
      );
      participantIds = studentsRes.rows.map((r: { student_id: string }) => r.student_id);
    }
    if (ann?.created_by_id) participantIds.push(ann.created_by_id);
  } else {
    const recipRes = await queryPg<{ user_id: string }>(
      `SELECT user_id FROM announcement_recipients WHERE announcement_id = $1`,
      [channelId]
    );
    participantIds = recipRes.rows.map((r: { user_id: string }) => r.user_id);
  }
  // asegurar que el sender esté en la lista
  if (!participantIds.includes(userId)) participantIds.push(userId);

  // Step 7: emit Socket.IO — import lazy para evitar circular con socket.ts
  try {
    const { emitEvoMessageBroadcast } = await import('../socket.js');
    emitEvoMessageBroadcast(
      channelId,
      {
        _id: msg.id,
        contenido: msg.content,
        tipo: msg.content_type,
        prioridad: msg.priority,
        fecha: msg.created_at,
        remitenteId: { _id: userId, nombre: senderName, rol: senderRole },
        rolRemitente: senderRole,
      },
      participantIds
    );
  } catch {
    // El emit es best-effort — si falla el socket, el mensaje ya quedó guardado
  }

  return { success: true, messageId: msg.id };
}

// ─── Función 6: generateBoletin ───────────────────────────────────────────────

interface BoletinPreview {
  requiresConfirmation: true;
  preview: {
    scope: string;
    groupName?: string;
    studentCount: number;
    estimatedMinutes: number;
  };
}

interface BoletinGenerated {
  success: true;
  boletinesGenerados: number;
  processing?: boolean;
  message?: string;
}

async function generateBoletin(
  institutionId: string,
  _userId: string,
  params: Record<string, unknown>
): Promise<BoletinPreview | BoletinGenerated> {
  const scope = (params.scope as string) || 'group';
  const groupId = params.groupId as string | undefined;

  // Step 1: contar estudiantes del scope
  let studentCount = 0;
  let groupName: string | undefined;

  if (scope === 'group' && groupId) {
    const [countRes, nameRes] = await Promise.all([
      queryPg<{ count: string }>(
        `SELECT COUNT(*) AS count FROM enrollments WHERE group_id = $1`,
        [groupId]
      ),
      queryPg<{ name: string }>(
        `SELECT name FROM groups WHERE id = $1 AND institution_id = $2 LIMIT 1`,
        [groupId, institutionId]
      ),
    ]);
    studentCount = toNumber(countRes.rows[0]?.count);
    groupName = nameRes.rows[0]?.name;
  } else {
    const countRes = await queryPg<{ count: string }>(
      `SELECT COUNT(DISTINCT e.student_id) AS count
       FROM enrollments e
       JOIN groups g ON g.id = e.group_id
       WHERE g.institution_id = $1
         AND e.academic_period_id = (
           SELECT id FROM academic_periods
           WHERE institution_id = $1 AND is_active = true
           ORDER BY start_date DESC LIMIT 1
         )`,
      [institutionId]
    );
    studentCount = toNumber(countRes.rows[0]?.count);
  }

  // Step 2: guard de confirmación
  if (!params.confirmed) {
    return {
      requiresConfirmation: true,
      preview: {
        scope,
        groupName,
        studentCount,
        estimatedMinutes: Math.ceil(studentCount / 5),
      },
    };
  }

  // Step 3: obtener lista de (studentId, groupId) del scope
  let students: Array<{ student_id: string; group_id: string }> = [];

  if (scope === 'group' && groupId) {
    const r = await queryPg<{ student_id: string }>(
      `SELECT student_id FROM enrollments WHERE group_id = $1`,
      [groupId]
    );
    students = r.rows.map((row: { student_id: string }) => ({ student_id: row.student_id, group_id: groupId! }));
  } else {
    const r = await queryPg<{ student_id: string; group_id: string }>(
      `SELECT DISTINCT e.student_id, e.group_id
       FROM enrollments e
       JOIN groups g ON g.id = e.group_id
       WHERE g.institution_id = $1
         AND e.academic_period_id = (
           SELECT id FROM academic_periods
           WHERE institution_id = $1 AND is_active = true
           ORDER BY start_date DESC LIMIT 1
         )`,
      [institutionId]
    );
    students = r.rows;
  }

  // Step 4: generar boletines
  if (students.length <= 30) {
    // Serie — esperar resultado completo
    let count = 0;
    for (const s of students) {
      const data = await getBoletinDataForStudent(s.student_id, s.group_id, institutionId, true);
      if (data) count++;
    }
    return { success: true, boletinesGenerados: count };
  } else {
    // Background — no bloquear al directivo
    const total = students.length;
    Promise.allSettled(
      students.map((s) =>
        getBoletinDataForStudent(s.student_id, s.group_id, institutionId, true)
      )
    ).catch((e) => console.error('[kiwiActions] generateBoletin background error:', e));

    return {
      success: true,
      boletinesGenerados: 0,
      processing: true,
      message: `Generando ${total} boletines en segundo plano. Estará listo en aproximadamente ${Math.ceil(total / 5)} minutos.`,
    };
  }
}

// ─── Estudiante: get_my_grades ────────────────────────────────────────────────

interface StudentGradeRow {
  subjectName: string;
  groupName: string;
  assignmentTitle: string;
  score: number | null;
  maxScore: number;
  date: string;
}

async function getMyGrades(
  institutionId: string,
  userId: string,
  _params: Record<string, unknown>
): Promise<StudentGradeRow[]> {
  const r = await queryPg<{
    subject_name: string;
    group_name: string;
    assignment_title: string;
    score: string | null;
    max_score: string;
    graded_at: string;
  }>(
    `SELECT COALESCE(gs.display_name, s.name) AS subject_name,
            g.name AS group_name,
            a.title AS assignment_title,
            gr.score::text,
            COALESCE(a.max_score, 100)::text AS max_score,
            COALESCE(gr.recorded_at, a.due_date)::text AS graded_at
     FROM grades gr
     JOIN assignments a ON a.id = gr.assignment_id
     JOIN group_subjects gs ON gs.id = a.group_subject_id
     JOIN subjects s ON s.id = gs.subject_id
     JOIN groups g ON g.id = gs.group_id
     WHERE gr.user_id = $1
       AND gs.institution_id = $2
     ORDER BY gr.recorded_at DESC NULLS LAST
     LIMIT 50`,
    [userId, institutionId]
  );

  return r.rows.map((row: { subject_name: string; group_name: string; assignment_title: string; score: string | null; max_score: string; graded_at: string }) => ({
    subjectName: row.subject_name,
    groupName: row.group_name,
    assignmentTitle: row.assignment_title,
    score: row.score !== null ? toNumber(row.score) : null,
    maxScore: toNumber(row.max_score, 100),
    date: row.graded_at,
  }));
}

// ─── Estudiante: get_my_attendance ────────────────────────────────────────────

interface StudentAttendanceRow {
  date: string;
  subjectName: string;
  status: string;
  periodSlot: string | null;
}

async function getMyAttendance(
  institutionId: string,
  userId: string,
  _params: Record<string, unknown>
): Promise<StudentAttendanceRow[]> {
  const r = await queryPg<{
    date: string;
    subject_name: string;
    status: string;
    period_slot: string | null;
  }>(
    `SELECT a.date::text, COALESCE(gs.display_name, s.name) AS subject_name,
            a.status, a.period_slot
     FROM attendance a
     JOIN group_subjects gs ON gs.id = a.group_subject_id
     JOIN subjects s ON s.id = gs.subject_id
     WHERE a.user_id = $1 AND gs.institution_id = $2
     ORDER BY a.date DESC
     LIMIT 60`,
    [userId, institutionId]
  );

  return r.rows.map((row: { date: string; subject_name: string; status: string; period_slot: string | null }) => ({
    date: row.date,
    subjectName: row.subject_name,
    status: row.status,
    periodSlot: row.period_slot,
  }));
}

// ─── Estudiante: get_pending_tasks ────────────────────────────────────────────

interface StudentTaskRow {
  assignmentId: string;
  title: string;
  subjectName: string;
  groupName: string;
  dueDate: string;
  status: string;
  score: number | null;
}

async function getPendingTasks(
  institutionId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<StudentTaskRow[]> {
  const statusFilter = typeof params.status === 'string' ? params.status.trim().toLowerCase() : '';

  const r = await queryPg<{
    id: string;
    title: string;
    subject_name: string;
    group_name: string;
    due_date: string;
    submission_id: string | null;
    score: string | null;
  }>(
    `SELECT a.id, a.title,
            COALESCE(gs.display_name, s.name) AS subject_name,
            g.name AS group_name,
            a.due_date::text,
            sub.id AS submission_id,
            gr.score::text
     FROM assignments a
     JOIN group_subjects gs ON gs.id = a.group_subject_id
     JOIN subjects s ON s.id = gs.subject_id
     JOIN groups g ON g.id = gs.group_id
     JOIN enrollments e ON e.group_id = g.id AND e.student_id = $1
     LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = $1
     LEFT JOIN grades gr ON gr.assignment_id = a.id AND gr.user_id = $1
     WHERE gs.institution_id = $2
     ORDER BY a.due_date ASC NULLS LAST
     LIMIT 50`,
    [userId, institutionId]
  );

  const tasks = r.rows.map((row: { id: string; title: string; subject_name: string; group_name: string; due_date: string; submission_id: string | null; score: string | null }) => {
    let status = 'pendiente';
    if (row.score !== null) status = 'calificada';
    else if (row.submission_id) status = 'entregada';
    return {
      assignmentId: row.id,
      title: row.title,
      subjectName: row.subject_name,
      groupName: row.group_name,
      dueDate: row.due_date,
      status,
      score: row.score !== null ? toNumber(row.score) : null,
    };
  });

  if (statusFilter) {
    return tasks.filter((t: StudentTaskRow) => t.status === statusFilter);
  }
  return tasks;
}

// ─── Shared: get_my_schedule ──────────────────────────────────────────────────

interface ScheduleResult {
  type: 'professor' | 'student';
  slots: Record<string, string>;
}

async function getMySchedule(
  institutionId: string,
  userId: string,
  userRole: string,
  _params: Record<string, unknown>
): Promise<ScheduleResult | null> {
  if (userRole === 'profesor') {
    const schedule = await findProfessorScheduleByProfessor(institutionId, userId);
    if (schedule) return { type: 'professor', slots: schedule.slots };
    return null;
  }

  // For students: find their enrolled group and get group schedule
  const enrollments = await findEnrollmentsByStudent(userId);
  if (enrollments.length === 0) return null;

  const groupId = enrollments[0].group_id;
  const schedule = await findGroupScheduleByGroup(institutionId, groupId);
  if (schedule) return { type: 'student', slots: schedule.slots };
  return null;
}

// ─── Padre: get_child_grades ──────────────────────────────────────────────────

async function resolveChildId(
  institutionId: string,
  guardianId: string,
  params: Record<string, unknown>
): Promise<string> {
  const childId = typeof params.childId === 'string' ? params.childId.trim() : '';
  if (childId) return childId;

  const links = await findGuardianStudentsByGuardian(guardianId);
  const filtered = links.filter((l) => l.institution_id === institutionId);
  if (filtered.length === 0) {
    throw new Error('No tienes hijos registrados en esta institución.');
  }
  if (filtered.length === 1) return filtered[0].student_id;
  throw new Error(
    `Tienes ${filtered.length} hijos registrados. Indica cuál quieres consultar.`
  );
}

async function getChildGrades(
  institutionId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<StudentGradeRow[]> {
  const childId = await resolveChildId(institutionId, userId, params);
  return getMyGrades(institutionId, childId, params);
}

// ─── Padre: get_child_attendance ──────────────────────────────────────────────

async function getChildAttendance(
  institutionId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<StudentAttendanceRow[]> {
  const childId = await resolveChildId(institutionId, userId, params);
  return getMyAttendance(institutionId, childId, params);
}

// ─── Padre: get_comunicados ───────────────────────────────────────────────────

interface ComunicadoRow {
  id: string;
  title: string;
  type: string;
  publishedAt: string;
  bodyPreview: string;
}

async function getComunicados(
  institutionId: string,
  userId: string,
  _params: Record<string, unknown>
): Promise<ComunicadoRow[]> {
  const r = await queryPg<{
    id: string;
    title: string;
    type: string;
    published_at: string;
    body: string | null;
  }>(
    `SELECT a.id, a.title, a.type, a.published_at::text, a.body
     FROM announcements a
     JOIN announcement_recipients ar ON ar.announcement_id = a.id
     WHERE ar.user_id = $1
       AND a.institution_id = $2
       AND a.status = 'sent'
     ORDER BY a.published_at DESC NULLS LAST
     LIMIT 20`,
    [userId, institutionId]
  );

  return r.rows.map((row: { id: string; title: string; type: string; published_at: string; body: string | null }) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    publishedAt: row.published_at,
    bodyPreview: (row.body ?? '').slice(0, 200),
  }));
}

// ─── Padre: contact_teacher ───────────────────────────────────────────────────

interface ContactTeacherResult {
  message: string;
  suggestedChannels: Array<{ channelId: string; teacherName: string; subjectName: string }>;
}

async function contactTeacher(
  institutionId: string,
  userId: string,
  _params: Record<string, unknown>
): Promise<ContactTeacherResult> {
  const links = await findGuardianStudentsByGuardian(userId);
  const filtered = links.filter((l) => l.institution_id === institutionId);
  if (filtered.length === 0) {
    return { message: 'No tienes hijos registrados.', suggestedChannels: [] };
  }

  const studentIds = filtered.map((l) => l.student_id);
  const r = await queryPg<{
    channel_id: string;
    teacher_name: string;
    subject_name: string;
  }>(
    `SELECT DISTINCT ON (gs.teacher_id)
            a.id AS channel_id,
            COALESCE(NULLIF(TRIM(u.full_name), ''), u.email) AS teacher_name,
            COALESCE(gs.display_name, s.name) AS subject_name
     FROM enrollments e
     JOIN group_subjects gs ON gs.group_id = e.group_id AND gs.institution_id = $1
     JOIN subjects s ON s.id = gs.subject_id
     JOIN users u ON u.id = gs.teacher_id
     LEFT JOIN announcements a ON a.group_subject_id = gs.id
       AND a.institution_id = $1
       AND a.type IN ('comunicado_padres', 'evo_chat')
     WHERE e.student_id = ANY($2::uuid[])
       AND gs.teacher_id IS NOT NULL
     ORDER BY gs.teacher_id, a.published_at DESC NULLS LAST
     LIMIT 10`,
    [institutionId, studentIds]
  );

  return {
    message: r.rows.length > 0
      ? 'Estos son los profesores disponibles. Puedes enviarles un mensaje desde EvoSend.'
      : 'No se encontraron profesores vinculados a tus hijos.',
    suggestedChannels: r.rows.map((row: { channel_id: string | null; teacher_name: string; subject_name: string }) => ({
      channelId: row.channel_id ?? '',
      teacherName: row.teacher_name,
      subjectName: row.subject_name,
    })),
  };
}

// ─── Estudiante: list_my_courses (student version) ────────────────────────────

async function listStudentCourses(
  institutionId: string,
  userId: string,
  _params: Record<string, unknown>
): Promise<Array<{ groupId: string; groupName: string; subjectName: string }>> {
  const r = await queryPg<{
    group_id: string;
    group_name: string;
    subject_name: string;
  }>(
    `SELECT DISTINCT g.id AS group_id, g.name AS group_name,
            COALESCE(gs.display_name, s.name) AS subject_name
     FROM enrollments e
     JOIN groups g ON g.id = e.group_id
     JOIN group_subjects gs ON gs.group_id = g.id AND gs.institution_id = $1
     JOIN subjects s ON s.id = gs.subject_id
     WHERE e.student_id = $2
     ORDER BY g.name, subject_name`,
    [institutionId, userId]
  );
  return r.rows.map((row: { group_id: string; group_name: string; subject_name: string }) => ({
    groupId: row.group_id,
    groupName: row.group_name,
    subjectName: row.subject_name,
  }));
}

// ─── Evo Docs: generate_evo_doc ───────────────────────────────────────────────

async function getInstitutionName(institutionId: string): Promise<string> {
  try {
    const r = await queryPg<{ name: string }>('SELECT name FROM institutions WHERE id = $1', [institutionId]);
    return r.rows[0]?.name ?? 'Colegio EVO';
  } catch { return 'Colegio EVO'; }
}

async function generateEvoDoc(
  institutionId: string,
  userId: string,
  userRole: string,
  params: Record<string, unknown>
): Promise<{ __type: string; title: string; description: string; period: string; url: string; docId: string }> {
  const title = String(params.title ?? 'Analisis Academico').trim();
  const docType = String(params.docType ?? 'student_analysis').trim();
  const subjectName = String(params.subjectName ?? '').trim();
  const period = String(params.period ?? new Date().getFullYear().toString()).trim();
  const subjectId = typeof params.subjectId === 'string' ? params.subjectId.trim() : undefined;

  const institutionName = await getInstitutionName(institutionId);
  const dateStr = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  const metrics: EvoDocMetric[] = [];
  const sections: EvoDocSection[] = [];
  const recommendations: string[] = [];

  if (docType === 'student_analysis') {
    const targetId = subjectId || (userRole === 'padre' ? await resolveChildId(institutionId, userId, params).catch(() => userId) : userId);

    const grades = await getMyGrades(institutionId, targetId, {});
    const attendance = await getMyAttendance(institutionId, targetId, {});
    const tasks = await getPendingTasks(institutionId, targetId, {});

    const totalGrades = grades.length;
    const avgScore = totalGrades > 0 ? grades.reduce((s, g) => s + (g.score ?? 0), 0) / totalGrades : 0;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const attPct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;
    const completedTasks = tasks.filter(t => t.status === 'calificada' || t.status === 'entregada').length;
    const taskPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    const subjectMap = new Map<string, { scores: number[]; name: string }>();
    for (const g of grades) {
      const entry = subjectMap.get(g.subjectName) ?? { scores: [], name: g.subjectName };
      if (g.score !== null) entry.scores.push(g.score);
      subjectMap.set(g.subjectName, entry);
    }
    const subjectAvgs = Array.from(subjectMap.entries()).map(([name, d]) => ({
      name,
      avg: d.scores.length > 0 ? d.scores.reduce((a, b) => a + b, 0) / d.scores.length : 0,
    }));
    const riskSubjects = subjectAvgs.filter(s => s.avg < 3.0).length;

    metrics.push(
      { label: 'Promedio general', value: avgScore.toFixed(1), status: avgScore >= 4.0 ? 'good' : avgScore >= 3.0 ? 'warning' : 'critical' },
      { label: 'Asistencia', value: `${attPct}%`, status: attPct >= 90 ? 'good' : attPct >= 75 ? 'warning' : 'critical' },
      { label: 'Materias en riesgo', value: String(riskSubjects), status: riskSubjects === 0 ? 'good' : riskSubjects <= 2 ? 'warning' : 'critical' },
      { label: 'Tareas completadas', value: `${taskPct}%`, status: taskPct >= 80 ? 'good' : taskPct >= 60 ? 'warning' : 'critical' },
    );

    const barData: EvoDocChartBar[] = subjectAvgs.slice(0, 8).map(s => ({
      label: s.name.length > 6 ? s.name.slice(0, 6) : s.name,
      value: s.avg,
      maxValue: 5,
    }));

    sections.push({
      title: 'Rendimiento Academico por Materia',
      narrative: `El estudiante presenta un promedio general de ${avgScore.toFixed(1)} con ${riskSubjects} materia(s) en riesgo. La asistencia es del ${attPct}% y ha completado ${taskPct}% de las tareas asignadas.`,
      chartType: 'bar',
      chartData: barData,
    });

    if (grades.length >= 3) {
      const sorted = [...grades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const monthMap = new Map<string, number[]>();
      for (const g of sorted) {
        if (g.score === null) continue;
        const month = new Date(g.date).toLocaleString('es-CO', { month: 'short' });
        const arr = monthMap.get(month) ?? [];
        arr.push(g.score);
        monthMap.set(month, arr);
      }
      const lineData: EvoDocChartLine[] = Array.from(monthMap.entries()).map(([label, scores]) => ({
        label,
        value: scores.reduce((a, b) => a + b, 0) / scores.length,
      }));

      if (lineData.length >= 2) {
        sections.push({
          title: 'Evolucion del Promedio Mensual',
          narrative: 'La trayectoria academica muestra la evolucion del promedio a lo largo del periodo.',
          chartType: 'line',
          chartData: lineData,
        });
      }
    }

    if (riskSubjects > 0) {
      const riskNames = subjectAvgs.filter(s => s.avg < 3.0).map(s => s.name);
      recommendations.push(`Implementar sesiones de refuerzo en ${riskNames.join(', ')}.`);
    }
    if (attPct < 90) recommendations.push('Mejorar la asistencia para mantener un seguimiento academico continuo.');
    if (taskPct < 80) recommendations.push('Completar las tareas pendientes para mejorar el promedio.');
    if (recommendations.length === 0) recommendations.push('Mantener el excelente rendimiento academico actual.');

  } else if (docType === 'group_risk') {
    const riskData = await getAcademicRiskReport(institutionId, userId, { threshold: params.threshold ?? 60 });
    metrics.push(
      { label: 'Estudiantes en riesgo', value: String(riskData.length), status: riskData.length === 0 ? 'good' : riskData.length <= 5 ? 'warning' : 'critical' },
    );
    sections.push({
      title: 'Reporte de Riesgo Academico',
      narrative: `Se identificaron ${riskData.length} estudiante(s) con promedio por debajo del umbral. ${riskData.length > 0 ? 'Se requiere atencion inmediata.' : 'Todos los estudiantes estan aprobando.'}`,
    });
    if (riskData.length > 0) recommendations.push('Programar reuniones con los estudiantes en riesgo y sus acudientes.');

  } else if (docType === 'attendance_report') {
    const attData = await getAttendanceReport(institutionId, userId, params);
    const avgAtt = attData.length > 0 ? attData.reduce((s, a) => s + a.percentage, 0) / attData.length : 0;
    metrics.push(
      { label: 'Asistencia promedio', value: `${Math.round(avgAtt)}%`, status: avgAtt >= 90 ? 'good' : avgAtt >= 75 ? 'warning' : 'critical' },
      { label: 'Grupos analizados', value: String(attData.length), status: 'neutral' },
    );

    const barData: EvoDocChartBar[] = attData.slice(0, 10).map(a => ({
      label: a.groupName.length > 6 ? a.groupName.slice(0, 6) : a.groupName,
      value: a.percentage,
      maxValue: 100,
    }));

    sections.push({
      title: 'Asistencia por Grupo',
      narrative: `La asistencia promedio es del ${Math.round(avgAtt)}% con ${attData.filter(a => a.percentage < 80).length} grupo(s) con asistencia baja.`,
      chartType: 'bar',
      chartData: barData,
    });

    if (avgAtt < 90) recommendations.push('Implementar estrategias para mejorar la asistencia general.');
  }

  if (sections.length === 0) {
    sections.push({
      title: 'Analisis General',
      narrative: 'Documento generado con la informacion disponible.',
    });
  }

  const docData: EvoDocData = {
    title,
    subjectName: subjectName || title,
    institutionName,
    period,
    docType,
    date: dateStr,
    metrics,
    sections,
    recommendations,
  };

  const result = await generateEvoDocPDF(docData, institutionId, userId, {
    description: `${title} - ${period}`,
    subjectId,
  });

  return {
    __type: 'evo_doc',
    title,
    description: `${title} - ${period}`,
    period,
    url: result.url,
    docId: result.docId,
  };
}

// ─── Función principal exportada ─────────────────────────────────────────────

export async function executeKiwiAction(
  toolName: string,
  toolParams: Record<string, unknown>,
  institutionId: string,
  userId: string,
  userRole: string
): Promise<KiwiActionResult> {
  try {
    switch (toolName) {
      // ── Shared ──
      case 'get_my_schedule': {
        const data = await getMySchedule(institutionId, userId, userRole, toolParams);
        if (!data) return { success: true, data: { message: 'No se encontró horario registrado.' } };
        return { success: true, data };
      }

      // ── Profesor ──
      case 'list_my_courses': {
        if (userRole === 'estudiante') {
          const data = await listStudentCourses(institutionId, userId, toolParams);
          return { success: true, data };
        }
        const data = await listMyCourses(institutionId, userId, toolParams);
        return { success: true, data };
      }

      case 'create_assignment': {
        const result = await createTeacherAssignment(institutionId, userId, toolParams);
        if ('requiresConfirmation' in result) {
          return { success: false, requiresConfirmation: true, preview: result.preview };
        }
        return { success: true, data: result };
      }

      // ── Estudiante ──
      case 'get_my_grades': {
        const data = await getMyGrades(institutionId, userId, toolParams);
        return { success: true, data };
      }

      case 'get_my_attendance': {
        const data = await getMyAttendance(institutionId, userId, toolParams);
        return { success: true, data };
      }

      case 'get_pending_tasks': {
        const data = await getPendingTasks(institutionId, userId, toolParams);
        return { success: true, data };
      }

      // ── Padre ──
      case 'get_child_grades': {
        const data = await getChildGrades(institutionId, userId, toolParams);
        return { success: true, data };
      }

      case 'get_child_attendance': {
        const data = await getChildAttendance(institutionId, userId, toolParams);
        return { success: true, data };
      }

      case 'get_comunicados': {
        const data = await getComunicados(institutionId, userId, toolParams);
        return { success: true, data };
      }

      case 'contact_teacher': {
        const data = await contactTeacher(institutionId, userId, toolParams);
        return { success: true, data };
      }

      // ── Directivo ──
      case 'get_institution_analytics': {
        const data = await getInstitutionAnalytics(institutionId, userId, toolParams);
        return { success: true, data };
      }

      case 'get_attendance_report': {
        const data = await getAttendanceReport(institutionId, userId, toolParams);
        return { success: true, data };
      }

      case 'get_academic_risk_report': {
        const data = await getAcademicRiskReport(institutionId, userId, toolParams);
        return { success: true, data };
      }

      case 'create_institutional_comunicado': {
        const result = await createInstitutionalComunicado(institutionId, userId, toolParams);
        if ('requiresConfirmation' in result) {
          return {
            success: false,
            requiresConfirmation: true,
            preview: result.preview,
          };
        }
        return { success: true, data: result };
      }

      case 'send_evosend_message': {
        const result = await sendEvoSendMessage(institutionId, userId, { ...toolParams, userRole });
        if ('requiresConfirmation' in result) {
          return { success: false, requiresConfirmation: true, preview: result.preview };
        }
        return { success: true, data: result };
      }

      case 'generate_boletin': {
        const result = await generateBoletin(institutionId, userId, toolParams);
        if ('requiresConfirmation' in result) {
          return { success: false, requiresConfirmation: true, preview: result.preview };
        }
        return { success: true, data: result };
      }

      // ── Workflows / Automation ──
      case 'trigger_workflow': {
        const workflowId = typeof toolParams.workflowId === 'string' ? toolParams.workflowId.trim() : '';
        if (!workflowId) {
          const workflows = listAvailableWorkflows();
          return {
            success: true,
            data: {
              message: 'Indica qué automatización quieres activar.',
              available: workflows,
            },
          };
        }
        const wfResult = await triggerWorkflow(workflowId, institutionId, userId, toolParams);
        return wfResult.success
          ? { success: true, data: wfResult }
          : { success: false, error: wfResult.message };
      }

      // ── RAG ──
      case 'search_documents': {
        const query = typeof toolParams.query === 'string' ? toolParams.query.trim() : '';
        if (!query) return { success: false, error: 'Se requiere una consulta para buscar documentos.' };
        const results = await searchKnowledge(institutionId, query, 5);
        if (results.length === 0) {
          return { success: true, data: { message: 'No se encontraron documentos relevantes para tu consulta.', results: [] } };
        }
        return {
          success: true,
          data: {
            message: `Encontré ${results.length} documento(s) relevante(s).`,
            results: results.map((r) => ({
              title: r.title,
              content: r.content,
              similarity: Math.round(r.similarity * 100),
            })),
          },
        };
      }

      case 'generate_evo_doc': {
        const docResult = await generateEvoDoc(institutionId, userId, userRole, toolParams);
        return { success: true, data: docResult };
      }

      case 'get_subject_analytics':
      case 'get_teacher_performance':
      case 'generate_academic_report':
        return { success: false, error: 'Esta herramienta estara disponible proximamente.' };

      default:
        return { success: false, error: `Tool no disponible: ${toolName}` };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error inesperado al ejecutar la acción';
    return { success: false, error: message };
  }
}
