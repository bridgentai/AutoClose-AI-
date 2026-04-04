/**
 * Limpia la estructura académica del demo Caobos (institution_id f000...0001):
 * - Solo 4 secciones: High School, Middle School, Junior School, Little Koalas (borra el resto).
 * - Solo grupos/cursos en High School; deja exactamente los que ya existan ahí (objetivo: 9 en demo).
 * - Solo un directivo: Mauricio Posada (por nombre); borra otros directivos de la institución.
 *
 * Uso: npx tsx server/scripts/prune-demo-caobos-academic.ts
 */
import '../config/env.js';
import { queryPg } from '../config/db-pg.js';

const INSTITUTION_ID = 'f0000000-0000-0000-0000-000000000001';
const ALLOWED_SECTION_KEYS = new Set(['high school', 'middle school', 'junior school', 'little koalas']);

async function main() {
  const mau = await queryPg<{ id: string }>(
    `SELECT id FROM users
     WHERE institution_id = $1 AND role = 'directivo'
       AND LOWER(TRIM(full_name)) LIKE '%mauricio%' AND LOWER(TRIM(full_name)) LIKE '%posada%'
     LIMIT 1`,
    [INSTITUTION_ID]
  );
  if (!mau.rows[0]) {
    throw new Error('No se encontró directivo Mauricio Posada en esta institución.');
  }
  const mauricioId = mau.rows[0].id;

  const hs = await queryPg<{ id: string }>(
    `SELECT id FROM sections
     WHERE institution_id = $1 AND LOWER(TRIM(name)) IN ('high school', 'highschool')
     LIMIT 1`,
    [INSTITUTION_ID]
  );
  if (!hs.rows[0]) {
    throw new Error('No se encontró sección High School.');
  }
  const highSchoolId = hs.rows[0].id;

  const delGr = await queryPg(
    'DELETE FROM groups WHERE institution_id = $1 AND section_id <> $2',
    [INSTITUTION_ID, highSchoolId]
  );
  console.log(`[prune-caobos] Grupos fuera de High School eliminados: ${delGr.rowCount ?? 0}`);

  const secs = await queryPg<{ id: string; name: string }>(
    'SELECT id, name FROM sections WHERE institution_id = $1',
    [INSTITUTION_ID]
  );
  for (const s of secs.rows) {
    const key = s.name.toLowerCase().trim();
    if (ALLOWED_SECTION_KEYS.has(key) || key === 'highschool') continue;
    await queryPg('DELETE FROM sections WHERE id = $1 AND institution_id = $2', [s.id, INSTITUTION_ID]);
    console.log(`[prune-caobos] Sección eliminada: "${s.name}"`);
  }

  const dirDel = await queryPg(
    `DELETE FROM users WHERE institution_id = $1 AND role = 'directivo' AND id <> $2`,
    [INSTITUTION_ID, mauricioId]
  );
  console.log(`[prune-caobos] Otros directivos eliminados: ${dirDel.rowCount ?? 0}`);

  await queryPg(
    `UPDATE users SET section_id = $1, updated_at = now() WHERE id = $2 AND institution_id = $3`,
    [highSchoolId, mauricioId, INSTITUTION_ID]
  );

  const gCount = await queryPg<{ c: string }>(
    'SELECT COUNT(*)::text AS c FROM groups WHERE institution_id = $1 AND section_id = $2',
    [INSTITUTION_ID, highSchoolId]
  );
  console.log(`[prune-caobos] Grupos en High School ahora: ${gCount.rows[0]?.c ?? '?'}`);
  console.log('[prune-caobos] Listo.');
}

main().catch((e) => {
  console.error('[prune-caobos]', e);
  process.exit(1);
});
