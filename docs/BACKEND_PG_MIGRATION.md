# Backend PostgreSQL migration (STEP 4 & 5)

## Resumen

El backend se adapta a PostgreSQL manteniendo compatibilidad con el frontend: las rutas y el formato de respuesta se conservan. Cuando `DATABASE_URL` está definido en `.env`, los controladores usan los repositorios PG; si no, siguen usando MongoDB.

## Completado

### Middleware y configuración
- **middleware/auth (protect):** Si existe `DATABASE_URL`, carga el usuario desde `users` en PG y expone `req.user` con `id`, `colegioId` (= `institution_id`), `rol`, y opcionalmente `curso`/`materias` desde `config` JSONB.
- **ENV.DATABASE_URL** se usa en rutas para decidir si se usa PG o Mongo.

### Repositorios PG
- **Existentes (ya usados):** userRepository, institutionRepository, eventRepository, notificationRepository, sectionRepository, groupRepository, assignmentRepository, submissionRepository, attendanceRepository, gradeEventRepository, messageRepository, conversationRepository, chatSessionRepository, chatMessageRepository, gradingSchemaRepository, gradingCategoryRepository, enrollmentRepository, groupSubjectRepository, subjectRepository.
- **Nuevos o ampliados:**
  - **institutionCodeRepository:** findInstitutionCodeByCode, findInstitutionCodesByInstitution, findInstitutionCodeByInstitutionAndCode.
  - **guardianStudentRepository:** findGuardianStudentsByGuardian, findGuardianStudentsByStudent, findGuardianStudent, createGuardianStudent, deleteGuardianStudent.
  - **notificationRepository:** findNotificationsByUserFiltered, countUnreadByUser, updateNotificationRead, markAllNotificationsReadByUser.
  - **eventRepository:** findEventsByInstitution (con opciones type, groupId, fromDate, toDate), findEventByIdWithDetails, findEventsByInstitutionWithDetails, createEvent, updateEvent, deleteEvent.
  - **sectionRepository:** createSection, updateSectionName, findSectionByInstitutionAndName.
  - **groupRepository:** findGroupByNameAndInstitution, updateGroupSection.
  - **conversationRepository:** findConversationIdsByParticipant, createConversation, addConversationParticipant, isConversationParticipant.
  - **messageRepository:** getLastMessageByConversation, createMessage.

### Rutas actualizadas (usan PG cuando DATABASE_URL está definido)
| Ruta | Archivo | Endpoints con rama PG |
|------|---------|------------------------|
| **Auth** | auth.ts | Login ya usaba findUserByEmail (PG). Register/códigos/sync siguen en Mongo. |
| **Notifications** | notifications.ts | GET /, PATCH /:id/read, POST /mark-all-read |
| **Events** | events.ts | GET /, GET /:id, POST /, PUT /:id, DELETE /:id |
| **Institution** | institution.ts | GET /config |
| **Sections** | sections.ts | GET /, POST /, PATCH /:id |
| **Users** | users.ts | GET /me/hijos, GET /by-role |

### Formato de respuesta
- **Notifications:** Se devuelve `list` con objetos que tienen `_id`, `titulo`, `cuerpo`, `leido` (= `!!read_at`), `fecha`, y `unreadCount`.
- **Events:** Se devuelve `_id`, `titulo`, `descripcion`, `fecha`, `tipo`, `cursoId: { _id, nombre }`, `creadoPor: { _id, nombre }`.
- **Institution config:** `colegioId`, `nombre`, `logoUrl`, `nombreIA`, `colorPrimario`, `colorSecundario` (desde `institutions.settings` o valores por defecto).
- **Sections:** Array con `_id`, `nombre`, `colegioId`, `cursos: [{ _id, nombre }]`.
- **Users by-role / me/hijos:** Mismo shape que antes (ids, nombre, email, curso, etc.).

## Pendiente (rutas que siguen solo en Mongo)

Estas rutas siguen usando únicamente Mongoose. Para modo “solo PostgreSQL” hay que añadir rama PG o reemplazar por repositorios:

- **auth.ts:** register, códigos de acceso, syncStudentToGroup (User, GroupStudent, CodigoInstitucion, Course).
- **users.ts:** profesores, me/courses, asignar-codigos, relaciones, stats, create, bulk, reset-password, me/consent, vinculaciones, confirmar-vinculacion, activar-cuentas.
- **courses.ts:** Todos los endpoints (Course, Group, group_subjects, grading_schemas, etc.).
- **assignments.ts:** CRUD y listados (Assignment, Submission, grades).
- **groups.ts:** create, assign-student, all, :groupId/students, sync-students, lookup, :id.
- **subjects.ts:** mine, :id/overview.
- **attendance.ts:** Todos.
- **professor.ts, student.ts:** Todos.
- **messages.ts:** conversations y mensajes (repos listos; falta conectar rutas).
- **chat.ts + chatService:** Sesiones e historial (repos listos; falta conectar).
- **evoSend.ts:** Threads y mensajes (announcements / announcement_messages).
- **gradingSchema.ts, logrosCalificacion.ts, gradeEvents.ts:** Esquemas y categorías.
- **materials.ts, assignmentMaterials.ts:** learning_resources, assignment_materials.
- **reports.ts, audit.ts, superAdmin.ts, schedule.ts, integrations.ts.**

## Cómo seguir

1. **Probar en dual:** Dejar `MONGO_URI` y `DATABASE_URL` definidos; las rutas actualizadas usan PG, el resto Mongo.
2. **Solo PG:** Definir `USE_POSTGRES_ONLY=true` y `DATABASE_URL`; quitar o no usar `MONGO_URI`. Solo funcionarán sin error las rutas que ya tienen rama PG (auth login, notifications, events, institution, sections, users/me/hijos, users/by-role).
3. **Completar migración:** Ir ruta por ruta añadiendo la rama `if (ENV.DATABASE_URL) { ... }` que use los repositorios PG y mapee la respuesta al mismo formato que el frontend espera.

## Tablas PG utilizadas

- **Auth / user:** users, institution_codes.
- **Notifications:** notifications.
- **Events:** events (+ joins a groups, users para nombres).
- **Institution:** institutions (settings).
- **Sections / groups:** sections, groups.
- **Users (hijos / by-role):** users, guardian_students.

Las demás tablas (assignments, submissions, grades, enrollments, group_subjects, attendance, conversations, messages, chat_sessions, chat_messages, announcements, grading_schemas, grading_categories, etc.) tienen repositorios listos para cuando se conecten el resto de rutas.
