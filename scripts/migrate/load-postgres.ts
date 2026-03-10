/**
 * Phase 2 - Load transformed JSON into PostgreSQL.
 * Requires: schema applied (server/db/schema.sql), DATABASE_URL in .env.
 * Run: npx tsx scripts/migrate/load-postgres.ts
 */

import { resolve } from 'path';
import { readFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL in .env');
  process.exit(1);
}

const OUT_DIR = resolve(process.cwd(), 'scripts/migrate/out');

function loadJson<T = unknown>(name: string): T[] {
  try {
    const raw = readFileSync(resolve(OUT_DIR, `${name}.json`), 'utf-8');
    return JSON.parse(raw) as T[];
  } catch (e) {
    console.warn(`No file or invalid JSON: ${name}.json`, (e as Error).message);
    return [];
  }
}

type Row = Record<string, unknown>;

function run() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  const insert = async (table: string, rows: Row[], columns: string[]) => {
    const pk = columns[0];
    const valid = rows.filter((r) => r[pk] != null && r[pk] !== '');
    if (valid.length === 0) return;
    const cols = columns.join(', ');
    const placeholders = valid.map((_, i) => {
      const start = i * columns.length + 1;
      return `(${columns.map((_, j) => `$${start + j}`).join(', ')})`;
    }).join(', ');
    const values = valid.flatMap((r) => columns.map((c) => (r[c] === '' ? null : r[c] ?? null)));
    const q = `INSERT INTO ${table} (${cols}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
    await client.query(q, values);
    console.log(`  ${table}: ${valid.length} rows`);
  };

  (async () => {
    await client.connect();
    console.log('Loading into PostgreSQL (FK order)...\n');

    const institutions = loadJson<Row>('institutions');
    const users = loadJson<Row>('users');
    const groups = loadJson<Row>('groups');
    const subjects = loadJson<Row>('subjects');
    const groupSubjectsRaw = loadJson<Row>('group_subjects');
    const validInstitutionIds = new Set(institutions.filter((r) => r.id).map((r) => r.id));
    const validUserIds = new Set(users.filter((r) => r.id && validInstitutionIds.has(r.institution_id)).map((r) => r.id));
    const validSubjectIds = new Set(subjects.filter((r) => r.id && validInstitutionIds.has(r.institution_id)).map((r) => r.id));

    await insert('institutions', institutions, ['id', 'name', 'slug', 'settings', 'created_at', 'updated_at']);
    const sections = loadJson<Row>('sections').filter((r) => validInstitutionIds.has(r.institution_id));
    const validSectionIds = new Set(sections.filter((r) => r.id).map((r) => r.id));
    await insert('academic_periods', loadJson<Row>('academic_periods').filter((r) => validInstitutionIds.has(r.institution_id)), ['id', 'institution_id', 'name', 'start_date', 'end_date', 'is_active', 'created_at']);
    await insert('users', users.filter((r) => validInstitutionIds.has(r.institution_id)), ['id', 'institution_id', 'email', 'password_hash', 'full_name', 'role', 'status', 'internal_code', 'phone', 'date_of_birth', 'consent_terms', 'consent_privacy', 'consent_at', 'config', 'created_at', 'updated_at']);
    await insert('institution_codes', loadJson<Row>('institution_codes').filter((r) => validInstitutionIds.has(r.institution_id)), ['id', 'institution_id', 'code', 'role_assigned']);
    await insert('sections', sections, ['id', 'institution_id', 'name', 'created_at', 'updated_at']);
    await insert('subjects', subjects.filter((r) => validInstitutionIds.has(r.institution_id)), ['id', 'institution_id', 'name', 'description', 'area', 'created_at', 'updated_at']);
    const groupsValid = groups.filter((r) => r.id && validInstitutionIds.has(r.institution_id) && validSectionIds.has(r.section_id));
    const validGroupIds = new Set(groupsValid.map((r) => r.id));
    await insert('groups', groupsValid, ['id', 'institution_id', 'section_id', 'name', 'description', 'academic_period_id', 'created_at', 'updated_at']);
    const groupSubjectsValid = groupSubjectsRaw.filter((r) => r.id && r.institution_id && validInstitutionIds.has(r.institution_id) && validGroupIds.has(r.group_id) && validSubjectIds.has(r.subject_id) && validUserIds.has(r.teacher_id));
    const validGroupSubjectIds = new Set(groupSubjectsValid.map((r) => r.id));
    await insert('group_subjects', groupSubjectsValid, ['id', 'institution_id', 'group_id', 'subject_id', 'teacher_id', 'created_at']);
    await insert('enrollments', loadJson<Row>('enrollments').filter((r) => validUserIds.has(r.student_id) && validGroupIds.has(r.group_id)), ['id', 'student_id', 'group_id', 'academic_period_id', 'created_at']);
    await insert('assignment_categories', loadJson<Row>('assignment_categories').filter((r) => validInstitutionIds.has(r.institution_id)), ['id', 'institution_id', 'name', 'created_at']);
    const gradingSchemasRaw = loadJson<Row>('grading_schemas').filter((r) => r.group_id && validGroupIds.has(r.group_id) && validInstitutionIds.has(r.institution_id));
    const validGradingSchemaIds = new Set(gradingSchemasRaw.map((r) => r.id));
    const gradingCategoriesRaw = loadJson<Row>('grading_categories').filter((r) => validGradingSchemaIds.has(r.grading_schema_id) && validInstitutionIds.has(r.institution_id));
    const validGradingCategoryIds = new Set(gradingCategoriesRaw.map((r) => r.id));
    await insert('grading_schemas', gradingSchemasRaw, ['id', 'group_id', 'institution_id', 'name', 'version', 'is_active', 'created_at', 'updated_at']);
    await insert('grading_categories', gradingCategoriesRaw, ['id', 'grading_schema_id', 'institution_id', 'name', 'weight', 'sort_order', 'evaluation_type', 'risk_impact_multiplier', 'created_at', 'updated_at']);
    const validAssignments = loadJson<Row>('assignments').filter((r) => r.group_subject_id && validGroupSubjectIds.has(r.group_subject_id) && r.created_by && validUserIds.has(r.created_by));
    const validAssignmentIds = new Set(validAssignments.map((r) => r.id));
    await insert('assignments', validAssignments, ['id', 'group_subject_id', 'title', 'description', 'content_document', 'due_date', 'max_score', 'assignment_category_id', 'created_by', 'type', 'is_gradable', 'created_at']);
    await insert('submissions', loadJson<Row>('submissions').filter((r) => validAssignmentIds.has(r.assignment_id) && validUserIds.has(r.student_id)), ['id', 'assignment_id', 'student_id', 'score', 'feedback', 'status', 'late', 'missing', 'excused', 'submitted_at', 'attachments', 'created_at', 'updated_at']);
    await insert('grades', loadJson<Row>('grades').filter((r) => validAssignmentIds.has(r.assignment_id) && validUserIds.has(r.user_id) && validGroupIds.has(r.group_id) && validGradingCategoryIds.has(r.grading_category_id) && validUserIds.has(r.recorded_by_id)), ['id', 'assignment_id', 'user_id', 'group_id', 'grading_category_id', 'score', 'max_score', 'normalized_score', 'recorded_at', 'recorded_by_id']);
    await insert('grade_events', loadJson<Row>('grade_events').filter((r) => validAssignmentIds.has(r.assignment_id) && validUserIds.has(r.user_id) && validGroupIds.has(r.group_id) && validGradingCategoryIds.has(r.grading_category_id) && validInstitutionIds.has(r.institution_id) && validUserIds.has(r.recorded_by_id)), ['id', 'assignment_id', 'user_id', 'group_id', 'grading_category_id', 'institution_id', 'score', 'max_score', 'normalized_score', 'recorded_at', 'recorded_by_id']);
    await insert('attendance', loadJson<Row>('attendance').filter((r) => r.group_subject_id && validGroupSubjectIds.has(r.group_subject_id) && validUserIds.has(r.user_id) && validInstitutionIds.has(r.institution_id)).map((r) => ({
      ...r,
      recorded_by_id: r.recorded_by_id && validUserIds.has(r.recorded_by_id) ? r.recorded_by_id : null,
    })), ['id', 'institution_id', 'group_subject_id', 'user_id', 'date', 'period_slot', 'status', 'punctuality', 'recorded_by_id', 'created_at']);
    await insert('learning_resources', loadJson<Row>('learning_resources').filter((r) => validInstitutionIds.has(r.institution_id)).map((r) => ({
      ...r,
      subject_id: r.subject_id && validSubjectIds.has(r.subject_id) ? r.subject_id : null,
      group_id: r.group_id && validGroupIds.has(r.group_id) ? r.group_id : null,
      uploaded_by_id: r.uploaded_by_id && validUserIds.has(r.uploaded_by_id) ? r.uploaded_by_id : null,
    })), ['id', 'institution_id', 'subject_id', 'group_id', 'title', 'description', 'type', 'url', 'content', 'uploaded_by_id', 'created_at']);
    await insert('assignment_materials', loadJson<Row>('assignment_materials').filter((r) => validAssignmentIds.has(r.assignment_id)), ['id', 'assignment_id', 'type', 'url', 'file_name', 'mime_type', 'uploaded_at']);
    const gs = loadJson<Row>('guardian_students').filter((r) => validUserIds.has(r.guardian_id) && validUserIds.has(r.student_id) && validInstitutionIds.has(r.institution_id));
    for (const r of gs) {
      await client.query(
        'INSERT INTO guardian_students (guardian_id, student_id, institution_id, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [r.guardian_id, r.student_id, r.institution_id, r.created_at]
      );
    }
    if (gs.length) console.log('  guardian_students:', gs.length, 'rows');
    const conversationsRaw = loadJson<Row>('conversations').filter((r) => validInstitutionIds.has(r.institution_id) && r.created_by && validUserIds.has(r.created_by));
    const validConversationIds = new Set(conversationsRaw.filter((r) => r.id).map((r) => r.id));
    await insert('conversations', conversationsRaw, ['id', 'institution_id', 'subject', 'type', 'created_by', 'created_at']);
    await insert('messages', loadJson<Row>('messages').filter((m) => m.conversation_id && validConversationIds.has(m.conversation_id) && m.sender_id && validUserIds.has(m.sender_id)), ['id', 'conversation_id', 'sender_id', 'text', 'attachments', 'read_at', 'created_at']);
    const chatSessionsRaw = loadJson<Row>('chat_sessions').filter((r) => validInstitutionIds.has(r.institution_id)).map((r) => ({
      ...r,
      created_by_id: r.created_by_id && validUserIds.has(r.created_by_id) ? r.created_by_id : null,
      group_id: r.group_id && validGroupIds.has(r.group_id) ? r.group_id : null,
    }));
    const validChatSessionIds = new Set(chatSessionsRaw.filter((r) => r.id).map((r) => r.id));
    await insert('chat_sessions', chatSessionsRaw, ['id', 'institution_id', 'title', 'created_by_id', 'group_id', 'created_at', 'updated_at']);
    await insert('chat_messages', loadJson<Row>('chat_messages').filter((r) => r.chat_session_id && validChatSessionIds.has(r.chat_session_id)).map((r) => ({
      ...r,
      user_id: r.user_id && validUserIds.has(r.user_id) ? r.user_id : null,
    })), ['id', 'chat_session_id', 'user_id', 'role', 'content', 'type', 'structured_data', 'created_at']);
    await insert('notifications', loadJson<Row>('notifications').filter((r) => validInstitutionIds.has(r.institution_id) && r.user_id && validUserIds.has(r.user_id)), ['id', 'institution_id', 'user_id', 'title', 'body', 'read_at', 'created_at']);
    const announcementsRaw = loadJson<Row>('announcements')
      .filter((r) => validInstitutionIds.has(r.institution_id) && r.created_by_id && validUserIds.has(r.created_by_id))
      .map((r) => ({
        ...r,
        assignment_id: r.assignment_id && validAssignmentIds.has(r.assignment_id) ? r.assignment_id : null,
        group_id: r.group_id && validGroupIds.has(r.group_id) ? r.group_id : null,
      }));
    const validAnnouncementIds = new Set(announcementsRaw.filter((r) => r.id).map((r) => r.id));
    await insert('announcements', announcementsRaw, ['id', 'institution_id', 'title', 'body', 'type', 'group_id', 'assignment_id', 'created_by_id', 'published_at', 'created_at', 'updated_at']);
    await insert('announcement_messages', loadJson<Row>('announcement_messages').filter((r) => validAnnouncementIds.has(r.announcement_id) && validUserIds.has(r.sender_id)), ['id', 'announcement_id', 'sender_id', 'sender_role', 'content', 'content_type', 'priority', 'created_at']);
    await insert('events', loadJson<Row>('events').filter((r) => validInstitutionIds.has(r.institution_id)).map((r) => ({
      ...r,
      group_id: r.group_id && validGroupIds.has(r.group_id) ? r.group_id : null,
      created_by_id: r.created_by_id && validUserIds.has(r.created_by_id) ? r.created_by_id : null,
    })), ['id', 'institution_id', 'title', 'description', 'date', 'type', 'group_id', 'created_by_id', 'created_at']);
    await insert('analytics.performance_snapshots', loadJson<Row>('analytics_performance_snapshots').filter((r) => validInstitutionIds.has(r.institution_id) && validUserIds.has(r.user_id) && validGroupIds.has(r.group_id)), ['id', 'institution_id', 'user_id', 'group_id', 'at', 'weighted_final_average', 'category_averages', 'category_impacts', 'consistency_index', 'trend_direction']);
    await insert('analytics.performance_forecasts', loadJson<Row>('analytics_performance_forecasts').filter((r) => validInstitutionIds.has(r.institution_id) && validUserIds.has(r.user_id) && validGroupIds.has(r.group_id)), ['id', 'institution_id', 'user_id', 'group_id', 'generated_at', 'projected_final_grade', 'confidence_low', 'confidence_high', 'risk_probability_percent', 'method']);
    await insert('analytics.risk_assessments', loadJson<Row>('analytics_risk_assessments').filter((r) => validInstitutionIds.has(r.institution_id) && validUserIds.has(r.user_id) && validGroupIds.has(r.group_id)), ['id', 'institution_id', 'user_id', 'group_id', 'at', 'level', 'factors', 'academic_stability_index', 'recovery_potential_score']);
    await insert('analytics.ai_action_logs', loadJson<Row>('analytics_ai_action_logs').filter((r) => validInstitutionIds.has(r.institution_id) && validUserIds.has(r.actor_user_id)), ['id', 'institution_id', 'actor_user_id', 'actor_role', 'action_name', 'entity_type', 'entity_id', 'parameters', 'result', 'status', 'created_at']);

    const groupSchedulesRaw = loadJson<Row>('group_schedules').filter((r) => validInstitutionIds.has(r.institution_id) && validGroupIds.has(r.group_id));
    for (const r of groupSchedulesRaw) {
      await client.query(
        `INSERT INTO group_schedules (institution_id, group_id, slots, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (institution_id, group_id) DO UPDATE SET slots = $3, updated_at = $4`,
        [r.institution_id, r.group_id, JSON.stringify(r.slots ?? {}), r.updated_at ?? new Date().toISOString()]
      );
    }
    if (groupSchedulesRaw.length) console.log('  group_schedules:', groupSchedulesRaw.length, 'rows');

    const professorSchedulesRaw = loadJson<Row>('professor_schedules').filter((r) => validInstitutionIds.has(r.institution_id) && validUserIds.has(r.professor_id));
    for (const r of professorSchedulesRaw) {
      await client.query(
        `INSERT INTO professor_schedules (institution_id, professor_id, slots, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (institution_id, professor_id) DO UPDATE SET slots = $3, updated_at = $4`,
        [r.institution_id, r.professor_id, JSON.stringify(r.slots ?? {}), r.updated_at ?? new Date().toISOString()]
      );
    }
    if (professorSchedulesRaw.length) console.log('  professor_schedules:', professorSchedulesRaw.length, 'rows');

    console.log('\nLoad done.');
    await client.end();
    process.exit(0);
  })().catch(async (err) => {
    console.error(err);
    await client.end().catch(() => {});
    process.exit(1);
  });
}

run();
