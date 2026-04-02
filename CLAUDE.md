# CLAUDE.md — Evo.OS
> Contexto completo para Claude Code. Leer SIEMPRE antes de tocar cualquier archivo.

---

## Identidad del Proyecto

**Evo.OS** es un LMS SaaS multi-tenant para colegios privados colombianos.
- **Beta activa:** Caobos Beta 1 — Gimnasio Los Caobos
- **institution_id demo:** `f0000000-0000-0000-0000-000000000001`
- **Competidor principal a superar:** Phidias (LMS colombiano, 4.7/5 en Capterra con 415 opiniones)
- **Objetivo diferenciador:** IA integrada por rol, Google Workspace nativo, diseño moderno, sin scroll infinito, UX superior a Phidias

**La demo de presentación es en 7 días. Prioridad máxima: 5 roles funcionales sin errores.**

---

## Directorio de Trabajo

**SIEMPRE trabajar en:** `/Users/alejosua/Documents/Evo.OS`

- Nunca usar worktrees temporales (`.claude/worktrees/`)
- Nunca crear carpetas fuera del directorio raíz del proyecto
- Verificar con `pwd` al inicio de cada sesión

---

## Comandos Esenciales

```bash
# Desarrollo (corre en http://localhost:5000, abre browser automático)
npm run dev

# TypeScript type-check — correr SIEMPRE antes de hacer commit
npm run check

# Build de producción
npm run build

# Producción
npm start

# E2E tests (Playwright)
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:piloto

# Seeds de datos
npm run seed:bodytech
npm run seed:horarios
```

---

## Arquitectura del Repositorio

Monorepo fullstack: Express sirve la API REST + el cliente React (Vite).

```
server/
  index.ts              # Entry point Express
  routes.ts             # Registro central de rutas
  routes/               # Un archivo por dominio (auth, courses, attendance...)
  models/               # Mongoose models (MongoDB legacy — NO tocar)
  db/
    schema.sql          # Schema PostgreSQL — fuente de verdad de la DB
  repositories/         # Capa de acceso a datos PG (un archivo por entidad)
  mappers/              # Transformación entre DB shape y API shape
  middleware/
    auth.ts             # protect(), AuthRequest, UserRole
    roleAuth.ts         # requireRole(), validateUserAccess(), checkAdminColegioOnly
  services/             # Lógica de negocio: AI, grading, sync, audit, evoSend...
  config/
    env.ts              # Carga .env, exporta ENV
    db-pg.ts            # Pool PostgreSQL (getPgPool, queryPg)
  socket.ts             # Socket.IO para EvoSend

client/src/
  App.tsx               # Router wouter + imports por rol
  pages/                # Vistas organizadas por prefijo de rol
  components/           # UI compartida (Radix UI / shadcn-style)
  lib/
    authContext.tsx      # AuthProvider, useAuth — JWT en localStorage
    queryClient.ts      # TanStack Query config
  hooks/                # useEvoSocket, useInstitutionColors, etc.

shared/
  schema.ts             # Interfaces TypeScript compartidas

e2e/                    # Playwright E2E tests
```

---

## Base de Datos

**Motor activo:** PostgreSQL en Neon (`DATABASE_URL` en `.env`)
**Legacy:** MongoDB (Mongoose en `server/models/`) — NO migrar ni tocar sin orden explícita

### Modo de operación
| Condición | Modo |
|---|---|
| `DATABASE_URL` set | PostgreSQL only |
| Sin `DATABASE_URL` | MongoDB (legacy) |

### Arquitectura central de la DB
```
institutions
  └── sections
        └── groups
              └── group_subjects   (groups + subjects + teacher_id)
                    └── [attendance, grades, drive, chat]

enrollments       → student_id    → group_id
guardian_students → guardian_id   → student_id
```

### Reglas absolutas de DB
- **SIEMPRE** filtrar por `institution_id` en TODAS las queries
- **SIEMPRE** usar `COALESCE(gs.display_name, s.name)` para nombres de materias — nunca `s.name` solo
- **NUNCA** inventar columnas que no existan en `schema.sql` — leerlo antes de escribir cualquier query
- `super_admin` es el único rol que bypasea el filtro de `institution_id`
- Toda tabla de actividad referencia `group_subject_id` — nunca `group_id` directo para actividades académicas

### Pattern para nuevas queries
```typescript
// Siempre usar queryPg de server/config/db-pg.ts
import { queryPg } from '../config/db-pg';

const result = await queryPg<MyType>(
  `SELECT ... FROM table WHERE institution_id = $1`,
  [institutionId]
);
```

---

## Autenticación y Seguridad

### JWT Flow
- Header: `Authorization: Bearer <token>`
- Frontend: token en `localStorage` bajo `autoclose_token` y `autoclose_user`
- `protect` middleware → decodifica → adjunta `req.user` con: `id`, `categorizedId`, `colegioId`, `institution_id`, `rol`, `curso`, `materias`

### Middleware de protección (orden obligatorio)
```typescript
router.get('/ruta', protect, requireRole('profesor', 'directivo'), handler);
// 1. protect siempre primero
// 2. requireRole define qué roles pueden acceder
// 3. checkAdminColegioOnly para writes de admin
```

### Reglas de seguridad — NUNCA violar
1. Toda ruta de API lleva `protect` primero — sin excepciones
2. Validar `institution_id` en TODA query — sin excepciones
3. No exponer datos de otros colegios — verificar aislamiento multi-tenant
4. No loggear tokens ni passwords en ningún servicio
5. No modificar `auditLogger.ts` sin contexto explícito
6. No modificar `rolePermissions.ts` sin orden explícita
7. Sanitizar inputs antes de cualquier query con parámetros `$1, $2...` — nunca string interpolation en SQL
8. Rate limiting aplicado en rutas de AI (`/api/ai/*`, `/api/chat/*`)

---

## Sistema de Roles

Definidos en `UserRole` en `server/middleware/auth.ts`:

| Rol | Acceso principal |
|---|---|
| `super_admin` | Todo el sistema, todos los colegios |
| `admin-general-colegio` | Gestión completa de su institución |
| `directivo` | Reportes, comunicados institucionales, vista global del colegio |
| `profesor` | Sus materias, asistencia, calificaciones, EvoSend, comunicados a padres |
| `estudiante` | Sus materias, notas, asistencia, chat, drive |
| `padre` | Seguimiento académico de sus hijos, comunicados, chat con profesores |
| `asistente` | Soporte administrativo, vista acotada |
| `tesoreria` | Módulo financiero |
| `transporte` | Módulo de transporte |
| `enfermeria` | Módulo de salud |
| `directora-academica` | Vista académica global + comunicados + reportes IA (ROL PENDIENTE) |

### Prefijos de páginas por rol
```
pages/profesor-*        → vistas de profesor
pages/directivo-*       → vistas de directivo
pages/estudiante-*      → vistas de estudiante
pages/padre-*           → vistas de padre (EN CONSTRUCCIÓN)
pages/admin-*           → vistas de admin-general-colegio
pages/directora-*       → vistas de directora académica (POR CREAR)
```

---

## Módulos Principales

### EvoSend (Chat en tiempo real)
- Socket.IO en `/api/evo-send-ws`
- Hook: `useEvoSocket`
- Eventos: `evo:join`, `evo:leave`, `evo:message`
- JWT requerido en handshake
- Canales: por `group_subject_id`, grupos de colegas, soporte

### Evo Drive
- Almacenamiento por `group_subject` con Google Drive OAuth
- Google OAuth unificado pendiente (login + Drive + Gmail en un solo flujo)

### Calificaciones
- Sistema de logros + indicadores ponderados
- Promedios calculados con pesos — no promedios simples
- Boletines generados con OpenAI

### Asistencia
- Registro por materia (`group_subject_id`)
- Análisis IA con OpenAI
- Export a Excel

### Kiwi Assist (Chatbot IA)
- Rutas: `POST /api/ai/*` y `POST /api/chat/*`
- OpenAI client en `server/services/openai.ts`
- Tool-calling: `aiFunctions.ts` → `actionExecutor.ts` → repositories
- Personalizado por rol — responde diferente a profesor vs estudiante vs padre
- **Estado:** configuración del agente global pendiente

### Notificaciones
- In-app + email Gmail
- Comunicados: académicos (profesor→padres) e institucionales (directivo→todos)

---

## Diseño Visual — Reglas Estrictas

```css
/* Variables a usar siempre — NUNCA hex directo en código */
--background: #07090f        /* Fondo base casi negro */
--primary: #2563eb           /* Azul principal */
--card-bg: rgba(255,255,255,0.03)
--card-border: rgba(255,255,255,0.07)
--text-primary: #ffffff
--text-secondary: rgba(255,255,255,0.6)
--text-muted: rgba(255,255,255,0.4)
```

### Reglas de UI — NUNCA violar
- Sin emojis en código
- Sin Tailwind hardcodeado — usar variables CSS o clases de utilidad del sistema
- Sin colores hex directos — usar variables CSS
- Sin scroll vertical infinito — usar paginación, tabs o secciones colapsables
- Cards con `background: var(--card-bg)` y `border: 1px solid var(--card-border)`
- Diseño consistente entre roles — mismos componentes base

---

## Patrones de Código

### Nueva ruta de API
```typescript
// 1. Crear server/routes/<dominio>.ts
import { Router } from 'express';
import { protect } from '../middleware/auth';
import { requireRole } from '../middleware/roleAuth';

const router = Router();

router.get('/', protect, requireRole('profesor'), async (req, res) => {
  try {
    const { institution_id } = req.user!;
    // lógica
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// 2. Registrar en server/routes.ts
app.use('/api/<dominio>', domainRouter);
```

### Nuevo repositorio PG
```typescript
import { queryPg } from '../config/db-pg';

export async function getThingsByInstitution(institutionId: string) {
  return queryPg<Thing>(
    `SELECT * FROM things WHERE institution_id = $1`,
    [institutionId]
  );
}
```

### Llamada desde el cliente
```typescript
// TanStack Query — siempre, sin excepciones
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => fetch(`/api/resource/${id}`).then(r => r.json()),
});
```

### Routing — Reglas absolutas
- Usar **wouter** — NO react-router
- **NUNCA** usar `navigate(-1)` — siempre rutas absolutas en breadcrumbs
- Rutas autenticadas dentro de `<AppLayout>`
- `/` es landing público sin layout

---

## Manejo de Errores

- Errores son **best-effort** — NUNCA interrumpir el flujo principal de UX
- Try/catch en todos los handlers de Express
- Logs de error al server — no exponer stack traces al cliente
- Loading states en el cliente para toda llamada async
- Fallbacks visuales cuando no hay data — no pantallas en blanco

---

## Optimización — Reglas

### Backend
- Un endpoint por vista compleja — no 5 llamadas paralelas para cargar una página
- Usar `JOIN` en SQL en lugar de múltiples queries secuenciales
- Cachear con TanStack Query en el cliente — `staleTime` mínimo 30s para data estática
- No re-fetch en cada render — usar `queryKey` correctos
- Índices en `institution_id`, `group_subject_id`, `student_id` en todas las tablas

### Frontend
- Invalidar cache solo cuando hay mutación real (`queryClient.invalidateQueries`)
- No usar `refetchInterval` a menos que sea tiempo real explícito
- Lazy loading de páginas por rol — no cargar todo en el bundle inicial

---

## Pendientes Críticos para la Demo (7 días)

### Prioridad 1 — Bloquean la demo
- [ ] Rol `directora-academica`: crear vistas, permisos, rutas completas
- [ ] Rol `padre`: completar vistas, comunicados, seguimiento académico hijo
- [ ] Validar rutas rotas y conexiones a DB en los 4 roles existentes

### Prioridad 2 — Calidad de demo
- [ ] Limpiar datos fantasma de la DB demo (Caobos Beta 1)
- [ ] Poblar datos falsos coherentes para la presentación
- [ ] Eliminar scroll infinito — reemplazar con paginación/tabs
- [ ] Corregir inconsistencias visuales y asimetrías entre roles
- [ ] Errores de carga — todo debe cargar o mostrar skeleton/fallback

### Prioridad 3 — Diferenciadores vs Phidias
- [ ] Kiwi Assist: agente global con contexto por rol funcional
- [ ] Google Drive OAuth unificado (login + Drive + Gmail en un flujo)
- [ ] Dashboard con métricas IA para directivo y directora académica

---

## Análisis Competitivo — Phidias vs Evo.OS

### Debilidades de Phidias (explotar en demo)
- UX anticuada — interfaz densa, navegación compleja para padres
- Sin IA integrada — reportes manuales, sin automatización
- Sin Google Workspace nativo — integración superficial
- App móvil separada del web — experiencia fragmentada
- Sin chatbot ni asistente conversacional
- Diseño visual genérico sin personalización por colegio

### Ventajas de Evo.OS a demostrar
- **Kiwi Assist**: chatbot IA por rol — profesor pregunta por asistencia, padre pregunta por notas de su hijo, directivo ve analytics globales
- **Diseño moderno**: dark mode, cards glassmorphism, sin scroll infinito
- **Google Workspace nativo**: Drive, Gmail, Calendar en un OAuth
- **Boletines con IA**: generados automáticamente con análisis de desempeño
- **EvoSend**: chat en tiempo real por materia — no email, no WhatsApp externo
- **Multi-tenant**: cada colegio con su identidad visual

### Lo que Phidias tiene y debemos tener igual o mejor
- Calificaciones y seguimiento académico completo — YA TENEMOS
- Comunicados institucionales — YA TENEMOS
- Portal de padres funcional — EN CONSTRUCCIÓN (prioridad)
- Exportar a Excel — YA TENEMOS
- Módulo de asistencia — YA TENEMOS
- Infraestructura segura con backups — PENDIENTE en producción

---

## Seguridad — Checklist por Capa

### Backend
- [ ] Helmet.js activo en Express (headers de seguridad)
- [ ] CORS configurado solo para dominios autorizados
- [ ] Rate limiting en `/api/ai/*` y `/api/auth/*`
- [ ] Validación de inputs con zod o express-validator antes de queries
- [ ] Queries siempre con parámetros `$1, $2` — nunca template strings en SQL
- [ ] JWT con expiración — no tokens eternos
- [ ] Audit log en acciones sensibles (via `auditLogger.ts`)

### Frontend
- [ ] No exponer institution_id ni IDs internos en URLs públicas
- [ ] Verificar permisos en el cliente ADEMÁS del backend (doble validación UX)
- [ ] No guardar data sensible en localStorage más allá del token
- [ ] CSP headers configurados

### Base de Datos (Neon/PostgreSQL)
- [ ] Row-level isolation por institution_id verificada
- [ ] Backups automáticos activos en Neon
- [ ] Variables de entorno nunca hardcodeadas
- [ ] Connection pooling configurado correctamente

---

## Variables de Entorno Requeridas

```env
DATABASE_URL=          # PostgreSQL Neon — REQUERIDO para modo PG
USE_POSTGRES_ONLY=true # Deshabilitar MongoDB
JWT_SECRET=            # Para firmar/verificar tokens
OPENAI_API_KEY=        # Para Kiwi Assist, boletines, análisis IA
MONGO_URI=             # Solo si se necesita legacy
PORT=5000              # Default 5000
```

---

## Flujo de Trabajo con Claude Code

1. **Siempre leer los archivos relevantes antes de modificar** — nunca asumir estructura
2. **Verificar `institution_id`** en toda query nueva
3. **Plan mode primero** (Shift+Tab) para tareas complejas — aprobar antes de ejecutar
4. **`npm run check`** antes de hacer commit — sin errores de TypeScript
5. **Commit descriptivo** al final de cada feature: `feat: descripción clara`
6. **Push a main** — branch principal activo

### Lo que NUNCA debe hacer Claude Code
- Usar `navigate(-1)` — siempre rutas absolutas
- Hardcodear colores hex — usar variables CSS
- Inventar columnas de DB — leer schema.sql primero
- Modificar `auditLogger.ts` o `rolePermissions.ts` sin orden explícita
- Crear worktrees temporales
- Interrumpir UX principal con manejo de errores agresivo
- Usar `s.name` para materias — siempre `COALESCE(gs.display_name, s.name)`
- Hacer múltiples queries secuenciales cuando un JOIN resuelve lo mismo
