// IMPORTANTE: Cargar .env PRIMERO antes de cualquier otra importación
import './config/env';

import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { exec } from "child_process";
import http from "http";

// Verificación del .env al iniciar
console.log('\n=== VERIFICACIÓN DE .ENV ===');
console.log('OPENAI_API_KEY existe?', !!process.env.OPENAI_API_KEY);
if (process.env.OPENAI_API_KEY) {
  const key = process.env.OPENAI_API_KEY;
  console.log('✅ Longitud:', key.length, 'caracteres');
  console.log('✅ Primeros 20 chars:', key.substring(0, 20));
  console.log('✅ Últimos 10 chars:', key.substring(key.length - 10));
  console.log('✅ Tiene asteriscos?', key.includes('*') ? 'SÍ ❌' : 'NO ✅');
  console.log('✅ Formato válido?', (key.startsWith('sk-') || key.startsWith('skproj')) ? 'SÍ ✅' : 'NO ❌');
} else {
  console.error('❌ OPENAI_API_KEY NO está en process.env');
  console.error('   Verifica que el archivo .env esté en la raíz del proyecto');
}
console.log('===========================\n');

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Servir archivos subidos (escaneos) desde /uploads/*
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Si la respuesta ya fue enviada, no intentar enviarla de nuevo
    if (res.headersSent) {
      return _next(err);
    }

    res.status(status).json({ message });
    // No lanzar el error después de enviar la respuesta
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on the port specified in the environment variable PORT
  // Defaults to 5000 if not specified.
  // This serves both the API and the client.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.NODE_ENV === 'production' ? "0.0.0.0" : "127.0.0.1";
  const listenOptions: any = { port, host };
  if (process.env.NODE_ENV === 'production') {
    listenOptions.reusePort = true;
  }
  server.listen(listenOptions, async () => {
    const url = `http://${host}:${port}`;
    const localUrl = `http://localhost:${port}`;
    log(`serving on port ${port}`);
    console.log(`\n🚀 Servidor iniciado exitosamente!`);
    console.log(`📍 URL de previsualización: ${url}`);
    console.log(`   También disponible en: ${localUrl}\n`);

    // Evo Send: ensure staff groups and direct threads exist (idempotent)
    if (process.env.DATABASE_URL) {
      import('./services/evoSendBootstrap.js')
        .then(({ ensureEvoSendStaffAndDirectThreads }) => ensureEvoSendStaffAndDirectThreads())
        .then(() => console.log('[evoSendBootstrap] Staff and direct threads OK'))
        .catch((err) => console.error('[evoSendBootstrap]', err));
    }
    
    // Abrir el navegador automáticamente en modo desarrollo
    if (app.get("env") === "development") {
      // Función para abrir el navegador
      const openBrowser = () => {
        const platform = process.platform;
        let command: string;
        
        if (platform === "darwin") {
          // macOS - usar open sin comillas, funciona mejor
          // Abrir a la página de bienvenida (home)
          command = `open ${localUrl}`;
        } else if (platform === "win32") {
          // Windows
          command = `start ${localUrl}`;
        } else {
          // Linux y otros
          command = `xdg-open ${localUrl}`;
        }
        
        exec(command, (error) => {
          if (error) {
            console.log(`⚠️  No se pudo abrir el navegador automáticamente.`);
            console.log(`   Por favor, abre manualmente: ${localUrl}`);
          } else {
            console.log(`🌐 Navegador abierto automáticamente en: ${localUrl}`);
          }
        });
      };

      // Verificar que el servidor esté listo antes de abrir
      const checkServer = (retries = 15): Promise<boolean> => {
        return new Promise((resolve) => {
          let attempts = 0;
          const check = () => {
            attempts++;
            const req = http.get(localUrl, (res) => {
              req.destroy();
              if (res.statusCode === 200 || res.statusCode === 304) {
                resolve(true);
              } else if (attempts < retries) {
                setTimeout(check, 300);
              } else {
                resolve(false);
              }
            });
            
            req.on('error', () => {
              req.destroy();
              if (attempts < retries) {
                setTimeout(check, 300);
              } else {
                resolve(false);
              }
            });
            
            req.setTimeout(1000, () => {
              req.destroy();
              if (attempts < retries) {
                setTimeout(check, 300);
              } else {
                resolve(false);
              }
            });
          };
          // Empezar a verificar después de un pequeño delay
          setTimeout(check, 500);
        });
      };

      // Esperar a que el servidor esté listo y luego abrir
      checkServer().then((ready) => {
        if (ready) {
          openBrowser();
        } else {
          // Abrir de todas formas después de un tiempo razonable
          console.log(`⏳ Esperando a que el servidor esté completamente listo...`);
          setTimeout(() => {
            openBrowser();
          }, 2000);
        }
      });
    }
  });
})();
