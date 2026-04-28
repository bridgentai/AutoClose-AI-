import { queryPg } from '../config/db-pg.js';

export interface GroupSubjectRow {
  id: string;
  institution_id: string;
  group_id: string;
  subject_id: string;
  teacher_id: string;
  display_name?: string | null;
  icon?: string | null;
  created_at: string;
}

/** group_subject con datos de grupo, materia y profesor para respuestas de API */
export interface GroupSubjectWithDetails extends GroupSubjectRow {
  group_name: string;
  subject_name: string;
  subject_description: string | null;
  teacher_name: string;
  teacher_email: string;
}

export async function findGroupSubjectById(id: string): Promise<GroupSubjectRow | null> {
  const r = await queryPg<GroupSubjectRow>(
    'SELECT * FROM group_subjects WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

/** Un group_subject con nombres de grupo, materia y profesor (misma forma que findGroupSubjectsByGroupWithDetails). */
export async function findGroupSubjectWithDetailsById(
  id: string,
  institutionId: string
): Promise<GroupSubjectWithDetails | null> {
  const r = await queryPg<GroupSubjectWithDetails>(
    `SELECT gs.id, gs.institution_id, gs.group_id, gs.subject_id, gs.teacher_id, gs.display_name, gs.icon, gs.created_at,
            g.name AS group_name,
            COALESCE(gs.display_name, s.name) AS subject_name, s.description AS subject_description,
            u.full_name AS teacher_name, u.email AS teacher_email
     FROM group_subjects gs
     JOIN groups g ON g.id = gs.group_id
     JOIN subjects s ON s.id = gs.subject_id
     JOIN users u ON u.id = gs.teacher_id
     WHERE gs.id = $1 AND gs.institution_id = $2`,
    [id, institutionId]
  );
  return r.rows[0] ?? null;
}

export async function findGroupSubjectsByGroup(groupId: string, institutionId?: string): Promise<GroupSubjectRow[]> {
  if (institutionId) {
    const r = await queryPg<GroupSubjectRow>(
      'SELECT * FROM group_subjects WHERE group_id = $1 AND institution_id = $2 ORDER BY created_at',
      [groupId, institutionId]
    );
    return r.rows;
  }
  const r = await queryPg<GroupSubjectRow>(
    'SELECT * FROM group_subjects WHERE group_id = $1 ORDER BY created_at',
    [groupId]
  );
  return r.rows;
}

export async function findGroupSubjectsByTeacher(teacherId: string, institutionId?: string): Promise<GroupSubjectRow[]> {
  if (institutionId) {
    const r = await queryPg<GroupSubjectRow>(
      'SELECT * FROM group_subjects WHERE teacher_id = $1 AND institution_id = $2 ORDER BY created_at',
      [teacherId, institutionId]
    );
    return r.rows;
  }
  const r = await queryPg<GroupSubjectRow>(
    'SELECT * FROM group_subjects WHERE teacher_id = $1 ORDER BY created_at',
    [teacherId]
  );
  return r.rows;
}

/** group_subjects donde el grupo y el profesor coinciden (para sincronizar horario profesor → horario curso). */
export async function findGroupSubjectsByGroupAndTeacher(
  groupId: string,
  teacherId: string,
  institutionId: string
): Promise<GroupSubjectRow[]> {
  const r = await queryPg<GroupSubjectRow>(
    'SELECT * FROM group_subjects WHERE group_id = $1 AND teacher_id = $2 AND institution_id = $3 ORDER BY created_at',
    [groupId, teacherId, institutionId]
  );
  return r.rows;
}

/** Lee group_subjects de un grupo con nombre de grupo, materia y profesor en una sola query. */
export async function findGroupSubjectsByGroupWithDetails(
  groupId: string,
  institutionId?: string
): Promise<GroupSubjectWithDetails[]> {
  const q = `
    SELECT gs.id, gs.institution_id, gs.group_id, gs.subject_id, gs.teacher_id, gs.display_name, gs.icon, gs.created_at,
           g.name AS group_name,
           COALESCE(gs.display_name, s.name) AS subject_name, s.description AS subject_description,
           u.full_name AS teacher_name, u.email AS teacher_email
    FROM group_subjects gs
    JOIN groups g ON g.id = gs.group_id
    JOIN subjects s ON s.id = gs.subject_id
    JOIN users u ON u.id = gs.teacher_id
    WHERE gs.group_id = $1
    ${institutionId ? 'AND gs.institution_id = $2' : ''}
    ORDER BY gs.created_at
  `;
  const r = await queryPg<GroupSubjectWithDetails>(
    q,
    institutionId ? [groupId, institutionId] : [groupId]
  );
  return r.rows;
}

/** Lee group_subjects de una materia (subject_id) con nombre de grupo y profesor. */
export async function findGroupSubjectsBySubjectIdWithDetails(
  subjectId: string,
  institutionId: string
): Promise<GroupSubjectWithDetails[]> {
  const r = await queryPg<GroupSubjectWithDetails>(
    `SELECT gs.id, gs.institution_id, gs.group_id, gs.subject_id, gs.teacher_id, gs.display_name, gs.icon, gs.created_at,
            g.name AS group_name,
            COALESCE(gs.display_name, s.name) AS subject_name, s.description AS subject_description,
            u.full_name AS teacher_name, u.email AS teacher_email
     FROM group_subjects gs
     JOIN groups g ON g.id = gs.group_id
     JOIN subjects s ON s.id = gs.subject_id
     JOIN users u ON u.id = gs.teacher_id
     WHERE gs.subject_id = $1 AND gs.institution_id = $2
     ORDER BY g.name`,
    [subjectId, institutionId]
  );
  return r.rows;
}

/** Lee group_subjects de un profesor con nombre de grupo, materia y profesor en una sola query. */
export async function findGroupSubjectsByTeacherWithDetails(
  teacherId: string,
  institutionId?: string
): Promise<GroupSubjectWithDetails[]> {
  const q = `
    SELECT gs.id, gs.institution_id, gs.group_id, gs.subject_id, gs.teacher_id, gs.display_name, gs.icon, gs.created_at,
           g.name AS group_name,
           COALESCE(gs.display_name, s.name) AS subject_name, s.description AS subject_description,
           u.full_name AS teacher_name, u.email AS teacher_email
    FROM group_subjects gs
    JOIN groups g ON g.id = gs.group_id
    JOIN subjects s ON s.id = gs.subject_id
    JOIN users u ON u.id = gs.teacher_id
    WHERE gs.teacher_id = $1
    ${institutionId ? 'AND gs.institution_id = $2' : ''}
    ORDER BY g.name, gs.created_at
  `;
  const r = await queryPg<GroupSubjectWithDetails>(
    q,
    institutionId ? [teacherId, institutionId] : [teacherId]
  );
  return r.rows;
}

export async function createGroupSubject(row: {
  institution_id: string;
  group_id: string;
  subject_id: string;
  teacher_id: string;
}): Promise<GroupSubjectRow> {
  const r = await queryPg<GroupSubjectRow>(
    'INSERT INTO group_subjects (institution_id, group_id, subject_id, teacher_id) VALUES ($1, $2, $3, $4) ON CONFLICT (group_id, subject_id) DO NOTHING RETURNING *',
    [row.institution_id, row.group_id, row.subject_id, row.teacher_id]
  );
  if (r.rows[0]) return r.rows[0];
  const existing = await queryPg<GroupSubjectRow>(
    'SELECT * FROM group_subjects WHERE group_id = $1 AND subject_id = $2',
    [row.group_id, row.subject_id]
  );
  if (existing.rows[0]) return existing.rows[0];
  throw new Error('Failed to create group_subject');
}

/** Elimina la vinculación de un profesor a un group_subject (teacher_id = NULL). */
export async function clearGroupSubjectTeacher(groupSubjectId: string, institutionId: string): Promise<void> {
  await queryPg(
    `UPDATE group_subjects SET teacher_id = NULL WHERE id = $1 AND institution_id = $2`,
    [groupSubjectId, institutionId]
  );
}

/** Crea o actualiza la asignación (grupo + materia) para que la imparta este profesor. */
export async function upsertGroupSubjectTeacher(row: {
  institution_id: string;
  group_id: string;
  subject_id: string;
  teacher_id: string;
}): Promise<GroupSubjectRow> {
  const r = await queryPg<GroupSubjectRow>(
    `INSERT INTO group_subjects (institution_id, group_id, subject_id, teacher_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (group_id, subject_id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id
     RETURNING *`,
    [row.institution_id, row.group_id, row.subject_id, row.teacher_id]
  );
  if (!r.rows[0]) throw new Error('upsert group_subject failed');
  return r.rows[0];
}
