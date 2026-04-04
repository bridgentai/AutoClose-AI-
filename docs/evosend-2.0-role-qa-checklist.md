# EvoSend 2.0 - Checklist QA por Rol

## Estudiante
- [ ] Abre `/evo-send` y ve solo hilos permitidos por curso/colegio.
- [ ] Puede enviar mensaje solo dentro de ventana horaria permitida.
- [ ] Si intenta leer/marcar hilo no permitido, API devuelve `403`.
- [ ] Recibe actualización en tiempo real de nuevos mensajes (`evo:message`).
- [ ] Ve breadcrumb/navegación correcta y sin rutas rotas.

## Padre
- [ ] Abre `/evo-send` y visualiza hilos familiares/directos autorizados.
- [ ] Puede marcar como leído y refrescar badge de no leídos.
- [ ] Puede responder en hilo permitido y ver su mensaje en la conversación.
- [ ] No puede acceder a hilos de otros estudiantes o cursos.
- [ ] Las acciones de búsqueda/directorio no muestran usuarios fuera de su alcance.

## Profesor
- [ ] Ve hilos de sus cursos + colegas + soporte.
- [ ] Composer en modo conversación permite elegir destinatario vía People Finder.
- [ ] Composer en modo comunicado/curso crea hilo real (sin botones fantasma).
- [ ] Panel de acuse de lectura muestra detalle para comunicados académicos.
- [ ] Desde detalle de curso abre EvoSend con contexto (`?context=`) precargado.

## Directivo / Coordinación
- [ ] Ve inbox completo supervisado (cursos/colegas/directos/soporte).
- [ ] People Finder devuelve resultados del colegio filtrados por permisos.
- [ ] `/api/evo-send/search` responde resultados relevantes sin error.
- [ ] Puede marcar leído en hilos autorizados y emite evento `evo:read`.
- [ ] Contadores por categoría (`academico` / `institucional`) cargan correctamente.

## Asistente Académica
- [ ] Accede a `/evo-send` por redirección desde rutas legacy.
- [ ] Puede ver y usar hilos autorizados del colegio.
- [ ] Endpoint de asistencia (`/api/evo-send/attendance-inbox`) funciona para rol `asistente`.
- [ ] No hay acceso a hilos de otra institución.
- [ ] Todas las acciones relevantes completan sin errores 4xx/5xx inesperados.

## Criterios transversales (Go/No-Go)
- [ ] No existen rutas muertas de comunicación (legacy redirige a EvoSend).
- [ ] No hay botones sin acción real (composer, búsqueda, lectura, envío).
- [ ] No hay lógica huérfana en frontend/backend de EvoSend.
- [ ] Logs de `npm run dev` no muestran errores críticos del módulo.
- [ ] Multi-tenant: aislamiento por `institution_id` verificado en accesos.
