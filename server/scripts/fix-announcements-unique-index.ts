/**
 * Fix announcements unique index: allow multiple announcements per group_subject_id
 * (mensaje_academico, nueva_asignacion) while keeping one evo_chat per group_subject.
 * Run: npm run migrate:fix-announcements
 */
import '../config/env.js';
import { queryPg } from '../config/db-pg.js';

async function run() {
  console.log('Aplicando fix de índice único en announcements...');
  // Drop as CONSTRAINT (por si se creó con ALTER TABLE ADD CONSTRAINT)
  await queryPg('ALTER TABLE announcements DROP CONSTRAINT IF EXISTS idx_announcements_evo_chat');
  await queryPg('ALTER TABLE announcements DROP CONSTRAINT IF EXISTS idx_announcements_group_subject_evo');
  // Drop as INDEX (por si se creó con CREATE UNIQUE INDEX)
  await queryPg('DROP INDEX IF EXISTS idx_announcements_evo_chat');
  await queryPg('DROP INDEX IF EXISTS public.idx_announcements_evo_chat');
  await queryPg('DROP INDEX IF EXISTS idx_announcements_group_subject_evo');
  await queryPg('DROP INDEX IF EXISTS public.idx_announcements_group_subject_evo');
  // Recreate partial unique (solo un evo_chat por group_subject_id)
  await queryPg(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_group_subject_evo
    ON announcements(group_subject_id)
    WHERE group_subject_id IS NOT NULL AND type = 'evo_chat'
  `);
  console.log('Listo. Ya puedes enviar mensajes académicos sin error de clave duplicada.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
