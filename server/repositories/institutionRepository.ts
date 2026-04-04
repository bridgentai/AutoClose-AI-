import { queryPg } from '../config/db-pg.js';

export interface InstitutionRow {
  id: string;
  name: string;
  slug: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function findInstitutionById(id: string): Promise<InstitutionRow | null> {
  const r = await queryPg<InstitutionRow>(
    'SELECT * FROM institutions WHERE id = $1',
    [id]
  );
  return r.rows[0] ?? null;
}

export async function findInstitutionBySlug(slug: string): Promise<InstitutionRow | null> {
  const r = await queryPg<InstitutionRow>(
    'SELECT * FROM institutions WHERE slug = $1',
    [slug]
  );
  return r.rows[0] ?? null;
}

export async function findAllInstitutions(): Promise<InstitutionRow[]> {
  const r = await queryPg<InstitutionRow>('SELECT * FROM institutions ORDER BY name');
  return r.rows;
}

export async function createInstitution(row: {
  name: string;
  slug?: string | null;
  settings?: Record<string, unknown>;
}): Promise<InstitutionRow> {
  const r = await queryPg<InstitutionRow>(
    `INSERT INTO institutions (name, slug, settings, created_at, updated_at)
     VALUES ($1, $2, $3, now(), now()) RETURNING *`,
    [row.name, row.slug ?? null, JSON.stringify(row.settings ?? {})]
  );
  return r.rows[0];
}

/** Fusiona claves en institutions.settings (JSONB). */
export async function mergeInstitutionSettings(
  institutionId: string,
  patch: Record<string, unknown>
): Promise<InstitutionRow | null> {
  const r = await queryPg<InstitutionRow>(
    `UPDATE institutions
     SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [institutionId, JSON.stringify(patch)]
  );
  return r.rows[0] ?? null;
}
