/**
 * Fix: move groups from legacy "Highschool" to "High School"
 * and remove the duplicate.
 *
 * Usage: npx tsx server/scripts/fix-sections.ts
 */
import '../config/env.js';
import { queryPg } from '../config/db-pg.js';

const INSTITUTION_ID = 'f0000000-0000-0000-0000-000000000001';

async function main() {
  console.log('[fix-sections] Starting...');

  const sections = await queryPg<{ id: string; name: string }>(
    `SELECT id, name FROM sections WHERE institution_id = $1 ORDER BY name`,
    [INSTITUTION_ID]
  );
  console.log('[fix-sections] Sections:', sections.rows.map(s => `${s.name} (${s.id})`));

  const highSchool = sections.rows.find(s => s.name === 'High School');
  const highschoolLegacy = sections.rows.find(s => s.name === 'Highschool');

  if (highSchool && highschoolLegacy && highSchool.id !== highschoolLegacy.id) {
    console.log(`[fix-sections] Moving groups from "${highschoolLegacy.name}" (${highschoolLegacy.id}) to "${highSchool.name}" (${highSchool.id})`);

    const updated = await queryPg(
      `UPDATE groups SET section_id = $1 WHERE section_id = $2 AND institution_id = $3`,
      [highSchool.id, highschoolLegacy.id, INSTITUTION_ID]
    );
    console.log(`[fix-sections] Moved ${updated.rowCount} groups`);

    await queryPg(`DELETE FROM sections WHERE id = $1`, [highschoolLegacy.id]);
    console.log(`[fix-sections] Deleted legacy "Highschool" section`);
  } else {
    console.log('[fix-sections] No fix needed');
  }

  const final = await queryPg<{ name: string; groups: number }>(
    `SELECT s.name, COUNT(g.id)::int AS groups
     FROM sections s LEFT JOIN groups g ON g.section_id = s.id
     WHERE s.institution_id = $1
     GROUP BY s.id, s.name ORDER BY s.name`,
    [INSTITUTION_ID]
  );
  console.log('[fix-sections] Final state:');
  for (const row of final.rows) {
    console.log(`  ${row.name}: ${row.groups} groups`);
  }

  console.log('[fix-sections] Done.');
  process.exit(0);
}

main().catch(e => {
  console.error('[fix-sections] Error:', e);
  process.exit(1);
});
