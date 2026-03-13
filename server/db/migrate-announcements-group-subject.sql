-- Evo Send: one chat thread per group_subject (curso + materia)
-- Run this if your announcements table was created before group_subject_id existed.
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS group_subject_id UUID REFERENCES group_subjects(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_group_subject_evo
  ON announcements(group_subject_id) WHERE group_subject_id IS NOT NULL AND type = 'evo_chat';
