# evoOS MVP – Structured Review Report

**Date:** February 9, 2025  
**Scope:** Current codebase vs. baseline (Phidias/Alexia parity), roadmap, roles, and MVP readiness.

---

## 1. Status Breakdown

### Done (correctly implemented and functional)

| Area | Details |
|------|--------|
| **Auth** | JWT auth, `protect` middleware, role-based access. Login/register with code + password. |
| **Attendance API** | Full CRUD: list by course/date, single/bulk record, student summary, parent view by Vinculacion. |
| **Attendance UI** | Profesor: course/date picker, bulk toggle presente/ausente, save. Wired to `/api/attendance/*`. |
| **Events API** | Full CRUD: list (filters), get one, create, update, delete. Role restrictions (directivo, admin-general-colegio, profesor). |
| **Events UI** | CalendarioEventos: list, create, delete; query params `desde`/`hasta`. Wired to `/api/events`. |
| **Messaging backend** | Conversacion + Mensaje models. APIs: list conversations, get messages, create conversation + first message, reply, mark read. |
| **Messaging UI** | BandejaDeEntrada: conversations list, thread view, reply, mark read. Wired to `/api/messages/*`. |
| **Treasury API** | Factura + Pago: stats, list/create/patch facturas, list/create pagos. Role-scoped (padre sees own). |
| **Treasury UI** | Tesorería page: real stats (pagosPendientes, ingresosMes, etc.), facturas/pagos tables, create factura/pago modals. |
| **Vinculaciones** | Model + APIs: list by student/parent, create, confirmar-vinculacion. Used in boletin, attendance, parent hijos. |
| **Notifications API** | List, mark one read, mark all read. |
| **Notifications UI** | Notificaciones page: list, unread count, mark read. Wired to `/api/notifications`. |
| **Boletín (grades) API** | GET list + GET by id with role-based filtering (estudiante/padre/directivo/profesor). |
| **Boletín (grades) UI** | Boletín page: list periods, detail view, and grades table from `/api/student/notes` (or hijo). Real data for student/parent. |
| **Role context for AI** | roleContextBuilder: student, professor, parent, directivo with courses/notes/assignments. Used in AI chat. |
| **Admin KPIs** | `/api/users/stats`: counts by role, asistenciaResumen, treasuryResumen. Admin-general-colegio dashboard consumes it. |
| **Google SSO (optional)** | `/api/auth/google` + callback, token exchange, user create/update. Login and auth-callback UI. |
| **Extended roles (deferred)** | Transporte, tesorería, nutrición, cafeteria, asistente have dedicated routes; tesorería is functional; others are shells. |

### In progress / partial

| Area | Status | Notes |
|------|--------|--------|
| **Grades / report card** | Partial | Boletín: list/detail from API; generation only via AI action `crear_boletin` (actionExecutor). No REST POST to generate from backend; no PDF export in client. |
| **Parent dashboard** | Partial | **PadreDashboard** (in Dashboard) uses real data (hijos, attendance resumen, notas, assignments). Standalone **parent.tsx** (`/parent`) still shows mock data (4.5, Matemáticas/Ciencias/Historia/Física hardcoded). |
| **Bulletin boards / notices** | Partial | AvisosNoticias is “En Construcción” placeholder; no backend model or API for announcements. |
| **Report card generation** | Partial | Backend generation exists only inside AI flow (crear_boletin in actionExecutor); no direct “generate boletín for period” endpoint for staff. |
| **Profesor dashboard** | Minor | “Cursos a cargo” shows hardcoded “5”; could use real count from `/api/professor/courses`. |

### Missing

| Area | Notes |
|------|--------|
| **LMS integration** | No Google Classroom or Moodle sync. syncService is internal only (notifications, internal Evento updates). |
| **GDPR / Habeas Data** | No consent flows, data export, or retention policy endpoints or UI. |
| **Report card PDF export** | No endpoint or client action to download boletín as PDF. |
| **Announcements (avisos)** | No model/API; AvisosNoticias is placeholder. |
| **REST boletín generation** | No POST `/api/boletin` (or similar) for staff to generate report card without AI. |
| **Cloud hosting / infra** | Not in repo; deployment and hosting are external. |

### Incorrect / fragile / misleading

| Item | Issue |
|------|--------|
| **parent.tsx** | Shows hardcoded grades (4.5, Matemáticas 4.5, etc.) and “Rendimiento General 4.5”. Misleading for parents who open `/parent` instead of dashboard. |
| **AvisosNoticias** | Labeled “Avisos y Noticias” but content is “En Construcción”; no real data. |
| **Conversacion.materiaId** | Ref to `cursos` in schema; name suggests “materia”. Consider clarifying or renaming for consistency. |

---

## 2. Baseline Features (Phidias + Alexia parity) – Checklist

| Feature | Implemented? | Report card / export? | Notes |
|---------|--------------|------------------------|--------|
| **Grades** | Yes (Nota, student/curso notes APIs, boletín list/detail) | View: yes. Export/PDF: no. Generation: AI-only, no REST. | See “Report cards” correction below. |
| **Attendance** | Yes | API + UI for recording and viewing (by course/date, by student, resumen). | Done. |
| **Admissions & enrollment** | Partial | Registration (auth), Vinculacion (create/confirm), no full “renewal flow” UI. | APIs exist; renewal flow could be clearer. |
| **Messaging portal** | Yes | Backend (Conversacion + Mensaje), APIs, BandejaDeEntrada + redactar wired. | Done. |
| **Event calendar** | Yes | CRUD API, CalendarioEventos UI with list/create/delete. | Done. |
| **Bulletin boards / notices** | No | No announcements backend; AvisosNoticias is placeholder. | Missing. |
| **Billing & payments** | Yes | Factura + Pago APIs, Tesorería dashboard with real stats and lists. | Done. |
| **LMS integration** | No | No Google Classroom / Moodle sync. | Missing. |
| **Curriculum-aware AI** | Yes | roleContextBuilder + role in AI chat; curriculum (courses, notes, assignments) in context. | Done. |
| **Infrastructure** | Partial | SSO: Google OAuth present (optional). GDPR/Habeas Data: not implemented. Hosting: N/A in repo. | SSO ok; compliance missing. |
| **Analytics** | Yes | `/api/users/stats` (KPIs), admin-general-colegio dashboard (estudiantes, asistencia, treasury). | Done. |

---

## 3. Roadmap Validation

| Phase | Expected | Current | Confirmation / adjustment |
|-------|----------|---------|----------------------------|
| **Foundation** | Auth + SSO, attendance API/UI, real parent dashboard data | Auth + optional SSO done; attendance done; parent **dashboard** (PadreDashboard) uses real data; `/parent` page still mock. | Priorities ok. Fix: replace mock data on **parent.tsx** or redirect to dashboard. |
| **MVP** | Messaging, events, billing/payments, report cards, analytics | Messaging, events, treasury, analytics done. Report cards: view done; generation AI-only; no PDF. | Keep priorities. Add: REST boletín generation + PDF export for MVP. |
| **Engagement** | Notifications API/UI, mobile-first | Notifications API + UI done. Mobile-first: responsive present; not systematically verified. | Priorities ok. Recommend explicit mobile pass for parents/students. |
| **Integration** | LMS sync, calendar sync | Not started. | Correctly post-MVP; no change. |
| **Differentiation** | Curriculum-aware AI, AI-driven workflows | Role context + AI actions (crear_boletin, tasks, etc.) in place. | Priorities ok. |

**Priority order (attendance, report cards, treasury as MVP blockers):**  
Attendance and treasury are implemented. Report cards are viewable but generation is AI-only and there is no PDF; for MVP, consider adding non-AI generation and PDF as blockers.

---

## 4. Roles & Functions

| Role | Expected | Current | Notes |
|------|----------|--------|--------|
| **Student** | Grades, attendance, assignments, report cards, AI chat | Notes (student + boletín), attendance view (via API), assignments (student tasks), boletín view, chat. | MVP covered. |
| **Teacher** | Grading, attendance, assignments, messaging, AI chat | Grading (panel, notes), attendance (asistencia-profesor), assignments (tareas, revision), BandejaDeEntrada/redactar, AI chat. | MVP covered. |
| **Parent/Guardian** | Dashboard with real grades/attendance, messaging, payments | Dashboard (PadreDashboard): real grades, attendance, assignments. BandejaDeEntrada, treasury (own facturas/pagos). **parent.tsx** still mock. | Fix parent.tsx or remove/redirect. |
| **School Director** | Oversight academics, attendance, report cards, analytics | Directivo dashboard and sections; attendance/boletín/events accessible; stats via admin dashboard. | MVP covered. |
| **General Administrator** | User/group management, admissions, billing, KPIs | Admin-general-colegio dashboard: users, courses, materias, vinculaciones, stats (asistencia, treasury). | MVP covered. |
| **Extended (post-MVP)** | Transport, treasury operator, nutrition, cafeteria, assistant, super admin | Routes and shells exist; treasury operator uses same Tesorería as admin. Others correctly deferred. | Ok. |

**Conclusion:** MVP roles are functionally covered except for the misleading **parent.tsx** page. Extended roles are appropriately deferred.

---

## 5. Corrections Required for MVP Readiness

### 5.1 Parent dashboard: replace mock data with real

- **File:** `client/src/pages/parent.tsx`
- **Issue:** Hardcoded “4.5”, “Matemáticas 4.5”, “Ciencias 4.2”, etc.
- **Action:** Either (a) refactor to use same data as PadreDashboard (`/api/users/me/hijos`, `/api/student/hijo/:id/notes`, `/api/attendance/resumen/estudiante/:id`, etc.) or (b) redirect `/parent` to `/dashboard` so parents always see the real PadreDashboard.

### 5.2 Messaging: model already correct

- **Model:** Conversacion + Mensaje is in place and used by API and UI.
- **Action:** No redesign needed. Optional: clarify or rename `Conversacion.materiaId` (currently ref to `cursos`) for consistency.

### 5.3 Report cards: backend generation + PDF export

- **Backend:** Add POST endpoint (e.g. `POST /api/boletin/generar` or `POST /api/boletin`) to generate boletín for a course/period from Nota data (similar to `executeCreateBoletin` in actionExecutor), without going through AI.
- **Client:** Add “Descargar PDF” (or “Exportar”) for a boletín; implement via server-rendered PDF (e.g. endpoint returning PDF) or client-side generation from current boletín payload.
- **Action:** Implement non-AI boletín generation endpoint and PDF export (server or client).

### 5.4 Treasury dashboard

- **Status:** Already uses real Factura/Pago data and `/api/treasury/stats`.
- **Action:** None for MVP.

### 5.5 GDPR / Habeas Data

- **Gaps:** No consent flows, data export, or retention policy.
- **Action:** Add: (1) consent capture and storage (e.g. User or dedicated collection), (2) “Export my data” endpoint + optional UI, (3) documented retention policy and, if needed, scheduled cleanup or anonymization.

### 5.6 Mobile-first

- **Status:** Layouts use responsive classes; no dedicated mobile audit.
- **Action:** Verify critical flows (parent dashboard, student tasks, attendance, login) on small viewports; ensure touch targets and navigation (e.g. bottom nav or drawer) for parents/students.

### 5.7 Bulletin boards (avisos)

- **Status:** No backend; AvisosNoticias is placeholder.
- **Action:** For MVP, either (a) add minimal Aviso model + CRUD API and wire AvisosNoticias to real data, or (b) keep as “Coming soon” and document as post-MVP.

---

## Summary Table

| Category | Done | Partial | Missing | Incorrect |
|----------|------|--------|---------|-----------|
| **Status** | 15+ areas | 5 | 6 | 3 |
| **Baseline** | 7 features | 2 | 2 | 0 |
| **Roadmap** | Aligned | 1 adjustment (report card + PDF) | — | — |
| **Roles** | 5 MVP roles ok | 1 (parent.tsx) | 0 | 0 |
| **Corrections** | — | — | — | 5 required (parent, boletín+PDF, GDPR, mobile, optional avisos) |

**Recommended MVP focus:**  
(1) Replace or fix parent.tsx with real data (or redirect).  
(2) Add REST boletín generation and PDF export.  
(3) Add minimal GDPR/Habeas Data (consent, export, retention).  
(4) Quick mobile pass on parent/student flows.  
(5) Optionally add avisos backend and wire AvisosNoticias, or explicitly defer.
