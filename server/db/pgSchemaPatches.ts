/**
 * Parches idempotentes al esquema PG para entornos que no ejecutaron migraciones SQL a mano.
 */
import { queryPg } from '../config/db-pg.js';

let assignmentsRequiresSubmissionEnsured = false;

/** Asegura columna assignments.requires_submission (evita 500 al crear asignaciones). */
export async function ensureAssignmentsRequiresSubmissionColumn(): Promise<void> {
  if (assignmentsRequiresSubmissionEnsured) return;
  await queryPg(
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS requires_submission BOOLEAN NOT NULL DEFAULT true`
  );
  await queryPg(
    `UPDATE assignments SET requires_submission = false WHERE "type" = 'reminder'`
  );
  assignmentsRequiresSubmissionEnsured = true;
}

let assignmentCategoryFkPatched = false;

/**
 * Logros viven en grading_categories. Si la FK antigua apuntaba a assignment_categories,
 * el INSERT falla al crear asignaciones con logroCalificacionId.
 */
export async function ensureAssignmentCategoryFkReferencesGradingCategories(): Promise<void> {
  if (assignmentCategoryFkPatched) return;
  try {
    await queryPg(`
      UPDATE assignments a
      SET assignment_category_id = NULL
      WHERE a.assignment_category_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM grading_categories gc WHERE gc.id = a.assignment_category_id)
    `);
    await queryPg(`
      ALTER TABLE assignments
      DROP CONSTRAINT IF EXISTS assignments_assignment_category_id_fkey
    `);
    await queryPg(`
      ALTER TABLE assignments
      ADD CONSTRAINT assignments_assignment_category_id_fkey
      FOREIGN KEY (assignment_category_id) REFERENCES grading_categories(id) ON DELETE SET NULL
    `);
    assignmentCategoryFkPatched = true;
    console.log('[schema] assignments.assignment_category_id → grading_categories OK');
  } catch (e) {
    console.warn(
      '[schema] FK assignment_category_id (puede ya estar correcta):',
      (e as Error).message
    );
    assignmentCategoryFkPatched = true;
  }
}

let evoSendSchemaEnsured = false;

/** Soporte 1-1 + lecturas Evo Send. */
export async function ensureEvoSendSupportAndReads(): Promise<void> {
  if (evoSendSchemaEnsured) return;
  await queryPg(
    `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS support_staff_id UUID REFERENCES users(id) ON DELETE SET NULL`
  );
  await queryPg(`
    CREATE TABLE IF NOT EXISTS evo_thread_reads (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, announcement_id)
    )`);
  evoSendSchemaEnsured = true;
}

let evoChatGroupTeacherIndexEnsured = false;

/** Un solo evo_chat por (institución, grupo, profesor) cuando no hay materia. */
export async function ensureEvoChatGroupTeacherUniqueIndex(): Promise<void> {
  if (evoChatGroupTeacherIndexEnsured) return;
  await queryPg(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_evo_chat_group_teacher
    ON announcements (institution_id, group_id, created_by_id)
    WHERE type = 'evo_chat' AND group_subject_id IS NULL`);
  evoChatGroupTeacherIndexEnsured = true;
}

let evoFilesOrigenCheckEnsured = false;

/**
 * Algunos entornos legacy tienen un CHECK distinto en evo_files.origen.
 * Asegura que permita los valores actuales ('material', 'google').
 */
export async function ensureEvoFilesOrigenCheck(): Promise<void> {
  if (evoFilesOrigenCheckEnsured) return;
  try {
    await queryPg(`ALTER TABLE evo_files DROP CONSTRAINT IF EXISTS evo_files_origen_check`);
  } catch {
    /* ignore */
  }
  await queryPg(
    `ALTER TABLE evo_files
     ADD CONSTRAINT evo_files_origen_check CHECK (origen IN ('material', 'google'))`
  );
  evoFilesOrigenCheckEnsured = true;
}

let assignmentsCategoryWeightPctEnsured = false;

/** Peso opcional de la tarea dentro del logro (p. ej. 40, 35, 25). Si todas tienen valor, el promedio del logro los respeta. */
export async function ensureAssignmentsCategoryWeightPctColumn(): Promise<void> {
  if (assignmentsCategoryWeightPctEnsured) return;
  await queryPg(
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS category_weight_pct NUMERIC(5,2) NULL`
  );
  assignmentsCategoryWeightPctEnsured = true;
}

let auditLogIpColumnsEnsured = false;

/** Columnas ip_address en tablas de auditoría (analytics). */
export async function ensureAuditLogIpColumns(): Promise<void> {
  if (auditLogIpColumnsEnsured) return;
  await queryPg(
    `ALTER TABLE analytics.activity_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) DEFAULT NULL`
  );
  await queryPg(
    `ALTER TABLE analytics.ai_action_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) DEFAULT NULL`
  );
  await queryPg(`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_ip
    ON analytics.activity_logs(ip_address)
    WHERE ip_address IS NOT NULL
  `);
  auditLogIpColumnsEnsured = true;
}

/** Elimina registros de auditoría muy antiguos al arrancar (minimización de datos). */
export async function ensureAuditLogRetentionPolicy(): Promise<void> {
  try {
    await queryPg(`
      DELETE FROM analytics.activity_logs
      WHERE created_at < NOW() - INTERVAL '365 days'
    `);

    await queryPg(`
      DELETE FROM analytics.ai_action_logs
      WHERE created_at < NOW() - INTERVAL '365 days'
    `);

    console.log('[pgSchemaPatches] Retención de logs: registros > 365 días eliminados.');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pgSchemaPatches] Error en retención de logs:', msg);
  }
}

let evoSendRetentionEnsured = false;

/** Columna derivada de retención mínima (365 días desde created_at) en mensajes EvoSend. */
export async function ensureEvoSendRetention(): Promise<void> {
  if (evoSendRetentionEnsured) return;
  try {
    await queryPg(`
      ALTER TABLE announcement_messages
      ADD COLUMN retention_until TIMESTAMPTZ
      GENERATED ALWAYS AS (created_at + INTERVAL '365 days') STORED
    `);
    console.log('[pgSchemaPatches] EvoSend retention_until (generated) OK');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already exists') || msg.includes('duplicate column')) {
      evoSendRetentionEnsured = true;
      return;
    }
    try {
      await queryPg(`ALTER TABLE announcement_messages ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ`);
      await queryPg(`
        UPDATE announcement_messages
        SET retention_until = created_at + INTERVAL '365 days'
        WHERE retention_until IS NULL
      `);
      console.log('[pgSchemaPatches] EvoSend retention_until (backfill) OK');
    } catch (e2: unknown) {
      const m2 = e2 instanceof Error ? e2.message : String(e2);
      console.warn('[pgSchemaPatches] EvoSend retention:', m2);
    }
  }
  evoSendRetentionEnsured = true;
}
