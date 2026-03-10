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
