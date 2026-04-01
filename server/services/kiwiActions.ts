/**
 * Acciones ejecutables del agente Kiwi.
 * Cada función recibe (institutionId, userId, params) y usa queryPg directamente.
 * Sin imports de openai.ts — sin dependencia circular.
 * NUNCA retorna full_name de estudiantes.
 */

import { queryPg } from '../config/db-pg.js';
import { getBoletinDataForStudent } from './boletinService.js';

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
  preview: {
    title: string;
    content: string;
    targetAudience: string;
  };
}

export interface ComunicadoResult {
  success: true;
  announcementId: string;
  recipientCount: number;
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
       COUNT(DISTINCT gs.subject_id) AS subject_count
     FROM grades gr
     JOIN users u ON u.id = gr.user_id
     JOIN groups g ON g.id = gr.group_id
     JOIN enrollments e ON e.student_id = u.id AND e.group_id = g.id
     JOIN group_subjects gs ON gs.group_id = g.id
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
    const memberRes = await queryPg<{ n: number }>(
      `SELECT 1 AS n FROM announcement_recipients WHERE announcement_id = $1 AND user_id = $2 LIMIT 1`,
      [channelId, userId]
    );
    if (!memberRes.rows[0]) {
      throw new Error('No tienes acceso a ese canal');
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
        const result = await sendEvoSendMessage(institutionId, userId, toolParams);
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

      default:
        return { success: false, error: `Tool no disponible: ${toolName}` };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error inesperado al ejecutar la acción';
    return { success: false, error: message };
  }
}
