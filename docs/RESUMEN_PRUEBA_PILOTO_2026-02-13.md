# Resumen Prueba Piloto - Curso Operativo

**Fecha de ejecución:** 2026-02-13T02:59:16.749Z
**Duración total:** 131 segundos

## Resultado global

| Métrica | Valor |
|---------|-------|
| Tests ejecutados | 4 |
| OK | 3 |
| Fallidos | 1 |
| Omitidos | 0 |

## Detalle por test

### ✅ Test 1: Crear admin y grupo Noveno A

- **Estado:** OK (2424ms)
- **Pasos:**
  - ✓ Registro de admin en API — POST /api/auth/register
  - ✓ Admin creado — piloto-curso-1770951556750-admin@colegio-piloto.local
  - ✓ Login admin vía API — Obteniendo token
  - ✓ Listar grupos existentes — GET /api/groups/all
  - ✓ Grupo Noveno A ya existía — ID: 698d1d76b6196dcf681a081a

### ✅ Test 2: Crear 5 profesores y asignar al grupo

- **Estado:** OK (10814ms)
- **Pasos:**
  - ✓ Crear profesor Matemáticas — piloto-curso-1770951556750-prof0@colegio-piloto.local
  - ✓ Crear profesor Español — piloto-curso-1770951556750-prof1@colegio-piloto.local
  - ✓ Crear profesor Ciencias — piloto-curso-1770951556750-prof2@colegio-piloto.local
  - ✓ Crear profesor Sociales — piloto-curso-1770951556750-prof3@colegio-piloto.local
  - ✓ Crear profesor Inglés — piloto-curso-1770951556750-prof4@colegio-piloto.local
  - ✓ 5 profesores creados — piloto-curso-1770951556750-prof0@colegio-piloto.local, piloto-curso-1770951556750-prof1@colegio-piloto.local, piloto-curso-1770951556750-prof2@colegio-piloto.local, piloto-curso-1770951556750-prof3@colegio-piloto.local, piloto-curso-1770951556750-prof4@colegio-piloto.local
  - ✓ Asignar Matemáticas al grupo
  - ✓ Asignar Español al grupo
  - ✓ Asignar Ciencias al grupo
  - ✓ Asignar Sociales al grupo
  - ✓ Asignar Inglés al grupo
  - ✓ Profesores asignados al grupo — 5 cursos

### ✅ Test 3: Crear 25 estudiantes y asignar al grupo

- **Estado:** OK (60505ms)
- **Pasos:**
  - ✓ Estudiantes 0-5/25 creados y asignados
  - ✓ Estudiantes 5-10/25 creados y asignados
  - ✓ Estudiantes 10-15/25 creados y asignados
  - ✓ Estudiantes 15-20/25 creados y asignados
  - ✓ Estudiantes 20-25/25 creados y asignados
  - ✓ 25 estudiantes creados y asignados al grupo Noveno A — 25 registrados

### ❌ Test 4: Crear 50 padres, vincular, confirmar y activar

- **Estado:** FAIL (56841ms)
- **Error:** apiRequestContext.post: Timeout 15000ms exceeded.
Call log:
[2m  - → POST http://localhost:3000/api/users/create[22m
[2m    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.6 Safari/537.36[22m
[2m    - accept: */*[22m
[2m    - accept-encoding: gzip,deflate,br[22m
[2m    - Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5OGU5Mzg1MmRhNmU5NGJhYTRlN2I1OCIsImlhdCI6MTc3MDk1MTU1OCwiZXhwIjoxNzczNTQzNTU4fQ.a4eHWdKtPRfkHydRIFXtD-TNsEKoTDZ5gwo3uj6TEHY[22m
[2m    - Content-Type: application/json[22m
[2m    - content-length: 116[22m

- **Pasos:**
  - ✓ Creando 50 padres (2 por estudiante) y vinculando — ~150 llamadas API

