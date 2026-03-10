# Migración MongoDB a PostgreSQL - Resultados

## Resumen

- **Esquema PostgreSQL:** `server/db/schema.sql` (public + analytics, UUID PKs, índices críticos, separación hot/cold).
- **ETL:** `scripts/migrate/export-mongo.ts`, `transform-to-relational.ts`, `load-postgres.ts`, `validate.ts`.
- **Backend:** Cliente `pg`, `server/config/db-pg.ts`, capa `server/repositories/*`. Login (auth) usa PostgreSQL cuando `DATABASE_URL` está definido.
- **Módulos eliminados:** `/api/treasury`, `/api/boletin`; frontend redirige `/tesoreria` y `/boletin` a página "Módulo no disponible".
- **Opcional:** `USE_POSTGRES_ONLY=true` evita conectar MongoDB al arrancar; `USE_POSTGRES_ONLY` solo debe usarse cuando todas las rutas usen repositorios.

---

## Estructura de API (post-migración)

### Infraestructura
- /api/auth
- /api/institution
- /api/super-admin
- /api/integrations
- /api/health

### CORE ACADEMIC
- /api/users, /api/student, /api/professor, /api/courses, /api/subjects
- /api/assignments, /api/assignment-materials, /api/materials
- /api/groups, /api/sections, /api/attendance
- /api/grade-events, /api/grading-schemas
- /api/schedule

### COMMUNICATION
- /api/chat, /api/messages, /api/notifications, /api/events

### ANALYTICS / AI
- /api/reports, /api/ai, /api/audit

### Eliminados
- /api/treasury
- /api/boletin (reportes se generarán desde grades + attendance en el futuro)

---

## Repositorios y tablas PG

| Repositorio | Tabla(s) PG |
|-------------|-------------|
| userRepository | users |
| institutionRepository | institutions |
| groupRepository | groups |
| sectionRepository | sections |
| subjectRepository | subjects |
| groupSubjectRepository | group_subjects |
| enrollmentRepository | enrollments |
| assignmentRepository | assignments |
| submissionRepository | submissions |
| attendanceRepository | attendance |
| gradeEventRepository | grade_events |
| messageRepository | messages |
| conversationRepository | conversations |
| notificationRepository | notifications |
| eventRepository | events |
| gradingSchemaRepository | grading_schemas |
| gradingCategoryRepository | grading_categories |
| chatSessionRepository | chat_sessions |
| chatMessageRepository | chat_messages |

---

## Mapeo Mongo → PostgreSQL (IDs)

- ObjectId (24 hex) → UUID v5 determinista: `uuid_v5(namespace, objectIdHex)`.
- Namespace usado en scripts: `evoos-migration` (DNS namespace).
- No se usa tabla de mapeo; los FKs en PG son UUIDs generados en la transformación.

---

## Scripts de migración

| Script | Uso |
|--------|-----|
| `npx tsx scripts/migrate/export-mongo.ts` | Exporta colecciones Mongo a `scripts/migrate/data/*.json` |
| `npx tsx scripts/migrate/transform-to-relational.ts` | Genera `scripts/migrate/out/*.json` (UUID v5, tablas relacionales) |
| `npx tsx scripts/migrate/load-postgres.ts` | Carga `out/*.json` en PostgreSQL (requiere schema aplicado) |
| `npx tsx scripts/migrate/validate.ts` | Actualiza `docs/migration-validation.md` con conteos y comprobaciones FK |
| `npx tsx scripts/migrate/dual-read-compare.ts` | Compara muestras Mongo vs PG (requiere MONGO_URI y DATABASE_URL) |

---

## Esquema: hot vs cold

- **Hot (public):** users, institutions, academic_periods, sections, subjects, groups, group_subjects, enrollments, assignments, submissions, grades, grade_events, attendance, messages, conversations, notifications, events, chat_sessions, chat_messages, announcements, etc.
- **Cold (analytics):** `analytics.activity_logs`, `analytics.ai_action_logs`, `analytics.performance_snapshots`, `analytics.performance_forecasts`, `analytics.risk_assessments`.

Las consultas operativas no deben depender de tablas del esquema `analytics`.

---

## Índices críticos (incluidos en schema.sql)

- enrollments: (student_id), (group_id)
- group_subjects: (group_id), (teacher_id)
- assignments: (group_subject_id), (due_date)
- submissions: (assignment_id), (student_id)
- attendance: (user_id), (group_subject_id), (date)
- grade_events: (user_id), (assignment_id)
- messages: (conversation_id), (sender_id)
- notifications: (user_id)
- events: (institution_id), (date)

---

## Limitaciones conocidas

1. Solo la ruta de login (`POST /api/auth/login`) usa PostgreSQL cuando `DATABASE_URL` está definido; el resto de rutas siguen usando Mongoose hasta que se migren una a una.
2. Los reportes tipo boletín no están reimplementados; la ruta `/boletin` y boletín inteligente muestran "Módulo no disponible".
3. Tesorería eliminada por diseño; no hay reemplazo en esta fase.

---

## Fecha de finalización

Documento generado en el marco del plan de migración. Completar "Fecha de finalización" cuando se dé por cerrada la migración en producción.
