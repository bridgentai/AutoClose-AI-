# Resumen Prueba Piloto - Curso Operativo

**Fecha de ejecución:** 2026-02-13T04:11:01.593Z
**Duración total:** 399 segundos

## Resultado global

| Métrica | Valor |
|---------|-------|
| Tests ejecutados | 6 |
| OK | 5 |
| Fallidos | 1 |
| Omitidos | 0 |

## Detalle por test

### ✅ Test 1: Crear admin y grupo Noveno A

- **Estado:** OK (2836ms)
- **Pasos:**
  - ✓ Registro de admin en API — POST /api/auth/register
  - ✓ Admin creado — piloto-curso-1770955861593-admin@colegio-piloto.local
  - ✓ Login admin vía API — Obteniendo token
  - ✓ Listar grupos existentes — GET /api/groups/all
  - ✓ Grupo Noveno A ya existía — ID: 698d1d76b6196dcf681a081a

### ✅ Test 2: Crear 5 profesores y asignar al grupo

- **Estado:** OK (14322ms)
- **Pasos:**
  - ✓ Crear profesor Matemáticas — piloto-curso-1770955861593-prof0@colegio-piloto.local
  - ✓ Crear profesor Español — piloto-curso-1770955861593-prof1@colegio-piloto.local
  - ✓ Crear profesor Ciencias — piloto-curso-1770955861593-prof2@colegio-piloto.local
  - ✓ Crear profesor Sociales — piloto-curso-1770955861593-prof3@colegio-piloto.local
  - ✓ Crear profesor Inglés — piloto-curso-1770955861593-prof4@colegio-piloto.local
  - ✓ 5 profesores creados — piloto-curso-1770955861593-prof0@colegio-piloto.local, piloto-curso-1770955861593-prof1@colegio-piloto.local, piloto-curso-1770955861593-prof2@colegio-piloto.local, piloto-curso-1770955861593-prof3@colegio-piloto.local, piloto-curso-1770955861593-prof4@colegio-piloto.local
  - ✓ Asignar Matemáticas al grupo
  - ✓ Asignar Español al grupo
  - ✓ Asignar Ciencias al grupo
  - ✓ Asignar Sociales al grupo
  - ✓ Asignar Inglés al grupo
  - ✓ Profesores asignados al grupo — 5 cursos

### ✅ Test 3: Crear 25 estudiantes y asignar al grupo

- **Estado:** OK (72798ms)
- **Pasos:**
  - ✓ Estudiantes 0-5/25 creados y asignados
  - ✓ Estudiantes 5-10/25 creados y asignados
  - ✓ Estudiantes 10-15/25 creados y asignados
  - ✓ Estudiantes 15-20/25 creados y asignados
  - ✓ Estudiantes 20-25/25 creados y asignados
  - ✓ 25 estudiantes creados y asignados al grupo Noveno A — 25 registrados

### ✅ Test 4: Crear padres, vincular, confirmar y activar

- **Estado:** OK (274760ms)
- **Pasos:**
  - ✓ Creando 50 padres (2 por estudiante) y vinculando — ~150 llamadas API
  - ✓ 50 padres creados y vinculados — 50 padres
  - ✓ Confirmar vinculaciones por estudiante — 25 estudiantes
  - ✓ Activar cuentas de estudiantes y padres — 25 estudiantes
  - ✓ 50 padres vinculados y cuentas activadas — Proceso completo

### ✅ Test 5: Crear 6 tareas

- **Estado:** OK (16292ms)
- **Pasos:**
  - ✓ Verificar profesores y cursos — 5 profesores
  - ✓ Login como profesor — piloto-curso-1770955861593-prof0@colegio-piloto.local
  - ✓ Crear tarea 1/6 — POST /api/assignments
  - ✓ Crear tarea 2/6 — POST /api/assignments
  - ✓ Crear tarea 3/6 — POST /api/assignments
  - ✓ Crear tarea 4/6 — POST /api/assignments
  - ✓ Crear tarea 5/6 — POST /api/assignments
  - ✓ Crear tarea 6/6 — POST /api/assignments
  - ✓ 6 tareas creadas — Tarea 1 - Matemáticas; Tarea 2 - Matemáticas; Tarea 3 - Matemáticas; Tarea 4 - Matemáticas; Tarea 5 - Matemáticas; Tarea 6 - Matemáticas

### ❌ Test 6: Validación UI: tareas visibles en profesor, estudiante, padre

- **Estado:** FAIL (17079ms)
- **Error:** [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('body')
Timeout: 15000ms
Expected pattern: [32m/Calendario del Mes|Calendario General|tarea|calendario/i[39m
Received string:  [31m"[39m
[31m    Aceptación de términos y privacidadPara continuar usando la plataforma debe aceptar los términos y condiciones y la política de privacidad.He leído y acepto los  Términos y CondicionesHe leído y acepto la  Política de PrivacidadAceptar y continuar········[39m
[31m"[39m

Call log:
[2m  - Expect "toContainText" with timeout 15000ms[22m
[2m  - waiting for locator('body')[22m
[2m    19 × locator resolved to <body>…</body>[22m
[2m       - unexpected value "[22m
[2m    Aceptación de términos y privacidadPara continuar usando la plataforma debe aceptar los términos y condiciones y la política de privacidad.He leído y acepto los  Términos y CondicionesHe leído y acepto la  Política de PrivacidadAceptar y continuar[22m
[2m    [22m
[2m  [22m
[2m"[22m

- **Pasos:**
  - ✓ Login profesor vía UI — piloto-curso-1770955861593-prof0@colegio-piloto.local
  - ✓ Navegar a /teacher-calendar
  - ✓ Esperar contenido de página

