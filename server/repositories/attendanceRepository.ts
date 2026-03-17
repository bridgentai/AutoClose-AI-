import { queryPg } from '../config/db-pg.js';

export interface AttendanceRow {
  id: string;
  institution_id: string;
  group_subject_id: string;
  user_id: string;
  date: string;
  period_slot: string | null;
  status: string;
  punctuality: string | null;
  recorded_by_id: string | null;
  created_at: string;
}

export async function findAttendanceByStudentAndDate(
  studentId: string,
  fromDate: string,
  toDate: string
): Promise<AttendanceRow[]> {
  const r = await queryPg<AttendanceRow>(
    'SELECT * FROM attendance WHERE user_id = $1 AND date >= $2 AND date <= $3 ORDER BY date',
    [studentId, fromDate, toDate]
  );
  return r.rows;
}

export async function findAttendanceByGroupSubjectAndDate(
  groupSubjectId: string,
  date: string
): Promise<AttendanceRow[]> {
  const r = await queryPg<AttendanceRow>(
    'SELECT * FROM attendance WHERE group_subject_id = $1 AND date = $2',
    [groupSubjectId, date]
  );
  return r.rows;
}

export async function findAttendanceByStudent(studentId: string): Promise<AttendanceRow[]> {
  const r = await queryPg<AttendanceRow>(
    'SELECT * FROM attendance WHERE user_id = $1 ORDER BY date DESC',
    [studentId]
  );
  return r.rows;
}

export async function countAttendanceByInstitutionAndDateRange(
  institutionId: string,
  fromDate: string,
  toDate: string
): Promise<{ total: number; presentCount: number }> {
  const r = await queryPg<{ total: string; present_count: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'present')::text AS present_count
     FROM attendance WHERE institution_id = $1 AND date >= $2 AND date <= $3`,
    [institutionId, fromDate, toDate]
  );
  const row = r.rows[0];
  return {
    total: parseInt(row?.total ?? '0', 10),
    presentCount: parseInt(row?.present_count ?? '0', 10),
  };
}

export async function upsertAttendance(row: {
  institution_id: string;
  group_subject_id: string;
  user_id: string;
  date: string;
  period_slot?: string | null;
  status: string;
  punctuality?: string | null;
  recorded_by_id?: string | null;
}): Promise<AttendanceRow> {
  const r = await queryPg<AttendanceRow>(
    `INSERT INTO attendance (institution_id, group_subject_id, user_id, date, period_slot, status, punctuality, recorded_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (group_subject_id, user_id, date, period_slot) DO UPDATE SET
       status = EXCLUDED.status,
       punctuality = EXCLUDED.punctuality,
       recorded_by_id = EXCLUDED.recorded_by_id
     RETURNING *`,
    [
      row.institution_id,
      row.group_subject_id,
      row.user_id,
      row.date,
      row.period_slot ?? null,
      row.status,
      row.punctuality ?? null,
      row.recorded_by_id ?? null,
    ]
  );
  return r.rows[0];
}

export async function findAttendanceById(id: string): Promise<AttendanceRow | null> {
  const r = await queryPg<AttendanceRow>('SELECT * FROM attendance WHERE id = $1', [id]);
  return r.rows[0] ?? null;
}

export async function updateAttendanceById(
  id: string,
  institutionId: string,
  patch: { status?: string; punctuality?: string | null }
): Promise<AttendanceRow | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (patch.status !== undefined) {
    updates.push(`status = $${idx}`);
    values.push(patch.status);
    idx++;
  }
  if (patch.punctuality !== undefined) {
    updates.push(`punctuality = $${idx}`);
    values.push(patch.punctuality);
    idx++;
  }
  if (updates.length === 0) {
    return findAttendanceById(id);
  }
  values.push(id, institutionId);
  const r = await queryPg<AttendanceRow>(
    `UPDATE attendance SET ${updates.join(', ')} WHERE id = $${idx} AND institution_id = $${idx + 1} RETURNING *`,
    values
  );
  return r.rows[0] ?? null;
}

/** Row shape for historial: one record per attendance with joined names */
export interface AttendanceHistorialRow {
  id: string;
  date: string;
  group_subject_id: string;
  subject_name: string;
  user_id: string;
  student_name: string;
  status: string;
  punctuality: string | null;
  recorded_by_id: string | null;
  recorded_by_name: string | null;
  period_slot: string | null;
}

export async function findAttendanceByGroupMonth(
  groupId: string,
  institutionId: string,
  year: number,
  month: number,
  filters?: { groupSubjectId?: string; estudianteId?: string }
): Promise<AttendanceHistorialRow[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const conditions = [
    'a.institution_id = $1',
    'gs.group_id = $2',
    'a.date >= $3',
    'a.date <= $4',
  ];
  const params: unknown[] = [institutionId, groupId, startDate, endDate];
  let idx = 5;
  if (filters?.groupSubjectId) {
    conditions.push(`a.group_subject_id = $${idx}`);
    params.push(filters.groupSubjectId);
    idx++;
  }
  if (filters?.estudianteId) {
    conditions.push(`a.user_id = $${idx}`);
    params.push(filters.estudianteId);
    idx++;
  }

  const q = `
    SELECT a.id, a.date, a.group_subject_id, a.user_id, a.status, a.punctuality, a.recorded_by_id, a.period_slot,
           COALESCE(gs.display_name, s.name) AS subject_name,
           u_student.full_name AS student_name,
           u_recorder.full_name AS recorded_by_name
    FROM attendance a
    JOIN group_subjects gs ON gs.id = a.group_subject_id
    JOIN subjects s ON s.id = gs.subject_id
    JOIN users u_student ON u_student.id = a.user_id
    LEFT JOIN users u_recorder ON u_recorder.id = a.recorded_by_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.date, gs.display_name, s.name, u_student.full_name
  `;
  const r = await queryPg<AttendanceHistorialRow>(q, params);
  return r.rows;
}
