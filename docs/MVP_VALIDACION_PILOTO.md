# Prueba piloto completa e informe de validación del MVP

Este documento es la lista de comprobación para ejecutar la prueba piloto del MVP de AutoClose AI y generar el informe de validación.

## Cómo ejecutar la prueba piloto

### Opción A: Prueba E2E automática (Playwright)

La suite **e2e/piloto-mvp.spec.ts** cumple con los requisitos del checklist y puede ejecutarse así:

1. **Requisitos:** app corriendo (`npm run dev`), MongoDB conectado.
2. **Opcional:** variables `ADMIN_EMAIL` y `ADMIN_PASSWORD` (o `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`) para las pruebas que requieren login.
3. **Instalar navegador (una vez):** `npx playwright install chromium`
4. **Ejecutar piloto:**
   ```bash
   npm run test:e2e:piloto
   ```
   o con URL distinta: `BASE_URL=http://localhost:3000 npm run test:e2e:piloto`

Los resultados se ven en la consola y en `playwright-report/` (reporte HTML).

### Opción B: Con el agente de Cursor y navegador MCP

Para que el agente pueda abrir la app en el navegador y seguir el checklist paso a paso:

1. **Habilitar el navegador MCP** según **docs/COMO_HABILITAR_NAVEGADOR_MCP.md** (incluye uso de `.cursor/mcp.json`).
2. Arrancar la app (`npm run dev`) y tener MongoDB conectado.
3. Pedir al agente: *"Inicia la prueba piloto del MVP según docs/MVP_VALIDACION_PILOTO.md"*.

## Checklist de la prueba piloto

### 1. Creación de cuentas y roles
- [ ] Crear usuarios de tipo: admin general del colegio, directivo, profesor, estudiante, padre.
- [ ] Verificar que los IDs se generan correctamente (userId categorizado por rol: STU-, PROF-, PARENT-, ADMIN-).
- [ ] Confirmar que el admin general puede crear y asignar, y que el directivo solo puede visualizar.

### 2. Configuración académica
- [ ] Crear grupos/cursos (ej. "11A", "11B").
- [ ] Asignar estudiantes a grupos.
- [ ] Asignar profesores a materias/grupos.
- [ ] Vincular padres a estudiantes y activar cuentas.

### 3. Flujos operativos
- [ ] Profesor: crear una tarea en su curso.
- [ ] Estudiante: entregar la tarea.
- [ ] Profesor: calificar la tarea.
- [ ] Estudiante y padre: consultar la nota y el boletín.
- [ ] Directivo: visualizar todo en modo solo lectura.

### 4. Validación de dashboards
- [ ] Admin general: ver KPIs de usuarios, grupos, vinculaciones, Auditoría.
- [ ] Directivo: ver listas de profesores, estudiantes, padres, cursos, Resumen por curso y KPIs.
- [ ] Profesor: ver solo sus cursos y tareas.
- [ ] Estudiante: ver sus materias, tareas y notas.
- [ ] Padre: ver información de su hijo (notas, tareas, boletín).

### 5. Prueba de seguridad y permisos
- [ ] Confirmar que el directivo no puede crear/editar nada.
- [ ] Confirmar que solo el admin general puede hacer cambios de configuración.
- [ ] Validar que los GETs funcionan para roles de consulta.

### 6. Funciones transversales
- [ ] Auditoría: acciones de admin registradas y visibles en sección Auditoría.
- [ ] Notificaciones: notificación al vincular/confirmar/activar; badge en layout; página Notificaciones.
- [ ] Consentimiento: primer login redirige a /consent; términos y privacidad; tras aceptar, acceso al dashboard.
- [ ] Boletín: imprimir y Descargar PDF (abre HTML imprimible).
- [ ] Experiencia móvil: vistas estudiante y padre usables en móvil; PWA manifest presente.

## Resultado esperado

Flujo completo: admin crea usuarios y grupos → asigna estudiantes y profesores → vincula y activa → profesor crea tarea → estudiante entrega → profesor califica → estudiante y padre ven resultado → directivo visualiza todo (solo lectura).

## Tarea final

Tras ejecutar la prueba piloto (Opción A o B), generar un **informe de validación del MVP** con:

- Qué funciones pasaron.
- Cuáles fallaron.
- Qué ajustes son necesarios antes del lanzamiento.

Guardar el informe como `docs/INFORME_VALIDACION_MVP_YYYY-MM-DD.md`.

La suite E2E (`e2e/piloto-mvp.spec.ts`) está alineada con este checklist: cada ítem numerado tiene su correspondiente test o paso.
