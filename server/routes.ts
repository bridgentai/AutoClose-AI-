// IMPORTANTE: Cargar .env PRIMERO antes de cualquier otra importación
import './config/env';

import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { ENV } from "./config/env";
import { protect, type AuthRequest } from "./middleware/auth.js";
import { requireRole } from "./middleware/roleAuth.js";

// Importar rutas
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import aiRoutes from "./routes/ai";
import coursesRoutes from "./routes/courses";
import materialsRoutes from "./routes/materials";
import assignmentsRoutes from "./routes/assignments";
import subjectsRoutes, { listSubjectsHandler } from "./routes/subjects";
import usersRoutes from "./routes/users";
import groupsRoutes from "./routes/groups";
import sectionsRoutes from "./routes/sections";
import professorRoutes from "./routes/professor";
import studentRoutes from "./routes/student";
import superAdminRoutes from "./routes/superAdmin";
import institutionRoutes from "./routes/institution";
import attendanceRoutes from "./routes/attendance";
import eventsRoutes from "./routes/events";
import notificationsRoutes from "./routes/notifications";
import messagesRoutes from "./routes/messages";
import evoSendRoutes from "./routes/evoSend";
import evoDriveRoutes from "./routes/evoDrive";
import logrosCalificacionRoutes from "./routes/logrosCalificacion";
import gradeEventsRoutes from "./routes/gradeEvents";
import gradingSchemaRoutes from "./routes/gradingSchema";
import auditRoutes from "./routes/audit";
import accessControlsRoutes from "./routes/accessControls";
import boletinRoutes from "./routes/boletin";
import reportsRoutes from "./routes/reports";
import assignmentMaterialsRoutes from "./routes/assignmentMaterials";
import integrationsRoutes from "./routes/integrations";
import scheduleRoutes from "./routes/schedule";
import adminSqlRoutes, { adminSqlHandler } from "./routes/adminSql";
import uploadsRoutes from "./routes/uploads";
import activityRoutes from "./routes/activity";
import {
  ensureAssignmentsRequiresSubmissionColumn,
  ensureAssignmentCategoryFkReferencesGradingCategories,
  ensureEvoFilesOrigenCheck,
  ensureEvoFilesStaffOnlyColumn,
  ensureAuditLogIpColumns,
  ensureAuditLogRetentionPolicy,
  ensureEvoSendRetention,
  ensureStudentActivityTable,
  ensureGradingOutcomesTable,
  ensureComunicacionModule,
  ensureKiwiSchema,
  ensureUsersSectionId,
} from "./db/pgSchemaPatches.js";
import institucionalComunicadosRoutes from "./routes/institucionalComunicados.js";
import kiwiRoutes from "./routes/kiwi.js";

export async function registerRoutes(app: Express): Promise<Server> {
  if (ENV.DATABASE_URL) {
    try {
      await ensureAssignmentsRequiresSubmissionColumn();
      console.log("[schema] assignments.requires_submission OK");
    } catch (e) {
      console.warn(
        "[schema] No se pudo asegurar assignments.requires_submission (¿tabla assignments existe?):",
        (e as Error).message
      );
    }
    try {
      await ensureAssignmentCategoryFkReferencesGradingCategories();
    } catch (e) {
      console.warn("[schema] Parche FK logros:", (e as Error).message);
    }
    try {
      await ensureEvoFilesStaffOnlyColumn();
      console.log("[schema] evo_files.staff_only OK");
    } catch (e) {
      console.warn("[schema] Parche evo_files.staff_only:", (e as Error).message);
    }
    try {
      await ensureEvoFilesOrigenCheck();
      console.log("[schema] evo_files.origen CHECK OK");
    } catch (e) {
      console.warn("[schema] Parche evo_files.origen:", (e as Error).message);
    }
    try {
      await ensureAuditLogIpColumns();
      console.log("[schema] analytics.activity_logs / ai_action_logs ip_address OK");
    } catch (e) {
      console.warn("[schema] Parche audit ip_address:", (e as Error).message);
    }
    try {
      await ensureAuditLogRetentionPolicy();
    } catch (e) {
      console.warn("[schema] Parche retención audit logs:", (e as Error).message);
    }
    try {
      await ensureEvoSendRetention();
      console.log("[schema] announcement_messages.retention_until OK");
    } catch (e) {
      console.warn("[schema] Parche EvoSend retention_until:", (e as Error).message);
    }
    try {
      await ensureStudentActivityTable();
      console.log("[schema] student_activity OK");
    } catch (e) {
      console.warn("[schema] Parche student_activity:", (e as Error).message);
    }
    try {
      await ensureGradingOutcomesTable();
      console.log("[schema] grading_outcomes OK");
    } catch (e) {
      console.warn("[schema] Parche grading_outcomes:", (e as Error).message);
    }
    try {
      await ensureComunicacionModule();
    } catch (e) {
      console.warn("[schema] Parche comunicación:", (e as Error).message);
    }
    try {
      await ensureKiwiSchema();
    } catch (e) {
      console.warn("[schema] Parche kiwi_schema:", (e as Error).message);
    }
    try {
      await ensureUsersSectionId();
    } catch (e) {
      console.warn("[schema] Parche users.section_id:", (e as Error).message);
    }
  }

  // CORS - Configuración explícita para permitir todas las solicitudes
  app.use(cors({
    origin: true, // Permitir cualquier origen
    credentials: true, // Permitir credenciales (cookies, headers de autorización)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Rutas de API
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/ai', aiRoutes);
  console.log('[Routes] Ruta /api/ai registrada correctamente');
  app.use('/api/courses', coursesRoutes);
  app.use('/api/institucional', institucionalComunicadosRoutes);
  app.use('/api/materials', materialsRoutes);
  app.use('/api/assignments', assignmentsRoutes);
  // GET /api/subjects registrado explícitamente para evitar "Cannot GET /api/subjects"
  app.get('/api/subjects', protect, requireRole('admin-general-colegio', 'school_admin'), listSubjectsHandler);
  app.use('/api/subjects', subjectsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/groups', groupsRoutes);
  app.use('/api/sections', sectionsRoutes);
  app.use('/api/professor', professorRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/institution', institutionRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/evo-send', evoSendRoutes);
  app.use('/api/evo-drive', evoDriveRoutes);
  app.use('/api/logros-calificacion', logrosCalificacionRoutes);
  app.use('/api/grade-events', gradeEventsRoutes);
  app.use('/api/grading-schemas', gradingSchemaRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/access-controls', accessControlsRoutes);
  app.use('/api/boletin', boletinRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/assignment-materials', assignmentMaterialsRoutes);
  app.use('/api/integrations', integrationsRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/admin', adminSqlRoutes);
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/kiwi', kiwiRoutes);
  // Ruta explícita para que la consola SQL (Neon) siempre esté disponible con la misma DB de la plataforma
  app.post('/api/admin/sql', protect, requireRole('admin-general-colegio', 'school_admin', 'super_admin'), adminSqlHandler);

  // Ruta de health check (con verificación PG cuando USE_POSTGRES_ONLY)
  app.get('/api/health', async (req, res) => {
    const pgConfigured = !!ENV.DATABASE_URL;
    const postgresOnly = ENV.USE_POSTGRES_ONLY || false;
    const payload: Record<string, unknown> = {
      status: pgConfigured ? 'ok' : 'degraded',
      message: pgConfigured ? 'EvoOS Backend (PostgreSQL)' : 'Configure DATABASE_URL',
      postgres: { configured: pgConfigured, postgres_only: postgresOnly },
      timestamp: new Date().toISOString(),
    };
    if (pgConfigured && postgresOnly) {
      try {
        const { queryPg } = await import('./config/db-pg.js');
        const [u, i, g] = await Promise.all([
          queryPg<{ c: number }>('SELECT COUNT(*)::int AS c FROM users'),
          queryPg<{ c: number }>('SELECT COUNT(*)::int AS c FROM institutions'),
          queryPg<{ c: number }>('SELECT COUNT(*)::int AS c FROM groups'),
        ]);
        payload.postgres = {
          configured: true,
          postgres_only: true,
          counts: { users: u.rows[0]?.c ?? 0, institutions: i.rows[0]?.c ?? 0, groups: g.rows[0]?.c ?? 0 },
        };
      } catch (e) {
        payload.postgres = { configured: true, postgres_only: true, error: (e as Error).message };
      }
    }
    res.json(payload);
  });

  const httpServer = createServer(app);

  const { setupEvoSocket } = await import('./socket');
  setupEvoSocket(httpServer);

  return httpServer;
}
