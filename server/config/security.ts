/**
 * CORS y utilidades de seguridad compartidas (HTTP + Socket.IO).
 */

import type { CorsOptions } from 'cors';
import { ENV } from './env.js';

function parseList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Orígenes permitidos explícitos (producción). Incluye FRONTEND_URL si no hay CORS_ORIGINS. */
export function getExplicitAllowedOrigins(): string[] {
  const fromEnv = parseList(ENV.CORS_ORIGINS);
  if (fromEnv.length > 0) return fromEnv;
  const fe = ENV.FRONTEND_URL?.trim();
  return fe ? [fe] : [];
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  } catch {
    return false;
  }
}

/**
 * Callback estándar de cors: en desarrollo permite localhost; en producción solo lista explícita.
 * Peticiones sin header Origin (curl, apps server-side) se permiten.
 */
export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (ENV.NODE_ENV !== 'production') {
    if (isLocalhostOrigin(origin)) {
      callback(null, true);
      return;
    }
  }

  const allowed = getExplicitAllowedOrigins();
  if (allowed.includes(origin)) {
    callback(null, true);
    return;
  }

  if (ENV.NODE_ENV !== 'production' && allowed.length === 0) {
    callback(null, true);
    return;
  }

  callback(new Error('Not allowed by CORS'), false);
}

export function buildHttpCorsOptions(): CorsOptions {
  return {
    origin: corsOriginCallback,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

/** Misma política que HTTP para Socket.IO handshake. */
export function socketIoCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, success?: boolean) => void,
): void {
  corsOriginCallback(origin, callback);
}
