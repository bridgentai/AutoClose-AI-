-- Añade la columna comment a submissions para el comentario opcional del estudiante al entregar.
-- Ejecutar si aparece: column "comment" of relation "submissions" does not exist
-- Uso: psql "$DATABASE_URL" -f server/db/migrate-submissions-comment.sql

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS comment TEXT;
