-- Ejecutar si la columna no existe: psql "$DATABASE_URL" -f server/db/migrate-assignments-requires-submission.sql
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS requires_submission BOOLEAN NOT NULL DEFAULT true;
UPDATE assignments SET requires_submission = false WHERE "type" = 'reminder';
