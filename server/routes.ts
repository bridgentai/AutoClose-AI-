// IMPORTANTE: Cargar .env PRIMERO antes de cualquier otra importación
import './config/env';

import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { ENV } from "./config/env";

// Importar rutas
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import aiRoutes from "./routes/ai";
import coursesRoutes from "./routes/courses";
import materialsRoutes from "./routes/materials";
import assignmentsRoutes from "./routes/assignments";
import subjectsRoutes from "./routes/subjects";
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
import reportsRoutes from "./routes/reports";
import assignmentMaterialsRoutes from "./routes/assignmentMaterials";
import integrationsRoutes from "./routes/integrations";
import scheduleRoutes from "./routes/schedule";

export async function registerRoutes(app: Express): Promise<Server> {
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
  app.use('/api/materials', materialsRoutes);
  app.use('/api/assignments', assignmentsRoutes);
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
  app.use('/api/reports', reportsRoutes);
  app.use('/api/assignment-materials', assignmentMaterialsRoutes);
  app.use('/api/integrations', integrationsRoutes);
  app.use('/api/schedule', scheduleRoutes);

  // Ruta de health check (con verificación PG cuando USE_POSTGRES_ONLY)
  app.get('/api/health', async (req, res) => {
    const pgConfigured = !!ENV.DATABASE_URL;
    const postgresOnly = ENV.USE_POSTGRES_ONLY || false;
    const payload: Record<string, unknown> = {
      status: pgConfigured ? 'ok' : 'degraded',
      message: pgConfigured ? 'MindOS Backend (PostgreSQL)' : 'Configure DATABASE_URL',
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
