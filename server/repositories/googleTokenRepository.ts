import { queryPg } from '../config/db-pg.js';

export interface GoogleTokenRow {
  id: string;
  user_id: string;
  institution_id: string;
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export async function getGoogleToken(userId: string): Promise<GoogleTokenRow | null> {
  const r = await queryPg<GoogleTokenRow>(
    'SELECT * FROM google_tokens WHERE user_id = $1',
    [userId]
  );
  return r.rows[0] ?? null;
}

export async function upsertGoogleToken(data: {
  user_id: string;
  institution_id: string;
  access_token: string;
  refresh_token?: string | null;
  expiry_date?: number | null;
  email?: string | null;
}): Promise<GoogleTokenRow> {
  const r = await queryPg<GoogleTokenRow>(
    `INSERT INTO google_tokens (user_id, institution_id, access_token, refresh_token, expiry_date, email)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       access_token  = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, google_tokens.refresh_token),
       expiry_date   = EXCLUDED.expiry_date,
       email         = COALESCE(EXCLUDED.email, google_tokens.email),
       institution_id = EXCLUDED.institution_id,
       updated_at    = now()
     RETURNING *`,
    [
      data.user_id,
      data.institution_id,
      data.access_token,
      data.refresh_token ?? null,
      data.expiry_date ?? null,
      data.email ?? null,
    ]
  );
  return r.rows[0];
}

export async function updateGoogleAccessToken(
  userId: string,
  accessToken: string,
  expiryDate: number
): Promise<void> {
  await queryPg(
    'UPDATE google_tokens SET access_token = $1, expiry_date = $2, updated_at = now() WHERE user_id = $3',
    [accessToken, expiryDate, userId]
  );
}

export async function deleteGoogleToken(userId: string): Promise<void> {
  await queryPg('DELETE FROM google_tokens WHERE user_id = $1', [userId]);
}
