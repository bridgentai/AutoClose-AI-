# EvoSend 2.0 - Auditoria de Cierre

## Cambiado
- `server/routes/evoSend.ts`
  - Endurecimiento de acceso para `read`.
  - Contrato unificado de respuesta con `unread_by_category`.
  - Implementacion de endpoints reales para `search`, `attendance-inbox` y `people-finder`.
  - Soporte para `targetUserId` en creacion de hilos directos.
- `server/socket.ts`
  - Validacion de acceso en `evo:join`.
  - Sin `JWT_SECRET` no se permite handshake.
  - Enriquecimiento de `socket.data` con `institutionId`.
- `server/routes/courses.ts`
  - Nuevo endpoint de detalle de lectura para comunicados academicos.
- `server/db/pgSchemaPatches.ts`
  - Limpieza legacy idempotente de artefactos antiguos de comunicacion.
- `server/routes.ts`
  - Ejecucion de `ensureCommunicationLegacyCleanup()` en bootstrap.
- `client/src/pages/evo-send/index.tsx`
  - Header con contadores academico/institucional.
  - Composer multiformato (conversacion/comunicado/circular).
  - Integracion de People Finder.
  - Integracion de acuse de lectura para comunicados.
  - Prefill de contexto desde `?context=`.
- `client/src/pages/course-detail.tsx`
  - Atajos a EvoSend ahora incluyen contexto de origen.
- `client/src/pages/ComunicacionHome.tsx`
  - Redireccion de "Comunicados a Padres" al inbox unificado.
- `client/src/hooks/useEvoSocket.ts`
  - Exposicion de `clearLastRead` para refresco controlado de UI.
- `client/src/App.tsx`
  - Redireccion de rutas legacy de comunicacion al inbox unificado (`/evo-send`).

## Creado
- `server/services/evoSendAccess.ts`
  - Servicio centralizado de acceso a hilos y categorizacion.
- `docs/evosend-2.0-role-qa-checklist.md`
  - Checklist funcional por rol para validacion de demo.
- `docs/evosend-2.0-cleanup-audit.md`
  - Documento de cierre tecnico (este archivo).

## Eliminado
- `client/src/pages/profesor-comunicacion.tsx`
- `client/src/pages/directivo-comunicacion.tsx`
- `client/src/pages/asistente-comunicacion.tsx`
  - Eliminadas por convergencia: sustituido por inbox unificado con redirecciones.

## Estado final por paridad funcional (v0)
- Botones de crear, responder, buscar y marcar leido conectados a endpoints reales.
- Sin rutas muertas principales de comunicacion: los entrypoints legacy redirigen a `/evo-send`.
- Sin botones fantasma en el flujo principal de EvoSend (composer/lista/detalle/read).
- People Finder y Search operativos en backend y consumidos por frontend.

## Evidencia de validacion ejecutada
- `npm run dev` arrancado y revisado en logs.
- Endpoints probados con token real:
  - `GET /api/evo-send/threads`
  - `GET /api/evo-send/people-finder`
  - `GET /api/evo-send/search`
  - `PATCH /api/evo-send/threads/:id/read`
- Resultado: respuestas `200` y payload esperado para el modulo EvoSend.
