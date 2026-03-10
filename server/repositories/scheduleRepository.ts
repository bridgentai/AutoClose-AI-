import { queryPg } from '../config/db-pg.js';

export interface GroupScheduleRow {
  institution_id: string;
  group_id: string;
  slots: Record<string, string>;
  updated_at: string;
}

export interface ProfessorScheduleRow {
  institution_id: string;
  professor_id: string;
  slots: Record<string, string>;
  updated_at: string;
}

export async function findGroupScheduleByGroup(
  institutionId: string,
  groupId: string
): Promise<GroupScheduleRow | null> {
  const r = await queryPg<GroupScheduleRow>(
    'SELECT * FROM group_schedules WHERE institution_id = $1 AND group_id = $2',
    [institutionId, groupId]
  );
  return r.rows[0] ?? null;
}

export async function findProfessorScheduleByProfessor(
  institutionId: string,
  professorId: string
): Promise<ProfessorScheduleRow | null> {
  const r = await queryPg<ProfessorScheduleRow>(
    'SELECT * FROM professor_schedules WHERE institution_id = $1 AND professor_id = $2',
    [institutionId, professorId]
  );
  return r.rows[0] ?? null;
}

export async function upsertGroupSchedule(
  institutionId: string,
  groupId: string,
  slots: Record<string, string>
): Promise<GroupScheduleRow> {
  const r = await queryPg<GroupScheduleRow>(
    `INSERT INTO group_schedules (institution_id, group_id, slots, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (institution_id, group_id)
     DO UPDATE SET slots = $3, updated_at = now()
     RETURNING *`,
    [institutionId, groupId, JSON.stringify(slots)]
  );
  return r.rows[0];
}

export async function upsertProfessorSchedule(
  institutionId: string,
  professorId: string,
  slots: Record<string, string>
): Promise<ProfessorScheduleRow> {
  const r = await queryPg<ProfessorScheduleRow>(
    `INSERT INTO professor_schedules (institution_id, professor_id, slots, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (institution_id, professor_id)
     DO UPDATE SET slots = $3, updated_at = now()
     RETURNING *`,
    [institutionId, professorId, JSON.stringify(slots)]
  );
  return r.rows[0];
}
