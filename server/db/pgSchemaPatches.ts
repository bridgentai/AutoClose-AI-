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
  await queryPg(`
    CREATE TABLE IF NOT EXISTS evo_send_message_user_state (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id UUID NOT NULL REFERENCES announcement_messages(id) ON DELETE CASCADE,
      institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      trashed_at TIMESTAMPTZ,
      starred_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, message_id)
    )`);
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_evo_send_msg_state_inst_user ON evo_send_message_user_state(institution_id, user_id)`
  );
  evoSendSchemaEnsured = true;
}

let evoChatSectionDirectorIndexEnsured = false;

/** Un hilo evo_chat_section_director por (institución, grupo). */
export async function ensureEvoChatSectionDirectorUniqueIndex(): Promise<void> {
  if (evoChatSectionDirectorIndexEnsured) return;
  await queryPg(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_evo_chat_section_director_group
    ON announcements (institution_id, group_id)
    WHERE type = 'evo_chat_section_director' AND group_id IS NOT NULL`);
  evoChatSectionDirectorIndexEnsured = true;
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
let assignmentsAcademicTermEnsurePromise: Promise<void> | null = null;

/** Trimestre académico (1–3) para filtrar notas por período. */
export async function ensureAssignmentsAcademicTermColumn(): Promise<void> {
  if (assignmentsAcademicTermEnsured) return;
  if (assignmentsAcademicTermEnsurePromise) {
    await assignmentsAcademicTermEnsurePromise;
    return;
  }

  assignmentsAcademicTermEnsurePromise = (async () => {
    await queryPg(
      `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS academic_term INTEGER NOT NULL DEFAULT 1`
    );
    await queryPg(
      `ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_academic_term_check`
    );
    await queryPg(`
      DO $$
      BEGIN
        ALTER TABLE assignments
          ADD CONSTRAINT assignments_academic_term_check
          CHECK (academic_term >= 1 AND academic_term <= 3);
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    assignmentsAcademicTermEnsured = true;
  })();

  try {
    await assignmentsAcademicTermEnsurePromise;
  } finally {
    assignmentsAcademicTermEnsurePromise = null;
  }
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

let kiwiSchemaEnsured = false;

/**
 * Asegura el schema completo de Kiwi:
 * - tokens_used en chat_messages
 * - Columnas user_role, memory_summary, key_facts, updated_at en ai_memory
 * - Relaja conversation_id NOT NULL en ai_memory
 * - Crea tablas anon_tokens y kiwi_tool_calls
 */
export async function ensureKiwiSchema(): Promise<void> {
  if (kiwiSchemaEnsured) return;

  // chat_messages: tokens_used
  await queryPg(
    `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER`
  );

  // ai_memory: columnas Kiwi + relajar FK conversation_id
  await queryPg(
    `ALTER TABLE ai_memory ADD COLUMN IF NOT EXISTS user_role VARCHAR(50)`
  );
  await queryPg(
    `ALTER TABLE ai_memory ADD COLUMN IF NOT EXISTS memory_summary TEXT`
  );
  await queryPg(
    `ALTER TABLE ai_memory ADD COLUMN IF NOT EXISTS key_facts JSONB DEFAULT '[]'`
  );
  await queryPg(
    `ALTER TABLE ai_memory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`
  );
  await queryPg(
    `ALTER TABLE ai_memory ALTER COLUMN conversation_id DROP NOT NULL`
  );
  await queryPg(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_memory_user_role
     ON ai_memory(user_id, user_role) WHERE user_role IS NOT NULL`
  );

  // anon_tokens
  await queryPg(`
    CREATE TABLE IF NOT EXISTS anon_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      real_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      anon_token VARCHAR(64) NOT NULL,
      chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(institution_id, anon_token)
    )
  `);
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_anon_tokens_token ON anon_tokens(institution_id, anon_token)`
  );

  // kiwi_tool_calls
  await queryPg(`
    CREATE TABLE IF NOT EXISTS kiwi_tool_calls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
      user_role VARCHAR(50),
      tool_name VARCHAR(100) NOT NULL,
      tool_input JSONB DEFAULT '{}',
      tool_output JSONB DEFAULT '{}',
      success BOOLEAN NOT NULL DEFAULT true,
      execution_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_kiwi_tool_calls_session ON kiwi_tool_calls(chat_session_id)`
  );
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_kiwi_tool_calls_institution ON kiwi_tool_calls(institution_id, created_at DESC)`
  );

  kiwiSchemaEnsured = true;
  console.log('[schema] kiwi_schema OK');
}

let usersSectionIdEnsured = false;

/** Adds section_id to users table for directivo section isolation. */
export async function ensureUsersSectionId(): Promise<void> {
  if (usersSectionIdEnsured) return;
  await queryPg(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id) ON DELETE SET NULL`
  );
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_users_section ON users(section_id)`
  );
  usersSectionIdEnsured = true;
  console.log('[schema] users.section_id OK');
}

let eventsSourceAnnouncementEnsured = false;

/** Vincula eventos institucionales al comunicado EvoSend que los originó (cancelación limpia el evento). */
export async function ensureEventsSourceAnnouncementId(): Promise<void> {
  if (eventsSourceAnnouncementEnsured) return;
  await queryPg(
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS source_announcement_id UUID REFERENCES announcements(id) ON DELETE SET NULL`
  );
  await queryPg(
    `CREATE INDEX IF NOT EXISTS idx_events_source_announcement ON events(source_announcement_id) WHERE source_announcement_id IS NOT NULL`
  );
  eventsSourceAnnouncementEnsured = true;
  console.log('[schema] events.source_announcement_id OK');
}

let disciplinaryOccurredAtEnsured = false;

/** Fecha/hora del hecho (distinta del registro en sistema). */
export async function ensureDisciplinaryActionsOccurredAt(): Promise<void> {
  if (disciplinaryOccurredAtEnsured) return;
  await queryPg(`ALTER TABLE disciplinary_actions ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ`);
  await queryPg(`UPDATE disciplinary_actions SET occurred_at = created_at WHERE occurred_at IS NULL`);
  try {
    await queryPg(
      `ALTER TABLE disciplinary_actions ALTER COLUMN occurred_at SET DEFAULT now()`
    );
  } catch {
    /* ignore */
  }
  try {
    await queryPg(
      `ALTER TABLE disciplinary_actions ALTER COLUMN occurred_at SET NOT NULL`
    );
  } catch {
    /* ignore */
  }
  disciplinaryOccurredAtEnsured = true;
  console.log('[schema] disciplinary_actions.occurred_at OK');
}

let communicationLegacyCleanupEnsured = false;

/** Limpieza de artefactos legacy de comunicación ya no usados por el modelo actual. */
export async function ensureCommunicationLegacyCleanup(): Promise<void> {
  if (communicationLegacyCleanupEnsured) return;
  await queryPg(`ALTER TABLE messages DROP COLUMN IF EXISTS grupo_chat_id`);
  await queryPg(`ALTER TABLE messages DROP COLUMN IF EXISTS sender_name`);
  await queryPg(`ALTER TABLE messages DROP COLUMN IF EXISTS content`);
  await queryPg(`DROP TABLE IF EXISTS grupo_chat_members`);
  await queryPg(`DROP TABLE IF EXISTS grupo_chats`);
  await queryPg(`DROP TABLE IF EXISTS playing_with_neon`);
  communicationLegacyCleanupEnsured = true;
  console.log('[schema] communication legacy cleanup OK');
}
