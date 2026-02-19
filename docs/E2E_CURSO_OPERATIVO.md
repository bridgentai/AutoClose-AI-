# Prueba E2E - Curso Operativo Completo

Guía para ejecutar el test piloto que simula la **operación real de un colegio** en producción: crea admin, profesores, estudiantes, padres, tareas, entregas, calificaciones y valida UI y permisos. Genera credenciales y resumen al final.

## Resumen del test

| Campo | Valor |
|-------|--------|
| **Archivo** | `e2e/piloto-curso-operativo.spec.ts` |
| **Tests** | 12 (ejecutados en serie) |
| **Duración estimada** | 8-12 minutos |
| **Modo** | Híbrido (API + UI) |
| **Logs** | Paso a paso en consola + resumen en archivos |

## Checklist previo

Antes de ejecutar:

- [ ] **Servidor corriendo:** `npm run dev` en otra terminal
- [ ] **MongoDB conectado** (ver mensaje en consola del servidor)
- [ ] **Puerto 3000** libre y accesible
- [ ] **Navegador Playwright:** `npx playwright install chromium` (una vez)

## Ejecución

```bash
# 1. Iniciar servidor (en otra terminal)
npm run dev

# 2. Ejecutar test
npm run test:e2e:curso-operativo
```

**Modo rápido (menos volumen):** Con `PILOTO_RAPIDO=1` se crean 10 estudiantes (20 padres) en lugar de 25 (50 padres). Útil para iterar más rápido:
```bash
PILOTO_RAPIDO=1 npm run test:e2e:curso-operativo
```

O con playwright directamente:

```bash
npx playwright test e2e/piloto-curso-operativo.spec.ts
```

## Estructura de los 12 tests

| # | Nombre | Descripción |
|---|--------|-------------|
| 1 | Crear admin y grupo Noveno A | Registro admin, creación grupo |
| 2 | Crear 5 profesores | Profesores por materia, asignación al grupo |
| 3 | Crear 25 estudiantes | Estudiantes y asignación al grupo |
| 4 | Crear 50 padres | Padres vinculados, confirmación, activación (~4-6 min) |
| 5 | Crear 6 tareas | Tareas vía API |
| 6 | Validación UI: tareas visibles | Profesor, estudiante, padre ven tareas |
| 7 | Entregas vía UI | 3 estudiantes entregan tarea |
| 8 | Calificar entregas | Calificaciones vía API |
| 9 | Validación vista padre: dashboard | Padre accede a dashboard |
| 10 | Permisos: padre no accede a profesor | Redirección correcta |
| 11 | Permisos: estudiante no accede a admin | Sin panel admin |
| 12 | Generar credenciales JSON | Archivo en `docs/CREDENCIALES_PILOTO_CURSO_YYYY-MM-DD.json` |

## Salida

Al finalizar (éxito o fallo) se generan:

| Archivo | Descripción |
|---------|-------------|
| `docs/prueba-curso-completo-2/CREDENCIALES_PILOTO_CURSO_YYYY-MM-DD.json` | Credenciales de todas las cuentas creadas (admin, profesores, estudiantes, padres) |
| `docs/prueba-curso-completo-2/RESUMEN_PRUEBA_PILOTO_YYYY-MM-DD.md` | Resumen ejecutivo: tests OK/FAIL, pasos, errores, duración |
| `docs/prueba-curso-completo-2/RESULTADOS_PRUEBA_PILOTO_YYYY-MM-DD.json` | Resultados estructurados en JSON para análisis |

**Consola:** logs paso a paso con timestamps y credenciales al final.

## Especificaciones de errores

### Prefijos en mensajes de error

| Prefijo | Significado | Dónde ocurre |
|---------|-------------|--------------|
| `[SERVIDOR]` | Servidor no responde o no está corriendo | beforeAll, health check |
| `[AUTH]` | Fallo de login o registro | login(), registro admin |
| `[API]` | Llamada HTTP fallida (4xx, 5xx) | authenticatedRequest() |
| `[REGISTRO]` | Error en registro de usuario | Test 1 |
| `[CURSOS]` | No hay cursos o fallo en asignación | Tests 2, 5 |
| `[PRERREQUISITO]` | Dato requerido no disponible (test anterior falló) | Cualquier test |
| `[ENTREGA]` | Formulario de entrega no visible o falló | Test 7 |

### Códigos y causas típicas

| Error | Causa | Acción |
|-------|-------|--------|
| `net::ERR_CONNECTION_REFUSED` | Servidor apagado | `npm run dev` |
| `[AUTH] Login fallido para X. Respuesta: 401` | Email/contraseña incorrectos o cuenta no activa | Verificar que el usuario fue creado y activado |
| `[AUTH] No se recibió token` | API devuelve 200 pero sin campo `token` | Revisar respuesta de `/api/auth/login` |
| `[API] POST /api/users/create falló (400)` | Datos inválidos o usuario ya existe | Revisar body del request y unicidad de email |
| `[API] POST /api/groups/assign-student falló (404)` | grupoId incorrecto o no existe | Verificar que el grupo "Noveno A" existe |
| `[CURSOS] Debe existir al menos un curso` | Profesores no asignados correctamente al grupo | Revisar Test 2, assign-professor-to-groups |
| `[PRERREQUISITO] Requiere padres (test 4)` | Test 4 falló o no se ejecutó | Ejecutar suite completa en orden |
| `Cannot read properties of undefined (reading 'email')` | `created.padres[0]` o `created.estudiantes[0]` undefined | Ejecutar tests en serie; no saltar tests |
| Timeout en `getByTestId('button-create-assignment')` | Ruta /teacher-calendar no renderiza el botón | Verificar componente y data-testid |
| Timeout en `[data-testid="input-comentario"]` | Formulario de entrega no visible o ruta distinta | Verificar /assignment/:id y permisos estudiante |
| `expect(page).not.toHaveURL(/\/profesor\/academia/)` falla | Padre sí puede acceder (bug de permisos) | Revisar middleware de rutas /profesor/* |

## Errores comunes y soluciones

### `net::ERR_CONNECTION_REFUSED` / Servidor no responde

**Causa:** El servidor no está corriendo en `localhost:3000`.

**Solución:**
```bash
npm run dev
# Esperar mensaje "🚀 Servidor iniciado exitosamente!"
```

### `Cannot read properties of undefined (reading 'email')` (tests 9, 10, 11)

**Causa:** El array `padres` o `estudiantes` está vacío porque un test anterior falló o se ejecutó fuera de orden.

**Solución:** Ejecutar **toda la suite** en modo serial. No ejecutar tests 9-11 de forma aislada. Si el test 4 falla (crear padres), los 9-11 fallarán por falta de datos.

### `Requiere profesores (test 2)` / `Requiere padres (test 4)` / etc.

**Causa:** Tests ejecutados fuera de orden o un test anterior falló.

**Solución:** Ejecutar la suite completa con `npm run test:e2e:curso-operativo` (modo serial).

### Timeout en test 4 (`apiRequestContext.post: Timeout 15000ms exceeded`)

**Causa:** Cada llamada API tenía timeout de 15s por defecto. Con ~150 llamadas secuenciales (50 padres + vinculaciones + confirmación + activación), el servidor se carga y algunas respuestas superan 15s.

**Solución:** Se aumentó el timeout por request a **60s** (`API_REQUEST_TIMEOUT`). El test 4 tiene timeout total de 8 min. Si persiste, revisar latencia de MongoDB, bcrypt o red.

### Formulario de entrega no visible (test 7)

**Causa:** La ruta `/assignment/:id` puede requerir estructura específica o el estudiante no tiene acceso a esa tarea.

**Solución:** Verificar que el estudiante está asignado al grupo del curso de la tarea. Revisar la UI del detalle de tarea.

## Logs y seguimiento paso a paso

Durante la ejecución verás en consola:

- `[PILOTO] >>> TEST N: Nombre` — inicio de cada test
- `[PILOTO]     ✓ Paso` — paso completado correctamente
- `[PILOTO]     ✗ Paso | Error: ...` — paso fallido con detalle
- `[PILOTO] <<< FIN TEST N: OK/FAIL (Xms)` — resumen del test
- Credenciales al final con formato `Rol: email / password`

Todos los pasos y errores se registran en el archivo de resumen Markdown.

## Modo debug

```bash
# Ver el navegador en acción
PWDEBUG=1 npm run test:e2e:curso-operativo

# Modo UI interactivo
npm run test:e2e:ui
# Luego seleccionar e2e/piloto-curso-operativo.spec.ts
```

## Notas técnicas

- **Modo serial:** Los tests comparten el objeto `created`; deben ejecutarse en orden.
- **Selectores de login:** Usa `getByLabel` y `getByRole` (no `data-testid`) para compatibilidad con la página de login actual.
- **Helper `loginViaUI`:** Login por UI + `ensureConsent` si redirige a `/consent`.
