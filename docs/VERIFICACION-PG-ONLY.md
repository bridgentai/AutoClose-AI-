# Verificación: todo funcionando solo con PostgreSQL

Cuando el servidor arranca con `USE_POSTGRES_ONLY=true`, **no se usa MongoDB**. Esta guía sirve para comprobar que el flujo es el mismo usando solo PG.

## 1. Health y modo del servidor

Con el servidor en marcha (`USE_POSTGRES_ONLY=true npm run dev`):

```bash
curl -s http://localhost:3000/api/health | jq
```

Deberías ver algo como:

```json
{
  "status": "ok",
  "postgres": {
    "configured": true,
    "postgres_only": true,
    "counts": { "users": 1124, "institutions": 1, "groups": 84 }
  }
}
```

- Si `postgres_only` es `true`: el backend está en modo solo-PG (no hay conexión a Mongo).
- Si `counts` tiene números coherentes: la base PG tiene datos y el health puede leerla.

## 2. Login (auth con PG)

1. En el front (http://localhost:3000) ve a **Iniciar sesión**.
2. Inicia con un usuario que exista en PG (mismo email/contraseña que antes).
3. Debe redirigir al dashboard sin error.

Si falla con "Usuario no encontrado" o 401, el token se está validando contra PG; revisa que ese usuario exista en la tabla `users` y que el password coincida (auth usa `findUserById` y bcrypt en `server/routes/auth.ts`).

## 3. Endpoints que usan solo PG (lista rápida)

Puedes probarlos **después de login** (necesitas el token en `Authorization: Bearer <token>`).

| Qué comprobar | Método y ruta | Esperado |
|---------------|----------------|----------|
| Institución   | `GET /api/institution/config` | 200 + config del colegio |
| Usuario actual | `GET /api/users/me` (o el que uses para perfil) | 200 + datos del usuario |
| Cursos / materias | `GET /api/courses` o `GET /api/subjects` | 200 + lista (puede ser vacía) |
| Grupos        | `GET /api/groups` | 200 + lista |
| Tareas        | `GET /api/assignments` o `GET /api/assignments/student` | 200 + lista |
| Asistencia    | `GET /api/attendance/...` (según tu ruta) | 200 + datos o vacío |
| Notificaciones | `GET /api/notifications` | 200 + lista |
| Eventos       | `GET /api/events` | 200 + lista |
| Mensajes      | `GET /api/messages/conversations` | 200 + lista |
| Chat IA       | `GET /api/chat/sessions` | 200 + lista |

El 401 en `/api/institution/config` que viste suele ser **porque esa petición no llevaba token** (ej. al cargar la app antes de login). No indica fallo de PG. Tras hacer login en el front, esas mismas rutas deberían ir con token y devolver 200 cuando haya datos.

## 4. Flujos por rol (qué probar en la app)

- **Estudiante**: login → dashboard → ver materias/tareas/notas → ver asistencia (si hay rutas para ello).
- **Profesor**: login → ver cursos/grupos → ver tareas → listar estudiantes (según rutas).
- **Directivo / admin**: login → ver usuarios, grupos, reportes, institución.

Si esos flujos funcionan como antes (solo que sin Mongo), **todo está funcionando igual con PostgreSQL**.

## 5. Script de validación sin Mongo

Para comprobar que el script de migración no toque Mongo cuando quieres solo PG:

```bash
USE_POSTGRES_ONLY=true npx tsx scripts/migrate/dual-read-compare.ts
```

Salida esperada: mensaje tipo "USE_POSTGRES_ONLY=true: skipping MongoDB" y "PG-only validation passed", **sin** líneas de conexión a MongoDB.

## 6. Resumen

| Comprobación | Cómo |
|--------------|------|
| Servidor solo PG | `GET /api/health` → `postgres.postgres_only === true` y `counts` con datos. |
| Login y token   | Login en el front; luego las peticiones con token no deben dar 401 por “usuario no encontrado”. |
| Datos en PG     | Misma app que antes: dashboard, listas, detalle; si ves datos coherentes, PG está sirviendo todo. |

Si todo lo anterior se cumple, puedes considerar que **todo funciona igual pero con PostgreSQL** en modo `USE_POSTGRES_ONLY=true`.
