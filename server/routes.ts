import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { connectDB } from "./config/db";

// Importar rutas
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import coursesRoutes from "./routes/courses";
import materialsRoutes from "./routes/materials";

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

  // Ruta de prueba
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'AutoClose AI Backend funcionando correctamente',
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
