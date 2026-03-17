-- Tabla de control de accesos por institución
-- Permite al admin-general-colegio bloquear features para ciertos roles

CREATE TABLE IF NOT EXISTS access_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  feature varchar(100) NOT NULL,
  blocked_roles text[] NOT NULL DEFAULT '{}',
  reason varchar(255),
  expires_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT NOW(),
  UNIQUE (institution_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_access_controls_institution ON access_controls (institution_id);
