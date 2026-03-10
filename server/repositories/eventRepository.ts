import { queryPg } from '../config/db-pg.js';

export interface EventRow {
  id: string;
  institution_id: string;
  title: string;
  description: string | null;
  date: string;
  type: string;
  group_id: string | null;
  created_by_id: string | null;
  created_at: string;
}

export interface EventWithDetails extends EventRow {
  group_name?: string | null;
  created_by_name?: string | null;
}

export async function findEventById(id: string): Promise<EventRow | null> {
  const r = await queryPg<EventRow>(
    'SELECT * FROM events WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findEventByIdWithDetails(id: string): Promise<EventWithDetails | null> {
  const r = await queryPg<EventWithDetails>(
    `SELECT e.*, g.name AS group_name, u.full_name AS created_by_name
     FROM events e
     LEFT JOIN groups g ON e.group_id = g.id
     LEFT JOIN users u ON e.created_by_id = u.id
     WHERE e.id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findEventsByInstitutionWithDetails(
  institutionId: string,
  options?: { fromDate?: string; toDate?: string; type?: string; groupId?: string }
): Promise<EventWithDetails[]> {
  let q = `SELECT e.*, g.name AS group_name, u.full_name AS created_by_name
     FROM events e
     LEFT JOIN groups g ON e.group_id = g.id
     LEFT JOIN users u ON e.created_by_id = u.id
     WHERE e.institution_id = $1`;
  const params: unknown[] = [institutionId];
  let idx = 2;
  if (options?.fromDate) {
    params.push(options.fromDate);
    q += ` AND e.date >= $${idx++}`;
  }
  if (options?.toDate) {
    params.push(options.toDate);
    q += ` AND e.date <= $${idx++}`;
  }
  if (options?.type === 'curso' || options?.type === 'colegio') {
    params.push(options.type);
    q += ` AND e."type" = $${idx++}`;
  }
  if (options?.groupId) {
    params.push(options.groupId);
    q += ` AND e.group_id = $${idx++}`;
  }
  q += ' ORDER BY e.date';
  const r = await queryPg<EventWithDetails>(q, params);
  return r.rows;
}

export async function findEventsByInstitution(
  institutionId: string,
  options?: { fromDate?: string; toDate?: string; type?: string; groupId?: string }
): Promise<EventRow[]> {
  let q = 'SELECT * FROM events WHERE institution_id = $1';
  const params: unknown[] = [institutionId];
  let idx = 2;
  if (options?.fromDate) {
    params.push(options.fromDate);
    q += ` AND date >= $${idx++}`;
  }
  if (options?.toDate) {
    params.push(options.toDate);
    q += ` AND date <= $${idx++}`;
  }
  if (options?.type === 'curso' || options?.type === 'colegio') {
    params.push(options.type);
    q += ` AND "type" = $${idx++}`;
  }
  if (options?.groupId) {
    params.push(options.groupId);
    q += ` AND group_id = $${idx++}`;
  }
  q += ' ORDER BY date';
  const r = await queryPg<EventRow>(q, params);
  return r.rows;
}

export async function createEvent(row: {
  institution_id: string;
  title: string;
  description?: string | null;
  date: string;
  type: string;
  group_id?: string | null;
  created_by_id?: string | null;
}): Promise<EventRow> {
  const r = await queryPg<EventRow>(
    `INSERT INTO events (institution_id, title, description, date, "type", group_id, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      row.institution_id,
      row.title,
      row.description ?? null,
      row.date,
      row.type,
      row.group_id ?? null,
      row.created_by_id ?? null,
    ]
  );
  return r.rows[0];
}

export async function updateEvent(
  id: string,
  institutionId: string,
  updates: { title?: string; description?: string; date?: string; type?: string; group_id?: string | null }
): Promise<EventRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (updates.title !== undefined) {
    sets.push(`title = $${i++}`);
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    sets.push(`description = $${i++}`);
    values.push(updates.description);
  }
  if (updates.date !== undefined) {
    sets.push(`date = $${i++}`);
    values.push(updates.date);
  }
  if (updates.type !== undefined) {
    sets.push(`"type" = $${i++}`);
    values.push(updates.type);
  }
  if (updates.group_id !== undefined) {
    sets.push(`group_id = $${i++}`);
    values.push(updates.group_id);
  }
  if (sets.length === 0) return findEventById(id);
  values.push(id, institutionId);
  const r = await queryPg<EventRow>(
    `UPDATE events SET ${sets.join(', ')} WHERE id = $${i} AND institution_id = $${i + 1} RETURNING *`,
    values
  );
  return r.rows[0] ?? null;
}

export async function deleteEvent(id: string, institutionId: string): Promise<boolean> {
  const r = await queryPg(
    'DELETE FROM events WHERE id = $1 AND institution_id = $2 RETURNING 1',
    [id, institutionId]
  );
  return (r.rowCount ?? 0) > 0;
}
