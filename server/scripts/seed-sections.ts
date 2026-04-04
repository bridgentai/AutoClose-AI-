/**
 * Seed: create missing sections for Gimnasio Los Caobos
 * and assign the existing directivo to High School.
 *
 * Usage: npx tsx server/scripts/seed-sections.ts
 */
import '../config/env.js';
import { queryPg } from '../config/db-pg.js';

const INSTITUTION_ID = 'f0000000-0000-0000-0000-000000000001';

async function main() {
  console.log('[seed-sections] Starting...');

  // Ensure section_id column exists
  await queryPg(`ALTER TABLE users ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id) ON DELETE SET NULL`);
  await queryPg(`CREATE INDEX IF NOT EXISTS idx_users_section ON users(section_id)`);
  console.log('[seed-sections] users.section_id column ensured');

  const existing = await queryPg<{ id: string; name: string }>(
    `SELECT id, name FROM sections WHERE institution_id = $1 ORDER BY name`,
    [INSTITUTION_ID]
  );
  console.log('[seed-sections] Existing sections:', existing.rows.map(s => s.name));

  const needed = ['High School', 'Middle School', 'Junior School', 'Little Koalas'];
  for (const name of needed) {
    const found = existing.rows.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!found) {
      const r = await queryPg<{ id: string }>(
        `INSERT INTO sections (institution_id, name) VALUES ($1, $2) RETURNING id`,
        [INSTITUTION_ID, name]
      );
      console.log(`[seed-sections] Created section "${name}" with id ${r.rows[0].id}`);
    } else {
      console.log(`[seed-sections] Section "${name}" already exists (${found.id})`);
    }
  }

  const directivos = await queryPg<{ id: string; email: string; full_name: string; section_id: string | null }>(
    `SELECT id, email, full_name, section_id FROM users
     WHERE institution_id = $1 AND role = 'directivo'`,
    [INSTITUTION_ID]
  );

  if (directivos.rows.length === 0) {
    console.log('[seed-sections] No directivos found. Skipping assignment.');
  } else {
    const hs = await queryPg<{ id: string }>(
      `SELECT id FROM sections WHERE institution_id = $1 AND LOWER(name) = 'high school'`,
      [INSTITUTION_ID]
    );
    if (hs.rows[0]) {
      for (const d of directivos.rows) {
        if (!d.section_id) {
          await queryPg(
            `UPDATE users SET section_id = $1 WHERE id = $2 AND institution_id = $3`,
            [hs.rows[0].id, d.id, INSTITUTION_ID]
          );
          console.log(`[seed-sections] Assigned "${d.full_name}" (${d.email}) to High School`);
        } else {
          console.log(`[seed-sections] "${d.full_name}" already has section_id ${d.section_id}`);
        }
      }
    }
  }

  const final = await queryPg<{ name: string; groups: number }>(
    `SELECT s.name, COUNT(g.id)::int AS groups
     FROM sections s LEFT JOIN groups g ON g.section_id = s.id
     WHERE s.institution_id = $1
     GROUP BY s.id, s.name ORDER BY s.name`,
    [INSTITUTION_ID]
  );
  console.log('[seed-sections] Final state:');
  for (const row of final.rows) {
    console.log(`  ${row.name}: ${row.groups} groups`);
  }

  console.log('[seed-sections] Done.');
  process.exit(0);
}

main().catch(e => {
  console.error('[seed-sections] Error:', e);
  process.exit(1);
});
