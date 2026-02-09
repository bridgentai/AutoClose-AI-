# Arquitectura: Creación masiva de usuarios (multi-tenant)

## Contexto

- **Multi-tenant por colegio**: cada admin pertenece a un colegio y solo opera sobre su colegio.
- **Email como username**: el login usa email; unicidad de email es **por colegio** (mismo email puede existir en otro colegio).
- **Roles soportados en carga masiva**: `student` → estudiante, `teacher` → profesor, `parent` → padre.

---

## Flujo paso a paso

1. **Entrada**
   - Admin sube archivo (Excel `.xlsx` o CSV) **o** pega datos en tabla/texto estructurado.
   - Cada fila = un usuario.

2. **Parsing**
   - Backend recibe filas con: `nombre`, `apellido`, `email`, `rol`, `codigo_interno`, `curso_grupo` (opcional).
   - Se normaliza rol: `student`/`estudiante` → `estudiante`, `teacher`/`profesor` → `profesor`, `parent`/`padre` → `padre`.

3. **Validación por fila**
   - Campos obligatorios: nombre, apellido (o nombre completo), email, rol.
   - Email formato válido.
   - Rol en `student | teacher | parent` (o equivalentes en español).
   - **Regla multi-tenant**: si el email ya existe **en el mismo colegio** → fila rechazada con mensaje. Si existe en otro colegio → permitido (se crea en el colegio del admin).

4. **Creación**
   - Por cada fila válida: generar contraseña segura, hashear, crear usuario con `colegioId` del admin, estado `active` (o `pendiente_vinculacion` para estudiantes).
   - Errores se capturan por fila; el proceso no se aborta.

5. **Salida**
   - Resumen: total creados / total fallidos.
   - Tabla descargable (CSV/Excel): email, contraseña generada (solo en respuesta, no guardada en texto plano), código interno, colegio.

---

## Estructura de datos

### Entrada (por fila)

| Campo            | Tipo   | Obligatorio | Descripción                          |
|------------------|--------|-------------|--------------------------------------|
| nombre           | string | Sí          | Nombre(s)                            |
| apellido         | string | Sí*         | Apellido(s). *Si falta, todo va en `nombre` |
| email            | string | Sí          | Username / correo (único por colegio) |
| rol              | string | Sí          | `student` \| `teacher` \| `parent`   |
| codigo_interno   | string | No          | Matrícula / código profesor          |
| curso_grupo      | string | No          | Curso o grupo (ej. 7A, 10B)          |

### Respuesta del endpoint

```ts
{
  summary: { created: number; failed: number; total: number };
  created: Array<{
    email: string;
    passwordGenerated: string;  // Solo en esta respuesta, nunca en BD
    codigoInterno: string;
    colegioId: string;
    nombre: string;
    rol: string;
    rowIndex: number;
  }>;
  failed: Array<{
    rowIndex: number;
    email?: string;
    error: string;
  }>;
}
```

---

## Endpoints

| Método | Ruta                  | Descripción        | Body / Query |
|--------|------------------------|--------------------|--------------|
| POST   | `/api/users/bulk`      | Creación masiva    | JSON: `{ rows: BulkRow[] }` |

**Alternativa para archivo**: mismo `POST /api/users/bulk` con `Content-Type: multipart/form-data`, campo `file`. El backend parsea Excel/CSV y construye `rows` internamente.

**Autorización**: `protect` + rol `admin-general-colegio` (o `school_admin` si se desea). `colegioId` siempre desde `req.user.colegioId`.

---

## Backend: componentes

1. **Servicio `bulkUserService`**
   - `validateRow(row, colegioId)`: valida una fila y comprueba si el email ya existe en ese colegio.
   - `createBulkUsers(rows, colegioId)`: por cada fila válida crea usuario (contraseña generada con `crypto.randomBytes`), devuelve arrays `created` y `failed`.

2. **Ruta `POST /api/users/bulk`**
   - Obtiene `colegioId` de `req.user`.
   - Acepta JSON con `rows` o multipart con `file`.
   - Llama al servicio y responde con resumen + creados + fallidos.

3. **Seguridad**
   - Contraseñas: generación con `crypto.randomBytes` (16 bytes, base64 o similar), hasheadas con bcrypt en el modelo User (pre-save).
   - No guardar contraseñas en texto plano; devolver `passwordGenerated` solo en la respuesta de la creación masiva.

---

## Frontend: componentes

1. **Sección "Carga masiva"** en el panel de admin (admin-general-colegio).
2. **Pestañas o pasos**:
   - **Paso 1 – Entrada**: Upload (Excel/CSV) + área de pegado (texto/tabla).
   - **Paso 2 – Vista previa**: Tabla con las filas parseadas (editable si se desea).
   - **Paso 3 – Confirmar**: Botón "Crear usuarios" y advertencia de cantidad.
   - **Paso 4 – Resultados**: Resumen (creados/fallidos), tabla con email + contraseña + código + colegio, botón "Descargar CSV".
3. **Estilo**: Dark + purple según `design_guidelines.md` (glassmorphism, acentos #9f25b8 / #6a0dad).

---

## Escalabilidad (100–2000 usuarios)

- Procesar en **chunks** (ej. 100 usuarios por lote) para no bloquear el event loop.
- Respuesta HTTP puede ser grande; considerar compresión (gzip) y límite de filas (ej. máximo 2000 por solicitud).
- Opcional: job en background + notificación al terminar (para cargas muy grandes); en una primera versión, proceso síncrono con timeout suficiente es aceptable.

---

## Índice único en BD (multi-tenant)

Para permitir el mismo email en distintos colegios, en el modelo User:

- **Quitar** `unique: true` de `correo` a nivel de schema.
- **Añadir** índice compuesto único: `{ correo: 1, colegioId: 1 }, { unique: true }`.

Así la unicidad es (correo, colegioId) y no global.

**Migración**: Si la BD ya tenía un índice único global en `correo`, hay que eliminarlo antes de crear el compuesto (en MongoDB: `db.usuarios.dropIndex({ correo: 1 })`). Mongoose creará el nuevo índice al arrancar.
