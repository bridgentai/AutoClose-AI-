import { queryPg } from '../config/db-pg.js';

export interface InstitutionCodeRow {
  id: string;
  institution_id: string;
  code: string;
  role_assigned: string;
}

export async function findInstitutionCodeByCode(code: string): Promise<InstitutionCodeRow | null> {
  const r = await queryPg<InstitutionCodeRow>(
    'SELECT * FROM institution_codes WHERE code = $1 LIMIT 1',
    [code]
  );
  return r.rows[0] ?? null;
}

export async function findInstitutionCodesByInstitution(institutionId: string): Promise<InstitutionCodeRow[]> {
  const r = await queryPg<InstitutionCodeRow>(
    'SELECT * FROM institution_codes WHERE institution_id = $1 ORDER BY code',
    [institutionId]
  );
  return r.rows;
}

export async function findInstitutionCodeByInstitutionAndCode(
  institutionId: string,
  code: string
): Promise<InstitutionCodeRow | null> {
  const r = await queryPg<InstitutionCodeRow>(
    'SELECT * FROM institution_codes WHERE institution_id = $1 AND code = $2',
    [institutionId, code]
  );
  return r.rows[0] ?? null;
}

export async function createInstitutionCode(row: {
  institution_id: string;
  code: string;
  role_assigned: string;
}): Promise<InstitutionCodeRow> {
  const r = await queryPg<InstitutionCodeRow>(
    `INSERT INTO institution_codes (institution_id, code, role_assigned)
     VALUES ($1, $2, $3) RETURNING *`,
    [row.institution_id, row.code, row.role_assigned]
  );
  return r.rows[0];
}
