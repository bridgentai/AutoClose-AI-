-- Evo Drive: carpetas por materia (group_subject) y Mi carpeta (personal)
-- Ejecutar después de schema base.

-- 1) Archivos pueden asociarse a una materia dentro del curso (opcional)
ALTER TABLE evo_files
  ADD COLUMN IF NOT EXISTS group_subject_id UUID REFERENCES group_subjects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_evo_files_group_subject ON evo_files(group_subject_id) WHERE group_subject_id IS NOT NULL;

-- 2) Mi carpeta: archivos personales del estudiante (enlaces, refs a Google, etc.)
CREATE TABLE IF NOT EXISTS evo_personal_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  nombre VARCHAR(500) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'link',
  url TEXT,
  google_file_id VARCHAR(255),
  google_web_view_link TEXT,
  google_mime_type VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Si la tabla ya existía sin institution_id, añadir la columna (nullable para no fallar con filas existentes)
ALTER TABLE evo_personal_files
  ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_evo_personal_files_user ON evo_personal_files(user_id, institution_id);
