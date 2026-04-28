import dotenv from 'dotenv';
import { resolve } from 'path';

// Usar process.cwd() para obtener la raíz del proyecto (donde se ejecuta npm run dev)
const envPath = resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('⚠️  Advertencia: No se pudo cargar el archivo .env:', result.error.message);
} else {
  console.log('✅ Archivo .env cargado correctamente desde:', envPath);
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const ENV = {
  // MongoDB (legacy; no se usa en arranque — solo PostgreSQL/Neon)
  // MONGO_URI: process.env.MONGO_URI || '',
  // MONGODB_URI_DIRECT: process.env.MONGODB_URI_DIRECT || '',
  // MONGODB_USE_PUBLIC_DNS: process.env.MONGODB_USE_PUBLIC_DNS === 'true',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',
  DATABASE_URL: process.env.DATABASE_URL || '',
  /** Si es "true", el backend usa solo PostgreSQL y no conecta MongoDB. */
  USE_POSTGRES_ONLY: process.env.USE_POSTGRES_ONLY === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3000',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  /** Lista separada por comas; en producción debe definirse los orígenes del front. */
  CORS_ORIGINS: process.env.CORS_ORIGINS || '',
  /** Máximo de conexiones del pool pg (default sube respecto al legacy 10). */
  PG_POOL_MAX: parseIntEnv(process.env.PG_POOL_MAX, 20),
  /** URL redis (opcional). Con valor, Socket.IO usa @socket.io/redis-adapter. */
  REDIS_URL: process.env.REDIS_URL || '',
  /** Secreto para ampliar /api/health con detalles (opcional). */
  HEALTH_INTERNAL_SECRET: process.env.HEALTH_INTERNAL_SECRET || '',
  /** max-age en segundos para estáticos de producción (CDN-friendly). */
  STATIC_ASSET_MAX_AGE_SEC: parseIntEnv(process.env.STATIC_ASSET_MAX_AGE_SEC, 86400),
  /** En producción, webhooks n8n exigen N8N_WEBHOOK_SECRET si es "true" (default true). */
  REQUIRE_WEBHOOK_SECRET_IN_PRODUCTION:
    process.env.REQUIRE_WEBHOOK_SECRET_IN_PRODUCTION !== 'false',
  /**
   * Solo para pruebas de carga controladas en staging: desactiva rate limit en /api/auth/*
   * (login, registro, refresh). Nunca habilitar en producción frente a usuarios reales.
   */
  LOAD_TEST_DISABLE_AUTH_RATE_LIMIT: process.env.LOAD_TEST_DISABLE_AUTH_RATE_LIMIT === 'true',
};

// Validar variables críticas al cargar
if (!ENV.JWT_SECRET) {
  console.error('❌ ADVERTENCIA: JWT_SECRET no está configurado en .env');
}


