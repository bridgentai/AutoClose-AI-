// IMPORTANTE: Cargar .env PRIMERO antes de cualquier otra importación
import './config/env';

import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { connectDB } from "./config/db";

// Importar rutas
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import aiRoutes from "./routes/ai";
import coursesRoutes from "./routes/courses";
import materialsRoutes from "./routes/materials";
import assignmentsRoutes from "./routes/assignments";
import subjectsRoutes from "./routes/subjects";
import usersRoutes from "./routes/users";
import groupsRoutes, { seedGroups } from "./routes/groups";
import sectionsRoutes from "./routes/sections";
import professorRoutes from "./routes/professor";
import studentRoutes from "./routes/student";
import superAdminRoutes from "./routes/superAdmin";
import institutionRoutes from "./routes/institution";
import attendanceRoutes from "./routes/attendance";
import eventsRoutes from "./routes/events";
import notificationsRoutes from "./routes/notifications";
import treasuryRoutes from "./routes/treasury";
import messagesRoutes from "./routes/messages";
import boletinRoutes from "./routes/boletin";
import logrosCalificacionRoutes from "./routes/logrosCalificacion";
import gradeEventsRoutes from "./routes/gradeEvents";
import gradingSchemaRoutes from "./routes/gradingSchema";
import auditRoutes from "./routes/audit";
import reportsRoutes from "./routes/reports";
import assignmentMaterialsRoutes from "./routes/assignmentMaterials";
import integrationsRoutes from "./routes/integrations";
import scheduleRoutes from "./routes/schedule";

export async function registerRoutes(app: Express): Promise<Server> {
  // Conectar a MongoDB
  await connectDB();

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
  app.use('/api/treasury', treasuryRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/boletin', boletinRoutes);
  app.use('/api/logros-calificacion', logrosCalificacionRoutes);
  app.use('/api/grade-events', gradeEventsRoutes);
  app.use('/api/grading-schemas', gradingSchemaRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/assignment-materials', assignmentMaterialsRoutes);
  app.use('/api/integrations', integrationsRoutes);
  app.use('/api/schedule', scheduleRoutes);

  // Seed grupos fijos al iniciar
  await seedGroups();

  // Ruta de health check
  app.get('/api/health', async (req, res) => {
    const { mongoConnected, mongoError } = await import('./config/db');
    res.json({ 
      status: mongoConnected ? 'ok' : 'degraded',
      message: mongoConnected 
        ? 'AutoClose AI Backend funcionando correctamente'
        : 'Backend iniciado pero MongoDB no conectado',
      mongodb: {
        connected: mongoConnected,
        error: mongoError
      },
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
