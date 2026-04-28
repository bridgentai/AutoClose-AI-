// IMPORTANTE: Cargar .env PRIMERO antes de cualquier otra importación
import './config/env';

import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { autoAudit } from "./middleware/auditMiddleware.js";
import type { AuthRequest } from "./middleware/auth.js";
import { setupVite, serveStatic, log } from "./vite";
import { exec } from "child_process";
import http from "http";
import { queryPg } from "./config/db-pg.js";
import { deleteExpiredNotifications, notify } from "./repositories/notificationRepository.js";
import { findUserById } from "./repositories/userRepository.js";

if (process.env.NODE_ENV !== "production") {
  const ok = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 20);
  console.log(`[env] OPENAI_API_KEY configured: ${ok ? "yes" : "no"}`);
}

function sanitizeForApiLog(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeForApiLog);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      const kl = k.toLowerCase();
      if (
        kl.includes("token") ||
        kl.includes("password") ||
        kl.includes("secret") ||
        kl.includes("authorization")
      ) {
        out[k] = "[redacted]";
      } else {
        out[k] = sanitizeForApiLog(v) as unknown;
      }
    }
    return out;
  }
  return value;
}

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

app.use((req, res, next) => {
  autoAudit(req as AuthRequest, res, next);
});

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
      const logBody =
        path.startsWith("/api/auth") || path.includes("/refresh")
          ? undefined
          : capturedJsonResponse
            ? sanitizeForApiLog(capturedJsonResponse)
            : undefined;
      if (logBody) {
        logLine += ` :: ${JSON.stringify(logBody)}`;
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

      import('./db/pgSchemaPatches.js')
        .then(({ ensureNotificationExtraColumns }) => ensureNotificationExtraColumns())
        .catch((err) => console.error('[schema] notification columns:', err));
    }

    const getEmailForUser = async (userId: string): Promise<string | undefined> => {
      try {
        const r = await queryPg<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
        const email = r.rows[0]?.email;
        return typeof email === 'string' && email.trim() ? email.trim() : undefined;
      } catch {
        return undefined;
      }
    };

    if (process.env.DATABASE_URL) {
      const runReleaseComunicados = async () => {
        try {
          const { releasePendingAnnouncements } = await import(
            './repositories/comunicacionRepository.js'
          );
          const released = await releasePendingAnnouncements();
          const padres = released.filter((x) => x.type === 'comunicado_padres');
          if (padres.length > 0) {
            const { mirrorComunicadosPadresToParentSubjectThreads } = await import(
              './services/parentSubjectEvoSync.js'
            );
            await mirrorComunicadosPadresToParentSubjectThreads(padres);
          }

          const institucionales = released.filter((x) => x.type === 'comunicado_institucional');
          for (const ann of institucionales) {
            try {
              const recipients = await queryPg<{ user_id: string }>(
                `SELECT user_id FROM announcement_recipients WHERE announcement_id = $1`,
                [ann.id]
              );
              const author = await findUserById(ann.created_by_id);
              const authorName = author?.full_name ?? 'Administración';
              const recipientsWithoutAuthor: string[] = recipients.rows
                .map((r: { user_id: string }) => r.user_id)
                .filter((uid: string) => uid !== ann.created_by_id);

              await Promise.all(
                recipientsWithoutAuthor.map(async (uid: string) => {
                  const email = await getEmailForUser(uid);
                  await notify({
                    institution_id: ann.institution_id,
                    user_id: uid,
                    user_email: email,
                    type: 'comunicado_institucional',
                    entity_type: 'comunicado_institucional',
                    entity_id: ann.id,
                    action_url: `/institucional/comunicados`,
                    title: `Comunicado institucional · ${authorName}`,
                    body: (ann.title ?? '').slice(0, 240),
                  });
                })
              );
            } catch (e: unknown) {
              console.error('[comunicacion] notify institucional:', (e as Error).message);
            }
          }
        } catch (e: unknown) {
          console.error('[comunicacion] releasePending:', (e as Error).message);
        }
      };
      setInterval(() => {
        runReleaseComunicados().catch(() => { });
      }, 10_000);
    }

    // ---- Notificaciones: expiración automática (best-effort) ----
    if (process.env.DATABASE_URL) {
      const runCleanup = async () => {
        try {
          await deleteExpiredNotifications();
        } catch (e: unknown) {
          console.error('[notifications] deleteExpiredNotifications:', (e as Error).message);
        }
      };
      // ejecutar una vez al iniciar y luego cada 24h
      runCleanup().catch(() => { });
      setInterval(() => {
        runCleanup().catch(() => { });
      }, 24 * 60 * 60 * 1000);
    }

    // ---- Job nocturno: tarea vence en 24h (corre diario a las 8am local) ----
    if (process.env.DATABASE_URL) {
      const getUserEmail = async (userId: string): Promise<string | undefined> => {
        try {
          const r = await queryPg<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
          const email = r.rows[0]?.email;
          return typeof email === 'string' && email.trim() ? email.trim() : undefined;
        } catch {
          return undefined;
        }
      };

      const runDueSoonJob = async () => {
        try {
          const r = await queryPg<{
            assignment_id: string;
            due_date: string;
            title: string;
            institution_id: string;
            group_id: string;
            subject_name: string;
          }>(
            `SELECT a.id AS assignment_id, a.due_date, a.title, gs.institution_id, gs.group_id,
                    COALESCE(gs.display_name, s.name) AS subject_name
             FROM assignments a
             JOIN group_subjects gs ON gs.id = a.group_subject_id
             JOIN subjects s ON s.id = gs.subject_id
             WHERE a.due_date >= now()
               AND a.due_date < now() + interval '24 hours'
             ORDER BY a.due_date ASC
             LIMIT 500`,
            []
          );

          for (const a of r.rows) {
            if (!a.institution_id) continue;
            const students = await queryPg<{ student_id: string }>(
              `SELECT e.student_id
               FROM enrollments e
               WHERE e.group_id = $1
               AND NOT EXISTS (
                 SELECT 1
                 FROM submissions sub
                 WHERE sub.assignment_id = $2
                   AND sub.student_id = e.student_id
                   AND sub.submitted_at IS NOT NULL
               )`,
              [a.group_id, a.assignment_id]
            );

            for (const s of students.rows) {
              const email = await getUserEmail(s.student_id);
              await notify({
                institution_id: a.institution_id,
                user_id: s.student_id,
                user_email: email,
                type: 'tarea_vence',
                entity_type: 'assignment',
                entity_id: a.assignment_id,
                action_url: `/assignment/${a.assignment_id}`,
                title: 'Tu tarea vence mañana',
                body: `${a.title} en ${a.subject_name} vence el ${new Date(a.due_date).toLocaleString('es-CO')}`,
              });
            }
          }
        } catch (e: unknown) {
          console.error('[notifications] dueSoonJob:', (e as Error).message);
        }
      };

      const scheduleDailyAt8 = () => {
        const now = new Date();
        const next = new Date(now);
        next.setHours(8, 0, 0, 0);
        if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
        const ms = next.getTime() - now.getTime();
        setTimeout(() => {
          runDueSoonJob().catch(() => { });
          setInterval(() => {
            runDueSoonJob().catch(() => { });
          }, 24 * 60 * 60 * 1000);
        }, ms);
      };

      scheduleDailyAt8();
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
