CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  user_id UUID NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  action VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_institution ON analytics.activity_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON analytics.activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON analytics.activity_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS analytics.ai_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  action_name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  parameters JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_action_logs_institution ON analytics.ai_action_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_logs_actor ON analytics.ai_action_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_logs_created ON analytics.ai_action_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS analytics.performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL,
  "at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  weighted_final_average NUMERIC(5,2) NOT NULL,
  category_averages JSONB DEFAULT '{}',
  category_impacts JSONB DEFAULT '{}',
  consistency_index NUMERIC(5,2),
  trend_direction VARCHAR(20) CHECK (trend_direction IN ('up', 'down', 'stable'))
);

CREATE INDEX IF NOT EXISTS idx_perf_snapshots_user_group ON analytics.performance_snapshots(user_id, group_id, "at" DESC);
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_institution ON analytics.performance_snapshots(institution_id);

CREATE TABLE IF NOT EXISTS analytics.performance_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  projected_final_grade NUMERIC(5,2) NOT NULL,
  confidence_low NUMERIC(5,2) NOT NULL,
  confidence_high NUMERIC(5,2) NOT NULL,
  risk_probability_percent NUMERIC(5,2),
  method VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_perf_forecasts_user_group ON analytics.performance_forecasts(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_perf_forecasts_institution ON analytics.performance_forecasts(institution_id);

CREATE TABLE IF NOT EXISTS analytics.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL,
  "at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "level" VARCHAR(20) NOT NULL CHECK ("level" IN ('low', 'medium', 'high')),
  factors TEXT[] DEFAULT '{}',
  academic_stability_index NUMERIC(5,2),
  recovery_potential_score NUMERIC(5,2)
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_user_group ON analytics.risk_assessments(user_id, group_id, "at" DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_institution ON analytics.risk_assessments(institution_id);

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academic_periods_institution ON academic_periods(institution_id);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  internal_code VARCHAR(100),
  phone VARCHAR(50),
  date_of_birth DATE,
  consent_terms BOOLEAN DEFAULT false,
  consent_privacy BOOLEAN DEFAULT false,
  consent_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS institution_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  role_assigned VARCHAR(50) NOT NULL,
  UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_institution_codes_code ON institution_codes(code);

CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sections_institution ON sections(institution_id);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  area VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_institution ON subjects(institution_id);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  academic_period_id UUID REFERENCES academic_periods(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_institution ON groups(institution_id);
CREATE INDEX IF NOT EXISTS idx_groups_section ON groups(section_id);

CREATE TABLE IF NOT EXISTS group_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_group_subjects_group ON group_subjects(group_id);
CREATE INDEX IF NOT EXISTS idx_group_subjects_teacher ON group_subjects(teacher_id);

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  academic_period_id UUID REFERENCES academic_periods(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, group_id, academic_period_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_group ON enrollments(group_id);

CREATE TABLE IF NOT EXISTS assignment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_categories_institution ON assignment_categories(institution_id);

CREATE TABLE IF NOT EXISTS grading_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(100),
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grading_schemas_group ON grading_schemas(group_id);

CREATE TABLE IF NOT EXISTS grading_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grading_schema_id UUID NOT NULL REFERENCES grading_schemas(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  weight NUMERIC(5,2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
  sort_order INT NOT NULL DEFAULT 0,
  evaluation_type VARCHAR(50) NOT NULL DEFAULT 'summative',
  risk_impact_multiplier NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grading_categories_schema ON grading_categories(grading_schema_id);

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_subject_id UUID NOT NULL REFERENCES group_subjects(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  content_document TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  max_score NUMERIC(10,2) NOT NULL DEFAULT 100,
  assignment_category_id UUID REFERENCES grading_categories(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "type" VARCHAR(20) NOT NULL DEFAULT 'assignment' CHECK ("type" IN ('assignment', 'reminder')),
  is_gradable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_group_subject ON assignments(group_subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score NUMERIC(10,2),
  feedback TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded', 'late', 'missing', 'excused')),
  late BOOLEAN NOT NULL DEFAULT false,
  missing BOOLEAN NOT NULL DEFAULT false,
  excused BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ,
  comment TEXT,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS comment TEXT;

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);

CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  grading_category_id UUID NOT NULL REFERENCES grading_categories(id) ON DELETE CASCADE,
  score NUMERIC(10,2) NOT NULL,
  max_score NUMERIC(10,2) NOT NULL,
  normalized_score NUMERIC(5,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (assignment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_grades_assignment ON grades(assignment_id);
CREATE INDEX IF NOT EXISTS idx_grades_user ON grades(user_id);
CREATE INDEX IF NOT EXISTS idx_grades_user_group ON grades(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_grades_group ON grades(group_id);

CREATE TABLE IF NOT EXISTS grade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  grading_category_id UUID NOT NULL REFERENCES grading_categories(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  score NUMERIC(10,2) NOT NULL,
  max_score NUMERIC(10,2) NOT NULL,
  normalized_score NUMERIC(5,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_grade_events_student ON grade_events(user_id);
CREATE INDEX IF NOT EXISTS idx_grade_events_assignment ON grade_events(assignment_id);
CREATE INDEX IF NOT EXISTS idx_grade_events_institution ON grade_events(institution_id);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  group_subject_id UUID NOT NULL REFERENCES group_subjects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  period_slot VARCHAR(20),
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent')),
  punctuality VARCHAR(20) CHECK (punctuality IN ('on_time', 'late')),
  recorded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_subject_id, user_id, date, period_slot)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_group_subject ON attendance(group_subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

CREATE TABLE IF NOT EXISTS learning_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  "type" VARCHAR(50) NOT NULL CHECK ("type" IN ('pdf', 'link', 'video', 'document', 'other')),
  url TEXT,
  content TEXT,
  uploaded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_resources_institution ON learning_resources(institution_id);

CREATE TABLE IF NOT EXISTS assignment_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  "type" VARCHAR(20) NOT NULL CHECK ("type" IN ('file', 'link', 'gdoc')),
  url TEXT NOT NULL,
  file_name VARCHAR(255),
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_materials_assignment ON assignment_materials(assignment_id);

CREATE TABLE IF NOT EXISTS guardian_students (
  guardian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guardian_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_students_student ON guardian_students(student_id);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  subject VARCHAR(500) NOT NULL,
  "type" VARCHAR(50) NOT NULL CHECK ("type" IN ('colegio-padre', 'profesor-padre', 'directivo-padre', 'asistente-padre')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title VARCHAR(500),
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  "role" VARCHAR(20) NOT NULL CHECK ("role" IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  "type" VARCHAR(50) DEFAULT 'text',
  structured_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(chat_session_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  body TEXT,
  "type" VARCHAR(50) NOT NULL DEFAULT 'general',
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_institution ON announcements(institution_id);

CREATE TABLE IF NOT EXISTS announcement_recipients (
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS announcement_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) NOT NULL DEFAULT 'texto',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcement_messages_announcement ON announcement_messages(announcement_id);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  "type" VARCHAR(20) NOT NULL CHECK ("type" IN ('curso', 'colegio')),
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_institution ON events(institution_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_target ON ai_recommendations(target_user_id);

CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  context_type VARCHAR(100) NOT NULL,
  context_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_user ON ai_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_conversation ON ai_memory(conversation_id);

CREATE TABLE IF NOT EXISTS group_schedules (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  slots JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, group_id)
);

CREATE TABLE IF NOT EXISTS professor_schedules (
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slots JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, professor_id)
);

-- Evo Drive: tokens Google por usuario/institución
CREATE TABLE IF NOT EXISTS google_drive_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, institution_id)
);
CREATE INDEX IF NOT EXISTS idx_google_drive_tokens_user ON google_drive_tokens(user_id);

-- Evo Drive: archivos (materiales + Google Drive)
CREATE TABLE IF NOT EXISTS evo_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  nombre VARCHAR(500) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'file',
  origen VARCHAR(20) NOT NULL CHECK (origen IN ('material', 'google')),
  mime_type VARCHAR(200),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  curso_nombre VARCHAR(100) NOT NULL,
  propietario_id VARCHAR(255) NOT NULL,
  propietario_nombre VARCHAR(255) NOT NULL,
  propietario_rol VARCHAR(50) NOT NULL,
  es_publico BOOLEAN NOT NULL DEFAULT true,
  google_file_id VARCHAR(255),
  google_web_view_link TEXT,
  google_mime_type VARCHAR(200),
  evo_storage_key VARCHAR(500),
  evo_storage_url TEXT,
  size_bytes BIGINT,
  etiquetas TEXT[] DEFAULT '{}',
  destacado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evo_files_institution_group ON evo_files(institution_id, group_id);
CREATE INDEX IF NOT EXISTS idx_evo_files_updated ON evo_files(updated_at DESC);

-- Categorías dentro de cada curso en Evo Drive
CREATE TABLE IF NOT EXISTS evo_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evo_categories_group ON evo_categories(group_id);

ALTER TABLE evo_files ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES evo_categories(id) ON DELETE SET NULL;
