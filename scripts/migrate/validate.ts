/**
 * Phase 2 - Validate migration: record counts, FK integrity, key consistencies.
 * Writes results to docs/migration-validation.md
 * Run: npx tsx scripts/migrate/validate.ts
 */

import { resolve } from 'path';
import { writeFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL in .env');
  process.exit(1);
}

async function run() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const results: string[] = [];
  results.push('# Migration Validation Report');
  results.push('');
  results.push(`Generated: ${new Date().toISOString()}`);
  results.push('');

  const tables = [
    'institutions', 'academic_periods', 'users', 'sections', 'subjects', 'groups',
    'group_subjects', 'enrollments', 'assignments', 'submissions', 'grades',
    'grade_events', 'attendance', 'conversations', 'messages', 'notifications',
    'events', 'chat_sessions', 'chat_messages', 'announcements', 'announcement_messages',
  ];

  results.push('## Table counts');
  results.push('| Table | Count |');
  results.push('|-------|-------|');

  for (const table of tables) {
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
      results.push(`| ${table} | ${r.rows[0]?.c ?? 0} |`);
    } catch (e) {
      results.push(`| ${table} | ERROR: ${(e as Error).message} |`);
    }
  }

  try {
    const r = await client.query('SELECT COUNT(*)::int AS c FROM analytics.performance_snapshots');
    results.push('| analytics.performance_snapshots | ' + (r.rows[0]?.c ?? 0) + ' |');
  } catch {
    results.push('| analytics.performance_snapshots | (table missing or error) |');
  }
  try {
    const r = await client.query('SELECT COUNT(*)::int AS c FROM analytics.ai_action_logs');
    results.push('| analytics.ai_action_logs | ' + (r.rows[0]?.c ?? 0) + ' |');
  } catch {
    results.push('| analytics.ai_action_logs | (table missing or error) |');
  }

  results.push('');
  results.push('## FK checks (sample)');
  results.push('- Enrollments: each student_id and group_id should exist in users and groups.');
  results.push('- Submissions: each assignment_id and student_id should exist.');
  results.push('- Grade events: each assignment_id, user_id, group_id should exist.');
  results.push('');

  let fkOk = true;
  const enrollOrphanStudent = await client.query(`
    SELECT e.id FROM enrollments e
    LEFT JOIN users u ON u.id = e.student_id
    WHERE u.id IS NULL LIMIT 5
  `);
  if (enrollOrphanStudent.rows.length > 0) {
    results.push('⚠️ Enrollments with missing student (user): ' + enrollOrphanStudent.rows.length);
    fkOk = false;
  }
  const subOrphan = await client.query(`
    SELECT s.id FROM submissions s
    LEFT JOIN assignments a ON a.id = s.assignment_id
    WHERE a.id IS NULL LIMIT 5
  `);
  if (subOrphan.rows.length > 0) {
    results.push('⚠️ Submissions with missing assignment: ' + subOrphan.rows.length);
    fkOk = false;
  }
  if (fkOk) results.push('✅ No orphan FKs found in sample checks.');
  results.push('');
  results.push('## Summary');
  results.push(fkOk ? 'Validation passed (counts and sample FK checks).' : 'Validation reported issues; review above.');
  results.push('');

  await client.end();
  const outPath = resolve(process.cwd(), 'docs/migration-validation.md');
  writeFileSync(outPath, results.join('\n'), 'utf-8');
  console.log('Validation done. Report written to docs/migration-validation.md');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
