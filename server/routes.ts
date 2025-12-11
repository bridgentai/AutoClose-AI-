import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { connectDB } from "./config/db";

// Importar rutas
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import coursesRoutes from "./routes/courses";
import materialsRoutes from "./routes/materials";
import assignmentsRoutes from "./routes/assignments";
import subjectsRoutes from "./routes/subjects";
import usersRoutes from "./routes/users";
import groupsRoutes, { seedGroups } from "./routes/groups";

export async function registerRoutes(app: Express): Promise<Server> {
  // Conectar a MongoDB
  await connectDB();

  // CORS
  app.use(cors());

  // Rutas de API
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/courses', coursesRoutes);
  app.use('/api/materials', materialsRoutes);
  app.use('/api/assignments', assignmentsRoutes);
  app.use('/api/subjects', subjectsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/groups', groupsRoutes);

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
