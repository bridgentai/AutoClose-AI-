---
name: Preparación Chat AI Global
overview: Preparar toda la infraestructura de AutoClose AI para soportar un Chat AI Global que funcione como el CORAZÓN de la aplicación, automatizando TODAS las tareas manuales mediante lenguaje natural, personalizado estrictamente por rol y curso, con validaciones de seguridad y permisos muy específicas.
todos:
  - id: fix-chatsession-cursoid
    content: Hacer cursoId opcional en ChatSession model y actualizar validación en chat routes para permitir chats globales sin cursoId (el chat global no requiere curso específico)
    status: pending
  - id: create-ai-endpoint
    content: Crear endpoint POST /api/ai/chat en server/routes/ai.ts que reciba { user_id, role, message, contexto_extra } y registrarlo en server/routes.ts como /api/ai
    status: pending
  - id: create-data-query-service
    content: Crear server/services/dataQuery.ts con funciones centralizadas para consultar: notas del estudiante, materias, tareas, boletines, comentarios, calendarios. TODAS deben respetar restricciones estrictas por rol (estudiante solo su info, profesor solo sus cursos, padre solo hijos)
    status: pending
  - id: create-permission-validator
    content: Crear server/services/permissionValidator.ts con validaciones específicas: canQueryOwnNotes (estudiante), canQueryCourseNotes (profesor), canQueryChildInfo (padre), canCreateAssignment (profesor), canGrade (profesor), canSubmitAssignment (estudiante), canSendComment (todos según contexto), canCreateBoletin (profesor/directivo)
    status: pending
  - id: create-audit-system
    content: Crear server/models/AIActionLog.ts y server/services/auditLogger.ts para registrar TODAS las acciones ejecutadas por IA con userId, role, action, entityType, entityId, cursoId, timestamp, result, error. Crítico para seguridad y trazabilidad
    status: pending
  - id: create-sync-service
    content: Crear server/services/syncService.ts para sincronizar cambios: cuando se crea/modifica tarea → actualizar calendarios y notificar estudiantes; cuando se califica → actualizar notas y notificar; cuando se envía comentario → actualizar chats y notificaciones
    status: pending
  - id: create-ai-functions
    content: Crear server/services/aiFunctions.ts con TODAS las funciones para OpenAI Function Calling: consultar_notas_estudiante, consultar_materias, consultar_tareas, asignar_tarea, entregar_tarea, calificar_tarea, subir_nota, crear_boletin, enviar_comentario, consultar_calendario. Cada función debe tener schema JSON estricto
    status: pending
    dependencies:
      - create-data-query-service
  - id: create-action-executor
    content: Crear server/services/actionExecutor.ts que ejecute acciones: validar permisos estrictos por rol+curso, ejecutar acción real (usando endpoints existentes o lógica directa), registrar auditoría completa, disparar sincronización, retornar respuesta segura al usuario
    status: pending
    dependencies:
      - create-permission-validator
      - create-audit-system
      - create-sync-service
  - id: enhance-openai-service
    content: Expandir server/services/openai.ts para Function Calling. Construir system prompt DINÁMICO muy específico por rol con: restricciones explícitas (ej. "NO puedes consultar notas de otros estudiantes"), funciones disponibles según rol, contexto del curso, ejemplos de uso. Conectar con aiFunctions y actionExecutor
    status: pending
    dependencies:
      - create-ai-functions
      - create-action-executor
  - id: create-role-context-builder
    content: Crear server/services/roleContextBuilder.ts que construya contexto específico por rol: para estudiante (su curso, sus materias, sus tareas), para profesor (sus cursos asignados, sus estudiantes), para padre (sus hijos, cursos de hijos). Este contexto se inyecta en el system prompt
    status: pending
  - id: fix-id-inconsistencies
    content: Revisar y corregir inconsistencias en manejo de IDs asegurando uso consistente de normalizeIdForQuery. Verificar que validaciones de cursoId y colegioId estén en TODAS las consultas para prevenir accesos cruzados
    status: pending
---

# Plan de Preparación para Chat AI Global - CORAZÓN DE LA APLICACIÓN

## Objetivo Principal

Preparar toda la infraestructura de AutoClose AI para que el **Chat AI Global funcione como el CORAZÓN de la aplicación**, automatizando **TODAS las tareas manuales** mediante lenguaje natural. El chat debe ser:

- **Personalizado estrictamente por rol y curso**: Cada usuario ve solo lo que puede ver según su rol
- **Automático**: Todas las funciones manuales deben ejecutarse vía chat
- **Seguro**: Validaciones estrictas que previenen accesos cruzados entre roles y cursos
- **Contextual**: Respuestas claras, personalizadas y útiles, no solo datos crudos

## Arquitectura del Flujo Completo

```mermaid
flowchart TD
    User[Usuario con Rol y Curso] -->|Mensaje Natural| Frontend[Frontend Chat UI]
    Frontend -->|POST /api/ai/chat<br/>{user_id, role, message}| Backend[Backend Orquestador IA]
    Backend -->|1. Cargar Contexto| RoleContext[Role Context Builder]
    RoleContext -->|Contexto Específico| SystemPrompt[System Prompt Builder]
    Backend -->|2. Identificar Intención| OpenAI[OpenAI API<br/>Function Calling]
    OpenAI -->|Function Call Propuesto| Backend
    Backend -->|3. Validar Permisos<br/>Rol + Curso| PermValidator[Permission Validator<br/>Restricciones Estrictas]
    PermValidator -->|Permiso DENEGADO| ErrorResponse[Error Explicativo<br/>"No puedes ver notas de otros estudiantes"]
    PermValidator -->|Permiso OK| ActionExecutor[Action Executor]
    ActionExecutor -->|Ejecutar Acción Real| DB[(MongoDB)]
    ActionExecutor -->|Registrar| AuditLog[Audit Log<br/>userId, role, action, cursoId]
    ActionExecutor -->|Sincronizar| SyncService[Sync Service]
    SyncService -->|Notificar| Calendar[Calendarios]
    SyncService -->|Notificar| Tasks[Tareas]
    SyncService -->|Notificar| Notifications[Notificaciones]
    ActionExecutor -->|Respuesta Contextual| Backend
    Backend -->|Respuesta Personalizada| Frontend
    Frontend -->|Mostrar| User
```

## Funcionalidades que el Chat Debe Automatizar

### 1. Consultas de Información (según rol)

**Estudiante:**
- "¿Cuántas materias voy perdiendo y cuáles son mis notas?"
- "¿Qué tareas tengo pendientes?"
- "Muéstrame mis notas de Matemáticas"
- "¿Cuándo es mi próximo examen?"

**Profesor:**
- "Muéstrame las notas del curso 9B en Matemáticas"
- "¿Qué estudiantes tienen tareas pendientes en mi curso?"
- "Dame un resumen del rendimiento de 7A"

**Padre:**
- "¿Cómo van las notas de mi hijo?"
- "¿Qué tareas tiene pendientes mi hijo?"
- "Muéstrame el boletín de mi hijo"

### 2. Acciones Automatizadas

**Asignar Tareas:**
- "Asigna una tarea al curso noveno B de Matemáticas para mañana"
- "Crea una tarea de lectura para 7A"

**Entregar Tareas:**
- "Entregar mi tarea de Matemáticas" (estudiante)
- "Subir mi proyecto de Ciencias" (estudiante)

**Calificar:**
- "Califica la tarea de Juan Pérez con 4.5"
- "Ponle 3.8 a María García en el examen"

**Subir Notas:**
- "Sube la nota del examen parcial de 9B"
- "Registra las notas de la actividad de hoy"

**Crear Boletines:**
- "Genera el boletín del primer periodo para 7A"
- "Crea un reporte de notas para mi curso"

**Enviar Comentarios:**
- "Envía un comentario a Juan sobre su tarea"
- "Comenta a los padres sobre el rendimiento"

## Restricciones por Rol (CRÍTICAS)

### Estudiante
- ✅ Puede consultar: SUS propias notas, SUS materias, SUS tareas, SUS boletines
- ❌ NO puede: consultar notas de otros estudiantes, ver información de otros cursos, acceder a datos de profesores
- ❌ NO puede: pedir notas de un curso completo (solo el profesor puede)
- ❌ NO puede: ver información de estudiantes de otros cursos

### Profesor
- ✅ Puede: asignar tareas a SUS cursos, calificar en SUS cursos, crear boletines de SUS cursos, enviar comentarios a SUS estudiantes
- ❌ NO puede: acceder a información personal sensible (dirección, datos privados) de estudiantes
- ❌ NO puede: ver información de cursos que no le pertenecen
- ✅ Puede: ver notas de curso completo (solo de sus cursos asignados)

### Padre
- ✅ Puede: consultar boletines, notas y comentarios de SUS HIJOS únicamente
- ❌ NO puede: acceder a información de otros estudiantes
- ❌ NO puede: ver información de cursos completos
- ✅ Puede: ver información académica de sus hijos (no datos privados)

## Problemas Identificados y Soluciones Detalladas

### 1. ChatSession requiere cursoId pero el chat global no debería

**Archivos afectados:** `server/models/ChatSession.ts`, `server/routes/chat.ts`

**Solución:**
- Hacer `cursoId` opcional en el modelo `ChatSession`
- Permitir `null` para chats globales (no asociados a un curso específico)
- Actualizar validación en `server/routes/chat.ts` para permitir chats sin `cursoId`
- El chat global puede usarse para consultas generales que no requieren contexto de curso

### 2. Falta endpoint `/api/ai/chat` especificado

**Archivo a crear:** `server/routes/ai.ts`

**Solución:**
- Crear nuevo router `server/routes/ai.ts` con endpoint `POST /api/ai/chat`
- Registrar en `server/routes.ts` como `/api/ai`
- El endpoint debe recibir: `{ user_id, role, message, contexto_extra }`
- `contexto_extra` debe incluir: `cursoId`, `colegioId`, `cursosAsignados`, `materias`, etc.

### 3. No existe servicio centralizado de consulta con restricciones por rol

**Archivo a crear:** `server/services/dataQuery.ts`

**Solución:**
- Crear servicio que encapsule TODAS las consultas que el AI puede necesitar
- Funciones específicas:
  - `queryStudentNotes(userId, cursoId)` - Solo notas del estudiante
  - `queryStudentSubjects(userId, cursoId)` - Solo materias del estudiante
  - `queryStudentAssignments(userId, cursoId)` - Solo tareas del estudiante
  - `queryCourseNotes(profesorId, cursoId)` - Notas del curso (solo profesor)
  - `queryChildInfo(parentId, hijoId)` - Info del hijo (solo padre)
- **TODAS** las consultas deben:
  - Filtrar por `colegioId`
  - Validar que el usuario tenga acceso según su rol
  - Prevenir accesos cruzados

### 4. No existe sistema de validación de permisos específico por funcionalidad

**Archivo a crear:** `server/services/permissionValidator.ts`

**Solución:**
- Crear servicio centralizado con validaciones MUY específicas:
  - `canQueryOwnNotes(userId, targetUserId)` - Estudiante solo puede ver sus notas
  - `canQueryCourseNotes(profesorId, cursoId)` - Profesor solo sus cursos
  - `canQueryChildInfo(parentId, hijoId)` - Padre solo sus hijos
  - `canCreateAssignment(profesorId, cursoId)` - Profesor solo en sus cursos
  - `canGrade(profesorId, assignmentId)` - Profesor solo en sus tareas
  - `canSubmitAssignment(estudianteId, assignmentId)` - Estudiante solo sus tareas
  - `canSendComment(userId, targetUserId, context)` - Según contexto
  - `canCreateBoletin(profesorId, cursoId)` - Profesor/directivo solo sus cursos
- Integrar con middleware existente `server/middleware/roleAuth.ts`
- Retornar mensajes de error claros cuando se deniega acceso

### 5. No existe sistema de auditoría para acciones de IA

**Archivo a crear:** `server/models/AIActionLog.ts`, `server/services/auditLogger.ts`

**Solución:**
- Crear modelo `AIActionLog` con campos:
  - `userId` (ObjectId)
  - `role` (string)
  - `action` (string) - ej: "query_notes", "create_assignment", "grade_assignment"
  - `entityType` (string) - ej: "assignment", "note", "message"
  - `entityId` (ObjectId)
  - `cursoId` (ObjectId, opcional)
  - `colegioId` (string)
  - `timestamp` (Date)
  - `result` (string) - "success" | "denied" | "error"
  - `error` (string, opcional)
  - `requestData` (Object, opcional) - datos de la solicitud
- Crear servicio `auditLogger.ts` para registrar todas las acciones
- **CRÍTICO**: Registrar incluso las acciones denegadas para seguridad

### 6. No existe sistema de sincronización entre módulos

**Archivo a crear:** `server/services/syncService.ts`

**Solución:**
- Crear servicio que notifique cambios a módulos afectados:
  - **Cuando se crea/modifica tarea**: Actualizar calendarios, crear notificaciones para estudiantes
  - **Cuando se califica**: Actualizar notas, crear notificación para estudiante
  - **Cuando se envía comentario**: Actualizar chats, crear notificación
  - **Cuando se crea boletín**: Notificar a padres/estudiantes
- Usar el modelo `Notificacion` existente
- Actualizar `Evento` para calendarios si es necesario

### 7. Inconsistencias en manejo de IDs

**Archivos afectados:** Múltiples rutas y servicios

**Solución:**
- Asegurar uso consistente de `normalizeIdForQuery()` en TODAS las consultas
- Verificar que validaciones de `cursoId` y `colegioId` estén presentes
- Documentar cuándo usar IDs categorizados vs ObjectIds directos
- Agregar helpers adicionales en `server/utils/idGenerator.ts` si es necesario

### 8. Falta estructura para Function Calling de OpenAI

**Archivo a crear:** `server/services/aiFunctions.ts`

**Solución:**
- Definir TODAS las funciones/tools que el AI puede llamar según formato OpenAI:
  - `consultar_notas_estudiante` - Para estudiante ver sus notas
  - `consultar_materias` - Materias según rol
  - `consultar_tareas` - Tareas según rol
  - `asignar_tarea` - Profesor crear tarea
  - `entregar_tarea` - Estudiante entregar
  - `calificar_tarea` - Profesor calificar
  - `subir_nota` - Profesor subir nota
  - `crear_boletin` - Profesor/directivo crear boletín
  - `enviar_comentario` - Enviar comentario según contexto
  - `consultar_calendario` - Consultar eventos
- Cada función debe tener:
  - Nombre claro
  - Descripción detallada
  - Parámetros con schema JSON estricto
  - Restricciones de uso según rol
- Preparar mapeo de funciones a ejecutores reales

### 9. Falta servicio de ejecución de acciones

**Archivo a crear:** `server/services/actionExecutor.ts`

**Solución:**
- Crear servicio que ejecute acciones propuestas por el AI:
  1. **Validar permisos** usando `permissionValidator` (MUY ESTRICTO)
  2. **Ejecutar acción real**:
     - Para crear tarea: usar lógica de `server/routes/assignments.ts`
     - Para calificar: actualizar `submission.calificacion` en Assignment
     - Para subir nota: crear/actualizar en modelo `Nota`
     - Para enviar comentario: crear en modelo `Mensaje` o `Notificacion`
     - Para consultar: usar `dataQuery.ts`
  3. **Registrar en auditoría** usando `auditLogger`
  4. **Disparar sincronización** usando `syncService`
  5. **Retornar respuesta segura** al usuario (sin exponer datos sensibles)

### 10. Falta construcción dinámica de system prompt por rol

**Archivo a modificar:** `server/services/openai.ts`

**Solución:**
- Expandir función `generateAIResponse` o crear nueva `generateAIResponseWithFunctions`
- Construir system prompt DINÁMICO que incluya:
  - **Rol del usuario** y restricciones explícitas
  - **Curso del usuario** (si aplica)
  - **Funciones disponibles** según rol
  - **Ejemplos de uso** según rol
  - **Restricciones claras**: "NO puedes consultar notas de otros estudiantes", "Solo puedes ver información de tus cursos asignados"
- Ejemplo para estudiante:
  ```
  Eres AutoClose AI, asistente educativo. El usuario es un ESTUDIANTE del curso 9B.
  
  RESTRICCIONES ESTRICTAS:
  - Solo puedes consultar información del ESTUDIANTE ACTUAL
  - NO puedes ver notas de otros estudiantes
  - NO puedes ver información de otros cursos
  - NO puedes asignar tareas (solo profesores)
  
  FUNCIONES DISPONIBLES:
  - consultar_notas_estudiante: Ver tus propias notas
  - consultar_tareas: Ver tus tareas pendientes
  - entregar_tarea: Entregar una tarea
  ...
  ```

### 11. Falta construcción de contexto por rol

**Archivo a crear:** `server/services/roleContextBuilder.ts`

**Solución:**
- Crear servicio que construya contexto específico por rol:
  - **Para estudiante**: Su curso, sus materias, sus tareas pendientes, sus notas recientes
  - **Para profesor**: Sus cursos asignados, número de estudiantes, tareas activas
  - **Para padre**: Sus hijos, cursos de hijos, notas recientes de hijos
- Este contexto se inyecta en el system prompt
- Se actualiza dinámicamente según la consulta

## Estructura de Archivos a Crear/Modificar

### Nuevos Archivos

1. `server/routes/ai.ts` - Endpoint principal `/api/ai/chat`
2. `server/services/dataQuery.ts` - Servicio de consulta con restricciones por rol
3. `server/services/permissionValidator.ts` - Validación de permisos específica
4. `server/services/auditLogger.ts` - Sistema de auditoría
5. `server/services/syncService.ts` - Sincronización entre módulos
6. `server/services/aiFunctions.ts` - Definición de funciones para OpenAI
7. `server/services/actionExecutor.ts` - Ejecutor de acciones
8. `server/services/roleContextBuilder.ts` - Constructor de contexto por rol
9. `server/models/AIActionLog.ts` - Modelo de auditoría

### Archivos a Modificar

1. `server/models/ChatSession.ts` - Hacer `cursoId` opcional
2. `server/routes/chat.ts` - Permitir chats sin `cursoId`
3. `server/services/openai.ts` - Agregar Function Calling y system prompt dinámico por rol
4. `server/routes.ts` - Registrar nueva ruta `/api/ai`
5. `server/utils/idGenerator.ts` - Agregar helpers adicionales si es necesario

## Implementación por Fases

### Fase 1: Corrección de Infraestructura Base
- Corregir problema de `cursoId` en ChatSession
- Crear modelo de auditoría
- Crear servicios base (dataQuery, permissionValidator, roleContextBuilder)

### Fase 2: Sistema de Acciones y Funciones
- Crear definición de funciones para OpenAI (aiFunctions)
- Crear ejecutor de acciones (actionExecutor)
- Integrar validación de permisos estricta

### Fase 3: Orquestador y Sincronización
- Crear endpoint `/api/ai/chat`
- Implementar sistema de sincronización
- Integrar auditoría en todas las acciones

### Fase 4: Integración con OpenAI y Personalización
- Expandir servicio OpenAI con Function Calling
- Construir system prompt dinámico MUY específico por rol
- Conectar todo el flujo con contexto personalizado

## Consideraciones de Seguridad (CRÍTICAS)

1. **Nunca exponer API keys**: Ya está correcto, se lee de `process.env.OPENAI_API_KEY`
2. **Validación obligatoria y estricta**: TODAS las acciones deben pasar por `permissionValidator` con validaciones MUY específicas
3. **Auditoría completa**: Registrar TODAS las acciones (incluso denegadas) con userId, role, cursoId
4. **Respeto estricto de roles**: 
   - Estudiante: SOLO su información
   - Profesor: SOLO sus cursos
   - Padre: SOLO sus hijos
5. **Aislamiento de datos**: TODAS las consultas deben filtrar por `colegioId` y validar acceso por `cursoId`
6. **Prevención de accesos cruzados**: Validar explícitamente que no se pueda acceder a información de otros cursos/estudiantes
7. **Mensajes de error claros**: Cuando se deniega acceso, explicar por qué de forma clara

## Experiencia de Usuario

- **Respuestas claras y personalizadas**: No solo datos crudos, sino explicaciones útiles
- **Mensajes contextuales**: "Tienes 3 materias con notas por debajo de 3.0: Matemáticas (2.8), Ciencias (2.9), Sociales (2.7)"
- **Diseño limpio**: Seguir `design_guidelines.md` con glassmorphism y paleta púrpura
- **Feedback inmediato**: Mostrar cuando se está procesando una acción
- **Confirmaciones**: Para acciones importantes, confirmar antes de ejecutar

## Próximos Pasos Después de Esta Preparación

Una vez completada esta preparación, se podrá implementar el Chat AI Global completo con:

- Function Calling de OpenAI con todas las funciones necesarias
- Identificación de intenciones en lenguaje natural
- Ejecución controlada de acciones con validación estricta
- Sincronización automática entre módulos
- Respuestas contextuales y personalizadas según rol y curso
- Auditoría completa de todas las acciones
- Sistema de permisos robusto que previene accesos no autorizados

