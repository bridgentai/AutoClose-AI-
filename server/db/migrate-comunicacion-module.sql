-- Módulo comunicación (padres + institucional). Ejecutar en Neon / producción.
-- NOTA: announcement_recipients ya existe en instalaciones Evo.OS (PK announcement_id, user_id). No recrear esa tabla.

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS scheduled_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_of uuid REFERENCES announcements(id),
  ADD COLUMN IF NOT EXISTS audience varchar(50) DEFAULT 'parents',
  ADD COLUMN IF NOT EXISTS category varchar(50) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS priority varchar(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS attachments_json jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ann_reads ON announcement_reads(announcement_id);
CREATE INDEX IF NOT EXISTS idx_ann_recipients ON announcement_recipients(announcement_id);
CREATE INDEX IF NOT EXISTS idx_ann_institution_type ON announcements(institution_id, type, created_at DESC);
