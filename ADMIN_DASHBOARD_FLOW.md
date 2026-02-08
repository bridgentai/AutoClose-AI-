# Flujo del Dashboard Admin – Cursos como base (multi-tenant)

## Contexto

- **Multi-tenant por colegio**: Todas las operaciones usan `colegioId` del admin (token/sesión).
- **Cursos son la base**: Los cursos/grupos (11A, 11B, 11H) deben existir **antes** que profesores o estudiantes.
- **No hay materias independientes**: La materia es un **campo del profesor** (string), no una entidad que se cree por separado.
- **Flujo secuencial**: 1) Cursos → 2) Profesores (con materia) → 3) Asignar profesores a cursos → 4) Estudiantes (y asignarlos a curso).

---

## Modelo de datos (resumido)

| Entidad    | Descripción |
|-----------|-------------|
| **Group** | Curso/grupo (ej. 11A, 11B). `nombre`, `colegioId`, `seccion`. Opcional: director de grupo (profesor). |
| **User**  | Usuario. Profesor tiene `materias: string[]` (ej. `["Matemáticas"]`). Estudiante tiene `curso: string` (nombre del grupo). |
| **Course**| Asignación materia → profesores y grupos. `nombre` = nombre de la materia (viene del profesor), `profesorIds[]`, `cursos[]` = nombres de grupos (11A, 11B). No se crean “materias” sueltas; se crean al asignar profesor a grupos. |

Reglas:

- No crear materias como entidad independiente.
- No asignar profesores a cursos sin que existan los grupos.
- No permitir estudiantes sin curso asignado.

---

## Flujo paso a paso (admin)

1. **Cursos**  
   Crear grupos (11A, 11B, …). No se exige director de grupo; se puede asignar después.

2. **Profesores**  
   Crear profesor con: datos personales, email, código interno, **materia** que dicta (ej. Matemáticas). El profesor aún no está asignado a ningún curso.

3. **Asignar profesores a cursos**  
   Elegir profesor y uno o más **cursos/grupos** existentes. Se crea/actualiza la relación “esta materia (del profesor) se dicta en estos grupos”.

4. **Estudiantes**  
   Crear estudiantes y asignar cada uno a un **curso/grupo** existente. El sistema infiere materias y profesores desde el curso.

---

## Endpoints REST (todos filtrados por `colegioId` del admin)

### Cursos (Groups)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/groups/all` | Lista grupos del colegio. |
| POST | `/api/groups/create` | Crear grupo. Body: `nombre`, `seccion`, `directorGrupoId?` (opcional para “cursos primero”). |

### Profesores

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/users/by-role?rol=profesor` | Lista profesores del colegio. |
| POST | `/api/users/create` | Crear usuario. Si `rol=profesor`, body puede incluir `materia` (string); se guarda en `User.materias`. |

### Asignar profesor a cursos (grupos)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/courses/assign-professor-to-groups` | Asignar un profesor a uno o más grupos. Body: `professorId`, `groupNames: string[]` (ej. `["11A","11B"]`). La materia se toma del profesor; se crea/actualiza `Course` con ese nombre y los grupos. |

### Estudiantes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/users/by-role?rol=estudiante` | Lista estudiantes del colegio. |
| POST | `/api/users/create` | Crear estudiante. |
| POST | `/api/groups/assign-student` | Asignar estudiante a un grupo. Body: `grupoId` (nombre del grupo), `estudianteId`. |

Todos los endpoints de escritura validan que los recursos pertenezcan al mismo `colegioId` que el admin (`req.user.colegioId`). Roles permitidos: `admin-general-colegio` y `school_admin`.

---

## Componentes UI del dashboard (secuencial)

1. **Cursos**  
   - Listar grupos del colegio.  
   - Formulario: crear curso (nombre, sección; director de grupo opcional).  

2. **Profesores**  
   - Listar profesores.  
   - Formulario: crear profesor (nombre, email, código interno, **materia**).  

3. **Asignaciones (profesor → cursos)**  
   - Selector: profesor + uno o más grupos.  
   - Botón “Asignar”: llama a `POST /api/courses/assign-professor-to-groups`.  
   - Vista de “qué profesor dicta en qué grupos” (desde cursos/materias).  

4. **Estudiantes**  
   - Listar estudiantes (y su curso).  
   - Crear estudiante.  
   - Asignar estudiante a curso (grupo).  

UI simple, ordenada y reversible (sin dependencias implícitas fuera del curso).
