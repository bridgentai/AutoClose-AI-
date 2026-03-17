-- display_name e icon personalizables por materia (group_subjects)
ALTER TABLE group_subjects
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS icon VARCHAR(32);
