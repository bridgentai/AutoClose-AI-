# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs on http://localhost:5000, auto-opens browser)
npm run dev

# TypeScript type-check
npm run check

# Production build (Vite for client + esbuild for server)
npm run build

# Start production build
npm start

# E2E tests (Playwright)
npm run test:e2e
npm run test:e2e:ui                          # with interactive UI
npm run test:e2e:piloto                      # specific test file

# Seed scripts
npm run seed:bodytech
npm run seed:horarios
```

## Architecture Overview

**EvoOS** is a multi-tenant school management SaaS. The repo is a monorepo with a single Express server that serves both the REST API and the Vite-built React client.

### Directory Structure

```
server/
  index.ts          # Entry point, Express app setup
  routes.ts         # Central route registration
  routes/           # One file per domain (auth, courses, attendance, etc.)
  models/           # Mongoose models (MongoDB, legacy)
  db/               # PostgreSQL schema (schema.sql) and query utilities
  repositories/     # PG data access layer (one file per entity)
  mappers/          # Data transformation between DB and API shapes
  middleware/
    auth.ts         # JWT protect() middleware, AuthRequest type, UserRole type
    roleAuth.ts     # requireRole() and validateUserAccess() middleware
  services/         # Business logic (AI, grading, sync, audit, evoSend, etc.)
  config/
    env.ts          # Loads .env, exports ENV object
    db-pg.ts        # PostgreSQL pool (getPgPool, queryPg)
  socket.ts         # Socket.IO setup for EvoSend real-time messaging
client/src/
  App.tsx           # Router (wouter), role-based page imports
  pages/            # Page components, organized by role prefix
  components/       # Shared UI (Radix UI / shadcn-style)
  lib/
    authContext.tsx  # AuthProvider, useAuth hook — JWT stored in localStorage
    queryClient.ts  # TanStack Query client config
  hooks/            # Custom hooks (useEvoSocket, useInstitutionColors, etc.)
shared/
  schema.ts         # Shared TypeScript interfaces (User, Course, etc.)
e2e/                # Playwright end-to-end tests
```

### Database

The backend supports **two database modes**:

| Mode | Trigger | Notes |
|------|---------|-------|
| PostgreSQL only | `USE_POSTGRES_ONLY=true` or `DATABASE_URL` is set | All repositories use `queryPg` from `server/config/db-pg.ts` |
| MongoDB (legacy) | No `DATABASE_URL` | Mongoose models in `server/models/`, connected via `MONGO_URI` |

The `protect` middleware in `server/middleware/auth.ts` enforces PG mode — if `DATABASE_URL` is not set it returns 503.

### Authentication

- JWT-based: `Authorization: Bearer <token>` header
- `protect` middleware decodes the token and attaches `req.user` (`id`, `categorizedId`, `colegioId`, `institution_id`, `rol`, `curso`, `materias`)
- Frontend stores token in `localStorage` under keys `autoclose_token` and `autoclose_user`
- Auth state managed by `AuthProvider` / `useAuth()` from `client/src/lib/authContext.tsx`

### Roles

All roles defined in `UserRole` type (`server/middleware/auth.ts`):
`estudiante`, `profesor`, `directivo`, `padre`, `administrador-general`, `admin-general-colegio`, `transporte`, `tesoreria`, `nutricion`, `cafeteria`, `asistente`, `school_admin`, `super_admin`

Use `requireRole(...roles)` middleware on routes; use `checkAdminColegioOnly` for admin-only writes.

### Multi-tenancy

Every entity is scoped to an institution via `colegioId` (MongoDB models) or `institution_id` (PG). The `super_admin` role bypasses institution checks. Always filter by `institution_id` in repository queries.

### Frontend Routing

Uses **wouter** (not react-router). All authenticated routes render inside `<AppLayout>`. Pages are organized by role prefix (e.g., `profesor-*`, `directivo-*`, `admin-general-colegio-*`). The root `/` renders the public landing page without the app layout.

### Real-time (EvoSend)

Socket.IO server mounted at path `/api/evo-send-ws`. Client connects via `useEvoSocket` hook. Events: `evo:join`, `evo:leave`, `evo:message`. JWT auth required on handshake.

### AI Integration

OpenAI client in `server/services/openai.ts`. Key read dynamically from `process.env.OPENAI_API_KEY` on each call. Routes: `POST /api/ai/*` and `POST /api/chat/*`. Uses tool-calling pattern: `aiFunctions.ts` → `actionExecutor.ts` → repositories.

## Environment Variables

Required in `.env` at project root:

```
MONGO_URI=           # MongoDB connection string (legacy mode)
JWT_SECRET=          # Required for token signing/verification
DATABASE_URL=        # PostgreSQL connection string (enables PG-only mode)
USE_POSTGRES_ONLY=   # Set to "true" to skip MongoDB connection
OPENAI_API_KEY=      # For AI assistant and chat features
PORT=5000            # Defaults to 5000
```

## Key Patterns

- **New route**: create `server/routes/<domain>.ts`, export a Router, register it in `server/routes.ts` with `app.use('/api/<domain>', ...)`
- **New PG repository**: add functions to `server/repositories/`, use `queryPg<T>(sql, params)` from `server/config/db-pg.ts`
- **Protected route**: always apply `protect` first, then `requireRole(...)` as needed
- **API calls from client**: use TanStack Query (`useQuery`/`useMutation`) with the fetch client from `client/src/lib/queryClient.ts`; the base URL is relative (`/api/...`)
