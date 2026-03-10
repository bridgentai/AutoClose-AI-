import { queryPg } from '../config/db-pg.js';

export interface AcademicPeriodRow {
  id: string;
  institution_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export async function findAcademicPeriodById(id: string): Promise<AcademicPeriodRow | null> {
  const r = await queryPg<AcademicPeriodRow>(
    'SELECT * FROM academic_periods WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findAcademicPeriodsByInstitution(institutionId: string): Promise<AcademicPeriodRow[]> {
  const r = await queryPg<AcademicPeriodRow>(
    'SELECT * FROM academic_periods WHERE institution_id = $1 ORDER BY start_date DESC',
    [institutionId]
  );
  return r.rows;
}

export async function findActiveAcademicPeriodForInstitution(institutionId: string): Promise<AcademicPeriodRow | null> {
  const r = await queryPg<AcademicPeriodRow>(
    'SELECT * FROM academic_periods WHERE institution_id = $1 AND is_active = true ORDER BY start_date DESC LIMIT 1',
    [institutionId]
  );
  return r.rows[0] ?? null;
}
