import { queryPg } from '../config/db-pg.js';

export interface EvoPersonalFileRow {
  id: string;
  user_id: string;
  institution_id: string;
  nombre: string;
  tipo: string;
  url: string | null;
  google_file_id: string | null;
  google_web_view_link: string | null;
  google_mime_type: string | null;
  created_at: string;
}

export async function getPersonalFiles(userId: string, institutionId: string): Promise<EvoPersonalFileRow[]> {
  const r = await queryPg<EvoPersonalFileRow>(
    `SELECT * FROM evo_personal_files
     WHERE user_id = $1 AND institution_id = $2
     ORDER BY created_at DESC`,
    [userId, institutionId]
  );
  return r.rows;
}

export async function createPersonalFile(data: {
  user_id: string;
  institution_id: string;
  nombre: string;
  tipo: string;
  url?: string | null;
  google_file_id?: string | null;
  google_web_view_link?: string | null;
  google_mime_type?: string | null;
}): Promise<EvoPersonalFileRow> {
  const r = await queryPg<EvoPersonalFileRow>(
    `INSERT INTO evo_personal_files (user_id, institution_id, nombre, tipo, url, google_file_id, google_web_view_link, google_mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.user_id,
      data.institution_id,
      data.nombre,
      data.tipo,
      data.url ?? null,
      data.google_file_id ?? null,
      data.google_web_view_link ?? null,
      data.google_mime_type ?? null,
    ]
  );
  return r.rows[0];
}

export async function deletePersonalFile(
  id: string,
  userId: string,
  institutionId: string
): Promise<boolean> {
  const r = await queryPg<{ id: string }>(
    `DELETE FROM evo_personal_files WHERE id = $1 AND user_id = $2 AND institution_id = $3 RETURNING id`,
    [id, userId, institutionId]
  );
  return r.rows.length > 0;
}
