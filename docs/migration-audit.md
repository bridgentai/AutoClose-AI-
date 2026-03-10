# MongoDB Migration Audit

Audit of Mongo collections from `server/models/` for migration to PostgreSQL. Fields, types, and indexes as defined in schemas.

## Collection inventory

| Mongo collection       | Model file          | Target PG (public/analytics) | colegioId/institution |
|------------------------|---------------------|------------------------------|------------------------|
| usuarios               | User.ts             | public.users                 | colegioId              |
| config_institucion     | InstitutionConfig   | public.institutions          | colegioId (unique)      |
| codigos_institucion    | CodigoInstitucion    | public.institution_codes     | colegioId              |
| secciones              | Section.ts          | public.sections              | colegioId              |
| materias               | Materia.ts          | public.subjects              | (institution via usage)|
| grupos                 | Group.ts            | public.groups                | colegioId              |
| grupo_estudiantes      | GroupStudent.ts     | public.enrollments           | colegioId              |
| cursos                 | Course.ts           | → group_subjects + enrollments | colegioId            |
| tareas                 | Assignment.ts       | public.assignments + submissions | colegioId           |
| notas                  | Nota.ts             | → grade_events (no notas table) | —                    |
| grade_events           | GradeEvent.ts       | public.grade_events          | colegioId              |
| grading_schemas        | GradingSchema.ts    | public.grading_schemas       | colegioId, courseId→group_id |
| grading_categories     | Category.ts         | public.grading_categories    | colegioId              |
| asistencias            | Asistencia.ts       | public.attendance            | colegioId              |
| conversaciones         | Conversacion.ts     | public.conversations         | colegioId              |
| mensajes               | Mensaje.ts          | public.messages              | —                      |
| notificaciones         | Notificacion.ts     | public.notifications         | — (usuarioId)          |
| eventos                | Evento.ts           | public.events                | colegioId              |
| vinculaciones          | Vinculacion.ts      | public.guardian_students     | colegioId              |
| chats                  | ChatSession.ts       | public.chat_sessions         | colegioId              |
| chat_messages          | ChatMessage.ts      | public.chat_messages         | —                      |
| evo_threads            | EvoThread.ts        | public.announcements         | colegioId              |
| evo_messages           | EvoMessage.ts       | public.announcement_messages | —                      |
| boletines              | Boletin.ts          | NOT a table (computed report)| —                      |
| facturas               | Factura.ts          | NOT migrated (treasury)      | —                      |
| pagos                  | Pago.ts             | NOT migrated (treasury)      | —                      |
| performance_snapshots   | PerformanceSnapshot | analytics.performance_snapshots | colegioId          |
| performance_forecasts   | PerformanceForecast | analytics.performance_forecasts | colegioId          |
| risk_assessments       | RiskAssessment.ts   | analytics.risk_assessments   | colegioId              |
| ai_action_logs          | AIActionLog.ts      | analytics.ai_action_logs     | colegioId              |
| logros_calificacion    | LogroCalificacion   | → assignment_categories      | colegioId              |
| materiales             | Material.ts         | public.learning_resources    | colegioId              |
| assignment_materials   | AssignmentMaterial  | public.assignment_materials  | —                      |
| examenes               | Examen.ts           | (optional / learning_resources) | —                   |

## Field and index summary by collection

### usuarios (User)
- **Fields:** nombre, correo, password, rol, colegioId, estado, configuraciones, email?, curso?, materias?, hijoId?, codigoUnico?, codigoInterno?, telefono?, celular?, direccion?, barrio?, ciudad?, fechaNacimiento?, seccion?, createdAt, userId?, consentimientoTerminos?, consentimientoPrivacidad?, consentimientoFecha?
- **Indexes:** unique (correo, colegioId); userId unique sparse, index.

### cursos (Course)
- **Fields:** nombre, materiaId?, estudiantes[], profesorId?, colegioId?, descripcion?, profesorIds[], estudianteIds[], colorAcento?, icono?, createdAt, gradingSchemaId?
- **Indexes:** none explicit.
- **Note:** Becomes group + group_subjects + enrollments; students in Course.estudiantes/estudianteIds → enrollments.

### tareas (Assignment)
- **Fields:** titulo, descripcion, contenidoDocumento?, cursoId, materiaId, profesorId, fechaEntrega, submissions[], adjuntos[], colegioId, createdAt, courseId?, categoryId?, maxScore?, type?, isGradable?, logroCalificacionId?, entregas[] (legacy).
- **Submissions (embedded):** estudianteId, estudianteNombre, archivos[], comentario?, fechaEntrega, calificacion?, retroalimentacion?
- **Indexes:** (cursoId, fechaEntrega), (colegioId, cursoId), (profesorId, fechaEntrega).

### notas (Nota)
- **Fields:** tareaId, estudianteId, profesorId, nota, logro?, logroId?, manualOverride?, fecha, updatedAt?
- **Indexes:** (tareaId, estudianteId), (estudianteId, fecha).
- **Note:** Migrate to grade_events only; no separate notas table.

### asistencias (Asistencia)
- **Fields:** cursoId, grupoId?, estudianteId, fecha, horaBloque?, puntualidad?, estado (presente|ausente), colegioId, recordedBy?
- **Indexes:** (cursoId, fecha), (grupoId, fecha), (estudianteId, fecha), unique (cursoId, estudianteId, fecha), (colegioId, fecha).

### grade_events
- **Fields:** assignmentId, studentId, courseId, categoryId, colegioId, score, maxScore, normalizedScore?, recordedAt, recordedBy, version?
- **Indexes:** unique (studentId, courseId, assignmentId), (courseId, categoryId), (studentId, courseId, recordedAt), (colegioId, recordedAt).

### conversaciones (Conversacion)
- **Fields:** colegioId, asunto, participanteIds[], tipo, materiaId?, creadoPor, createdAt.
- **Indexes:** (colegioId, createdAt), (participanteIds, createdAt).

### mensajes (Mensaje)
- **Fields:** chatId?, conversationId?, remitenteId, texto, adjuntos[], fecha, leido.
- **Indexes:** (conversationId, fecha), (chatId, fecha), (remitenteId, fecha).

### notificaciones (Notificacion)
- **Fields:** usuarioId, titulo, descripcion, fecha, leido.
- **Indexes:** (usuarioId, leido, fecha), (usuarioId, fecha).

### eventos (Evento)
- **Fields:** titulo, descripcion, fecha, tipo (curso|colegio), cursoId?, colegioId, creadoPor?
- **Indexes:** (fecha), (tipo, fecha), (cursoId, fecha), (colegioId, fecha).

### grupos (Group)
- **Fields:** nombre, descripcion, colegioId, seccion?, sectionId?, createdAt, updatedAt.
- **Indexes:** none.

### secciones (Section)
- **Fields:** nombre, colegioId, createdAt, updatedAt.
- **Indexes:** (colegioId).

### materias (Materia)
- **Fields:** nombre, descripcion, area.
- **Indexes:** none. (No colegioId in schema; may be institution-scoped by usage.)

### vinculaciones (Vinculacion)
- **Fields:** padreId, estudianteId, colegioId, createdAt, updatedAt.
- **Indexes:** (padreId, estudianteId) unique; index on padreId, estudianteId, colegioId.

### grading_schemas, grading_categories
- **grading_schemas:** courseId, colegioId, nombre?, version, isActive, timestamps. Indexes: (courseId, isActive), (colegioId, courseId).
- **grading_categories:** gradingSchemaId, nombre, weight, orden, evaluationType, riskImpactMultiplier, colegioId. Indexes: (gradingSchemaId), (colegioId, gradingSchemaId).

### performance_snapshots, performance_forecasts, risk_assessments
- All have studentId, courseId, colegioId; indexes on (studentId, courseId, at), (colegioId, ...). → analytics schema.

### ai_action_logs (AIActionLog)
- **Fields:** userId, role, action, entityType, entityId?, cursoId?, colegioId, timestamp, result, error?, requestData?.
- **Indexes:** (userId, timestamp), (role, timestamp), (action, timestamp), (colegioId, timestamp), (result, timestamp).
- **Note:** Stored in analytics.ai_action_logs (cold).

### config_institucion (InstitutionConfig)
- **Fields:** colegioId (unique), nombre, logoUrl?, parametros, nombreIA?, colorPrimario?, colorSecundario?, metodologia?, curriculum?, createdAt, updatedAt.

### chats (ChatSession), chat_messages (ChatMessage)
- **chats:** cursoId?, participantes[], colegioId?, userId?, titulo?, contexto?, historial[], createdAt, updatedAt.
- **chat_messages:** chatId, role, content, type?, structuredData?, createdAt. Index: (chatId, createdAt).

### evo_threads, evo_messages
- **evo_threads:** colegioId, tipo, asunto, creadoPor, cursoId?, assignmentId?, recipientIds[], createdAt, updatedAt.
- **evo_messages:** threadId, remitenteId, rolRemitente, contenido, tipo, prioridad, assignmentId?, leidoPor[], adjuntos[], fecha, createdAt.

## Relations map (ObjectId refs)

- User ← Course.estudiantes, Course.profesorId, Assignment.profesorId, Nota.estudianteId/profesorId, Asistencia.estudianteId, Mensaje.remitenteId, Conversacion.participanteIds/creadoPor, Vinculacion.padreId/estudianteId, etc.
- Course ← Assignment.cursoId, Asistencia.cursoId, GradeEvent.courseId, GradingSchema.courseId.
- Assignment ← Nota.tareaId, GradeEvent.assignmentId, Assignment.submissions[].estudianteId.
- Group → GroupStudent (grupoId, estudianteId); Section → Group.sectionId.
- Materia ← Course.materiaId, Assignment.materiaId.

## Inconsistencies and notes

- User: `correo` and `email` both exist; synced in pre-save. Use single `email` in PG.
- Course: `estudiantes` and `estudianteIds`; `profesorId` and `profesorIds`. Normalize to enrollments and group_subjects.teacher_id.
- Assignment: `cursoId`, `courseId`, `curso` (string). Use group_subject_id in PG.
- Naming: standardize to English; institution_id for multi-tenant.
- Notas: merge into grade_events during ETL; assign grading_category_id from course schema or default.
- Boletines: do not create table; reports computed from grade_events + attendance.
- Treasury (facturas, pagos): do not migrate; remove routes and frontend references.

## Classification (4 domains)

- **CORE ACADEMIC:** users, institutions, academic_periods, sections, subjects, groups, group_subjects, enrollments, assignments, submissions, attendance, grade_events, grading_schemas, grading_categories, guardian_students, assignment_categories, learning_resources.
- **COMMUNICATION:** conversations, messages, chat_sessions, chat_messages, notifications, announcements, announcement_messages, events.
- **ANALYTICS (cold):** analytics.activity_logs, analytics.performance_snapshots, analytics.performance_forecasts, analytics.risk_assessments.
- **AI (cold):** analytics.ai_action_logs. (Hot: roles, permissions, role_permissions, ai_recommendations, ai_memory in public.)
