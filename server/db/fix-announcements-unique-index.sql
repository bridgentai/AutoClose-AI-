-- Fix: allow multiple announcements per group_subject_id (mensaje_academico, nueva_asignacion)
-- while keeping only one evo_chat thread per group_subject.
-- Run this if you get: duplicate key value violates unique constraint "idx_announcements_evo_chat"

-- 1) Drop as CONSTRAINT (si se creó con ALTER TABLE ADD CONSTRAINT)
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS idx_announcements_evo_chat;
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS idx_announcements_group_subject_evo;

-- 2) Drop as INDEX (si se creó con CREATE UNIQUE INDEX)
DROP INDEX IF EXISTS idx_announcements_evo_chat;
DROP INDEX IF EXISTS public.idx_announcements_evo_chat;
DROP INDEX IF EXISTS idx_announcements_group_subject_evo;
DROP INDEX IF EXISTS public.idx_announcements_group_subject_evo;

-- 3) Recreate as partial unique: only one evo_chat per group_subject_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_group_subject_evo
  ON announcements(group_subject_id)
  WHERE group_subject_id IS NOT NULL AND type = 'evo_chat';
