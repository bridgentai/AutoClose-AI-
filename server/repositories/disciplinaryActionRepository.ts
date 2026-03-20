import { queryPg } from '../config/db-pg.js';

export type DisciplinarySeverity = 'leve' | 'grave' | 'suma gravedad';

export interface DisciplinaryActionRow {
  id: string;
  institution_id: string;
  student_id: string;
  created_by_id: string;
  severity: DisciplinarySeverity;
  reason: string;
  created_at: string;
}

export async function listDisciplinaryActionsByStudent(
  institutionId: string,
  studentId: string,
  limit = 50
): Promise<DisciplinaryActionRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 200);
  const r = await queryPg<DisciplinaryActionRow>(
    `SELECT * FROM disciplinary_actions
     WHERE institution_id = $1 AND student_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [institutionId, studentId, safeLimit]
  );
  return r.rows;
}

export async function createDisciplinaryAction(row: {
  institution_id: string;
  student_id: string;
  created_by_id: string;
  severity: DisciplinarySeverity;
  reason: string;
}): Promise<DisciplinaryActionRow> {
  const r = await queryPg<DisciplinaryActionRow>(
    `INSERT INTO disciplinary_actions (institution_id, student_id, created_by_id, severity, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [row.institution_id, row.student_id, row.created_by_id, row.severity, row.reason]
  );
  const inserted = r.rows[0];
  if (!inserted) throw new Error('No se pudo crear la amonestación.');
  return inserted;
}

