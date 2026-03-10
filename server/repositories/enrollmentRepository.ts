import { queryPg } from '../config/db-pg.js';
import type { GroupRow } from './groupRepository.js';

export interface EnrollmentRow {
  id: string;
  student_id: string;
  group_id: string;
  academic_period_id: string | null;
  created_at: string;
}

export async function findEnrollmentsByGroup(groupId: string): Promise<EnrollmentRow[]> {
  const r = await queryPg<EnrollmentRow>(
    'SELECT * FROM enrollments WHERE group_id = $1',
    [groupId]
  );
  return r.rows;
}

export async function findEnrollmentsByStudent(studentId: string): Promise<EnrollmentRow[]> {
  const r = await queryPg<EnrollmentRow>(
    'SELECT * FROM enrollments WHERE student_id = $1',
    [studentId]
  );
  return r.rows;
}

/** Para estudiantes: devuelve el nombre del grado real (grupo tipo 1: nombre ~ '^[0-9]'). */
export async function getFirstGroupNameForStudent(studentId: string): Promise<string | null> {
  const r = await queryPg<{ name: string }>(
    `SELECT g.name FROM enrollments e JOIN groups g ON g.id = e.group_id
     WHERE e.student_id = $1 AND g.name ~ '^[0-9]'
     LIMIT 1`,
    [studentId]
  );
  return r.rows[0]?.name ?? null;
}

/** Devuelve el grado real del estudiante (grupo tipo 1: nombre ~ '^[0-9]'). */
export async function getFirstGroupForStudent(studentId: string, institutionId?: string): Promise<GroupRow | null> {
  const r = await queryPg<GroupRow>(
    `SELECT g.id, g.institution_id, g.section_id, g.name, g.description, g.academic_period_id, g.created_at, g.updated_at
     FROM enrollments e JOIN groups g ON g.id = e.group_id
     WHERE e.student_id = $1 AND g.name ~ '^[0-9]'
     ${institutionId ? 'AND g.institution_id = $2' : ''}
     ORDER BY e.created_at
     LIMIT 1`,
    institutionId ? [studentId, institutionId] : [studentId]
  );
  return r.rows[0] ?? null;
}

/** Grupos-materia del estudiante (tipo 2: nombre ~ '^[^0-9]'). Para grades/submissions. */
export async function getAllCourseGroupsForStudent(
  studentId: string,
  institutionId?: string
): Promise<GroupRow[]> {
  const r = await queryPg<GroupRow>(
    `SELECT g.id, g.institution_id, g.section_id, g.name, g.description,
            g.academic_period_id, g.created_at, g.updated_at
     FROM enrollments e JOIN groups g ON g.id = e.group_id
     WHERE e.student_id = $1
     AND g.name ~ '^[^0-9]'
     ${institutionId ? 'AND g.institution_id = $2' : ''}
     ORDER BY g.name`,
    institutionId ? [studentId, institutionId] : [studentId]
  );
  return r.rows;
}

export async function findEnrollment(studentId: string, groupId: string, academicPeriodId: string | null): Promise<EnrollmentRow | null> {
  const r = await queryPg<EnrollmentRow>(
    'SELECT * FROM enrollments WHERE student_id = $1 AND group_id = $2 AND (academic_period_id = $3 OR (academic_period_id IS NULL AND $3::uuid IS NULL))',
    [studentId, groupId, academicPeriodId]
  );
  return r.rows[0] ?? null;
}

export async function createEnrollment(row: {
  student_id: string;
  group_id: string;
  academic_period_id?: string | null;
}): Promise<EnrollmentRow> {
  const r = await queryPg<EnrollmentRow>(
    'INSERT INTO enrollments (student_id, group_id, academic_period_id) VALUES ($1, $2, $3) ON CONFLICT (student_id, group_id, academic_period_id) DO NOTHING RETURNING *',
    [row.student_id, row.group_id, row.academic_period_id ?? null]
  );
  if (r.rows[0]) return r.rows[0];
  const existing = await findEnrollment(row.student_id, row.group_id, row.academic_period_id ?? null);
  if (existing) return existing;
  throw new Error('Failed to create enrollment');
}
