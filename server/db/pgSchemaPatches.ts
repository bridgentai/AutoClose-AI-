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

let evoFilesStaffOnlyEnsured = false;

/** Materiales de curso solo para docentes (no visibles para estudiantes/padres). */
export async function ensureEvoFilesStaffOnlyColumn(): Promise<void> {
  if (evoFilesStaffOnlyEnsured) return;
  await queryPg(
    `ALTER TABLE evo_files ADD COLUMN IF NOT EXISTS staff_only BOOLEAN NOT NULL DEFAULT false`
  );
  evoFilesStaffOnlyEnsured = true;
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

let assignmentsAcademicTermEnsured = false;

/** Trimestre académico (1–3) para filtrar notas por período. */
export async function ensureAssignmentsAcademicTermColumn(): Promise<void> {
  if (assignmentsAcademicTermEnsured) return;
  await queryPg(
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS academic_term INTEGER NOT NULL DEFAULT 1`
  );
  await queryPg(
    `ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_academic_term_check`
  );
  await queryPg(
    `ALTER TABLE assignments ADD CONSTRAINT assignments_academic_term_check CHECK (academic_term >= 1 AND academic_term <= 3)`
  );
  assignmentsAcademicTermEnsured = true;
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

let studentActivityTableEnsured = false;

/** Tabla de tracking de actividad estudiantil (vistas de tareas, Evo Send, etc.). */
export async function ensureStudentActivityTable(): Promise<void> {
  if (studentActivityTableEnsured) return;
  await queryPg(`
    CREATE TABLE IF NOT EXISTS student_activity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID NOT NULL,
      action VARCHAR(50) NOT NULL,
      metadata JSONB,
      duration_seconds INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_student_activity_student ON student_activity(student_id, created_at DESC)`
  );
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_student_activity_entity ON student_activity(entity_type, entity_id, created_at DESC)`
  );
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_student_activity_institution ON student_activity(institution_id, created_at DESC)`
  );
  studentActivityTableEnsured = true;
  console.log('[pgSchemaPatches] student_activity OK');
}

let gradingOutcomesEnsured = false;

/** Logros (párrafo + peso en curso) e indicadores (grading_categories) anidados por logro. */
export async function ensureGradingOutcomesTable(): Promise<void> {
  if (gradingOutcomesEnsured) return;
  await queryPg(`
    CREATE TABLE IF NOT EXISTS grading_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      grading_schema_id UUID NOT NULL REFERENCES grading_schemas(id) ON DELETE CASCADE,
      institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      description TEXT NOT NULL DEFAULT '',
      weight NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (weight >= 0 AND weight <= 100),
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_grading_outcomes_schema ON grading_outcomes(grading_schema_id)`
  );
  await queryPg(`ALTER TABLE grading_categories ADD COLUMN IF NOT EXISTS grading_outcome_id UUID`);

  await queryPg(`
    INSERT INTO grading_outcomes (grading_schema_id, institution_id, description, weight, sort_order)
    SELECT DISTINCT gs.id, gs.institution_id, '', 100, 0
    FROM grading_schemas gs
    WHERE EXISTS (
      SELECT 1 FROM grading_categories gc
      WHERE gc.grading_schema_id = gs.id AND gc.grading_outcome_id IS NULL
    )
    AND NOT EXISTS (SELECT 1 FROM grading_outcomes go WHERE go.grading_schema_id = gs.id)
  `);

  await queryPg(`
    UPDATE grading_categories gc
    SET grading_outcome_id = (
      SELECT go.id FROM grading_outcomes go
      WHERE go.grading_schema_id = gc.grading_schema_id
      ORDER BY go.sort_order, go.created_at
      LIMIT 1
    )
    WHERE gc.grading_outcome_id IS NULL
      AND EXISTS (
        SELECT 1 FROM grading_outcomes go2 WHERE go2.grading_schema_id = gc.grading_schema_id
      )
  `);

  try {
    await queryPg(`
      ALTER TABLE grading_categories
      ADD CONSTRAINT grading_categories_grading_outcome_id_fkey
      FOREIGN KEY (grading_outcome_id) REFERENCES grading_outcomes(id) ON DELETE CASCADE
    `);
  } catch {
    /* constraint ya existe */
  }

  gradingOutcomesEnsured = true;
  console.log('[pgSchemaPatches] grading_outcomes + grading_categories.grading_outcome_id OK');
}

let comunicacionModuleEnsured = false;

/** Comunicados a padres + institucionales: columnas announcements, announcement_reads, índices. */
export async function ensureComunicacionModule(): Promise<void> {
  if (comunicacionModuleEnsured) return;
  await queryPg(`
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
      ADD COLUMN IF NOT EXISTS attachments_json jsonb DEFAULT '[]'::jsonb
  `);
  await queryPg(`
    CREATE TABLE IF NOT EXISTS announcement_reads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(announcement_id, user_id)
    )
  `);
  await queryPg(`CREATE INDEX IF NOT EXISTS idx_ann_reads ON announcement_reads(announcement_id)`);
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_ann_recipients ON announcement_recipients(announcement_id)`
  );
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_ann_institution_type ON announcements(institution_id, type, created_at DESC)`
  );
  comunicacionModuleEnsured = true;
  console.log('[schema] comunicación (announcements extendido + announcement_reads) OK');
}
