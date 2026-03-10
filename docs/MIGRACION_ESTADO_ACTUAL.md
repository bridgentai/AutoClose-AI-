# Estado actual de migración a PostgreSQL

> Actualizado: 2025-03-09. Documento de auditoría tras migrar logros de calificación.

## Rutas completamente migradas (usan PG)

| Ruta | Archivo | Estado |
|------|---------|--------|
| **auth** | auth.ts | Login, register, Google OAuth, syncStudentToGroup |
| **courses** | courses.ts | GET /, for-group, by-name, academic-groups, :id/details, grading-schema, POST/PUT assign-professor, enroll-students, etc. |
| **assignments** | assignments.ts | CRUD, listados, grade, submissions |
| **users** | users.ts | me, by-role, hijos, create, bulk, vinculaciones, etc. |
| **groups** | groups.ts | all, :id, :groupId/students, sync-students, assign-student |
| **sections** | sections.ts | GET, POST, PATCH |
| **subjects** | subjects.ts | mine, :id/overview |
| **professor** | professor.ts | assign-groups, etc. |
| **student** | student.ts | notes, hijo/:id/notes, profile, subjects |
| **attendance** | attendance.ts | CRUD |
| **events** | events.ts | CRUD |
| **notifications** | notifications.ts | GET, PATCH, mark-all-read |
| **institution** | institution.ts | config |
| **messages** | messages.ts | conversations, mensajes, create |
| **chat** | chat.ts | sessions, new, history, title (chatService usa PG) |
| **logrosCalificacion** | logrosCalificacion.ts | **Migrado hoy:** GET, POST, PUT, DELETE (grading_categories) |
| **gradingSchema** | gradingSchema.ts | CRUD esquemas y categorías |
| **gradeEvents** | gradeEvents.ts | Uso de repos PG |
| **reports** | reports.ts | estudiante/:id/resumen, cursos/resumen (datos básicos) |
| **superAdmin** | superAdmin.ts | GET schools, GET schools/:id (PG) |

## Rutas migradas en esta sesión (2025-03-09)

| Ruta | Archivo | Estado |
|------|---------|--------|
| **superAdmin** | superAdmin.ts | POST schools, POST assign-admin implementados |
| **materials** | materials.ts | GET (cursoId, materiaId), POST, DELETE con learning_resources |
| **evoSend** | evoSend.ts | GET/POST threads, messages, courses con announcements |
| **assignmentMaterials** | assignmentMaterials.ts | GET, POST con assignment_materials |
| **audit** | audit.ts | GET /logs con activity_logs + ai_action_logs |
| **schedule** | schedule.ts | GET/PUT my-group, group/:id, my-professor, professor/:id con group_schedules, professor_schedules |

## Rutas con stubs restantes

| Ruta | Archivo | Problema |
|------|---------|----------|
| **integrations** | integrations.ts | Google create-doc → stub con URL placeholder (requiere OAuth config) |

## ETL actualizado

- **Export:** Añadidas colecciones `group_schedules`, `professor_schedules`.
- **Transform:** Genera `group_schedules.json`, `professor_schedules.json` (slots como JSONB).
- **Load:** Inserta en tablas `group_schedules`, `professor_schedules` con ON CONFLICT.

## Tablas PG disponibles (schema.sql)

- users, institutions, institution_codes, academic_periods
- sections, groups, subjects, group_subjects, enrollments
- grading_schemas, grading_categories, assignment_categories
- assignments, submissions, grades, grade_events
- attendance, notifications, events
- conversations, messages
- chat_sessions, chat_messages
- learning_resources, assignment_materials
- announcements, announcement_messages
- analytics.activity_logs, analytics.ai_action_logs
- guardian_students

## Notas

- El `protect` middleware exige `DATABASE_URL`; sin él devuelve 503.
- Todas las rutas protegidas usan `findUserById` (PG).
- No hay ramas condicionales Mongo/PG: el proyecto está en modo PG-only cuando `USE_POSTGRES_ONLY=true` o `DATABASE_URL` está definido.
