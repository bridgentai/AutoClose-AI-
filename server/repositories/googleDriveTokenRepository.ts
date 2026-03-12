import { queryPg } from '../config/db-pg.js';

export interface GoogleDriveTokenRow {
  id: string;
  user_id: string;
  institution_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

async function ensureTable() {
  await queryPg(`
    CREATE TABLE IF NOT EXISTS google_drive_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, institution_id)
    )
  `);
}

export async function getToken(userId: string, institutionId: string): Promise<GoogleDriveTokenRow | null> {
  await ensureTable();
  const r = await queryPg<GoogleDriveTokenRow>(
    'SELECT * FROM google_drive_tokens WHERE user_id = $1 AND institution_id = $2',
    [userId, institutionId]
  );
  return r.rows[0] ?? null;
}

export async function upsertToken(data: {
  user_id: string;
  institution_id: string;
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
}): Promise<GoogleDriveTokenRow> {
  await ensureTable();
  const r = await queryPg<GoogleDriveTokenRow>(
    `INSERT INTO google_drive_tokens (user_id, institution_id, access_token, refresh_token, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id, institution_id)
     DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = COALESCE(EXCLUDED.refresh_token, google_drive_tokens.refresh_token),
                   expires_at = EXCLUDED.expires_at, updated_at = now()
     RETURNING *`,
    [data.user_id, data.institution_id, data.access_token, data.refresh_token ?? null, data.expires_at ?? null]
  );
  return r.rows[0];
}

export async function deleteToken(userId: string, institutionId: string): Promise<void> {
  await ensureTable();
  await queryPg(
    'DELETE FROM google_drive_tokens WHERE user_id = $1 AND institution_id = $2',
    [userId, institutionId]
  );
}
