import { queryPg } from '../config/db-pg.js';
import { ensureAcademicBoletinBatchesTable } from '../db/pgSchemaPatches.js';
import type { BoletinData } from '../services/boletinService.js';

export type StoredBoletinEntry = BoletinData & { grupo?: string };

export type AcademicBoletinBatchRow = {
  id: string;
  institution_id: string;
  group_id: string;
  group_name: string;
  periodo: string;
  created_by: string | null;
  created_at: string;
  boletines_json: StoredBoletinEntry[];
};

export async function insertAcademicBoletinBatch(
  institutionId: string,
  groupId: string,
  groupName: string,
  periodo: string,
  createdBy: string | null,
  boletines: StoredBoletinEntry[]
): Promise<string> {
  await ensureAcademicBoletinBatchesTable();
  const r = await queryPg<{ id: string }>(
    `INSERT INTO academic_boletin_batches (institution_id, group_id, group_name, periodo, created_by, boletines_json)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [institutionId, groupId, groupName, periodo, createdBy, JSON.stringify(boletines)]
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error('insertAcademicBoletinBatch: no id returned');
  return id;
}

export async function listAcademicBoletinBatches(
  institutionId: string,
  limit = 80
): Promise<
  Array<{
    id: string;
    periodo: string;
    group_name: string;
    created_at: string;
    estudiantes_count: number;
  }>
> {
  await ensureAcademicBoletinBatchesTable();
  const r = await queryPg<{
    id: string;
    periodo: string;
    group_name: string;
    created_at: string;
    estudiantes_count: string;
  }>(
    `SELECT id, periodo, group_name, created_at,
            jsonb_array_length(boletines_json)::int AS estudiantes_count
     FROM academic_boletin_batches
     WHERE institution_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [institutionId, limit]
  );
  return r.rows.map((row) => ({
    ...row,
    estudiantes_count: Number(row.estudiantes_count),
  }));
}

export async function getAcademicBoletinBatchById(
  batchId: string,
  institutionId: string
): Promise<AcademicBoletinBatchRow | null> {
  await ensureAcademicBoletinBatchesTable();
  const r = await queryPg<{
    id: string;
    institution_id: string;
    group_id: string;
    group_name: string;
    periodo: string;
    created_by: string | null;
    created_at: string;
    boletines_json: unknown;
  }>(
    `SELECT id, institution_id, group_id, group_name, periodo, created_by, created_at, boletines_json
     FROM academic_boletin_batches
     WHERE id = $1 AND institution_id = $2`,
    [batchId, institutionId]
  );
  const row = r.rows[0];
  if (!row) return null;
  const boletines = row.boletines_json;
  if (!Array.isArray(boletines)) {
    return {
      ...row,
      boletines_json: [],
    };
  }
  return {
    ...row,
    boletines_json: boletines as StoredBoletinEntry[],
  };
}
