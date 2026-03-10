-- Fix: assignments.assignment_category_id should reference grading_categories (logros), not assignment_categories.
-- Run this once if you get: violates foreign key constraint "assignments_assignment_category_id_fkey"
-- Usage: psql $DATABASE_URL -f server/db/migrate-assignment-category-fk.sql

ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_assignment_category_id_fkey;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_assignment_category_id_fkey
  FOREIGN KEY (assignment_category_id) REFERENCES grading_categories(id) ON DELETE SET NULL;
