import { queryPg } from '../config/db-pg.js';

export interface ActivityLogRow {
  id: string;
  institution_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function findActivityLogsByInstitution(
  institutionId: string,
  opts?: { limit?: number; offset?: number; entityType?: string; action?: string; startDate?: string; endDate?: string }
): Promise<ActivityLogRow[]> {
  let q = 'SELECT * FROM analytics.activity_logs WHERE institution_id = $1';
  const params: unknown[] = [institutionId];
  let i = 2;
  if (opts?.entityType) {
    q += ` AND entity_type = $${i}`;
    params.push(opts.entityType);
    i++;
  }
  if (opts?.action) {
    q += ` AND action = $${i}`;
    params.push(opts.action);
    i++;
  }
  if (opts?.startDate) {
    q += ` AND created_at >= $${i}::timestamptz`;
    params.push(opts.startDate);
    i++;
  }
  if (opts?.endDate) {
    q += ` AND created_at <= $${i}::timestamptz`;
    params.push(opts.endDate);
    i++;
  }
  q += ' ORDER BY created_at DESC';
  const limit = Math.min(opts?.limit ?? 100, 500);
  const offset = opts?.offset ?? 0;
  q += ` LIMIT ${limit} OFFSET ${offset}`;
  const r = await queryPg<ActivityLogRow>(q, params);
  return r.rows;
}

export async function countActivityLogsByInstitution(
  institutionId: string,
  opts?: { entityType?: string; action?: string; startDate?: string; endDate?: string }
): Promise<number> {
  let q = 'SELECT COUNT(*)::int AS c FROM analytics.activity_logs WHERE institution_id = $1';
  const params: unknown[] = [institutionId];
  let i = 2;
  if (opts?.entityType) {
    q += ` AND entity_type = $${i}`;
    params.push(opts.entityType);
    i++;
  }
  if (opts?.action) {
    q += ` AND action = $${i}`;
    params.push(opts.action);
    i++;
  }
  if (opts?.startDate) {
    q += ` AND created_at >= $${i}::timestamptz`;
    params.push(opts.startDate);
    i++;
  }
  if (opts?.endDate) {
    q += ` AND created_at <= $${i}::timestamptz`;
    params.push(opts.endDate);
  }
  const r = await queryPg<{ c: number }>(q, params);
  return r.rows[0]?.c ?? 0;
}

export async function createActivityLog(row: {
  institution_id: string;
  user_id: string;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<ActivityLogRow> {
  const r = await queryPg<ActivityLogRow>(
    `INSERT INTO analytics.activity_logs (institution_id, user_id, entity_type, entity_id, action, metadata)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      row.institution_id,
      row.user_id,
      row.entity_type,
      row.entity_id ?? null,
      row.action,
      row.metadata ?? {},
    ]
  );
  return r.rows[0];
}
