import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { config as loadEnvFile } from "dotenv";

const rootDir = path.resolve(import.meta.dirname);
// Misma raíz que el servidor Express: leer PORT del .env para el proxy (p. ej. PORT=3000).
loadEnvFile({ path: path.join(rootDir, ".env") });

const expressPort = (process.env.PORT && process.env.PORT.trim()) || "5000";
const apiProxyTarget =
  (process.env.VITE_DEV_API_URL && process.env.VITE_DEV_API_URL.trim()) ||
  `http://127.0.0.1:${expressPort}`;

// Inyectado solo cuando no es build de producción (evita romper el import en server/vite.ts con defineConfig en forma de función).
const devBackendDefine: Record<string, string> =
  process.env.NODE_ENV !== "production"
    ? {
        "import.meta.env.VITE_DEV_BACKEND_ORIGIN": JSON.stringify(
          apiProxyTarget.replace(/\/$/, ""),
        ),
        "import.meta.env.VITE_DEV_BACKEND_PORT": JSON.stringify(expressPort),
      }
    : {};

export default defineConfig({
  define: devBackendDefine,
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    // No usar el mismo puerto que Express (PORT en .env): el proxy apuntaría a Vite otra vez y /api devuelve 404.
    port: 5173,
    strictPort: false,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
