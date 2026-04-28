#!/usr/bin/env node
/**
 * Smoke staging: health, CORS preflight, login, rutas protegidas.
 *
 * Variables:
 *   BASE_URL              default http://localhost:5000
 *   STAGING_SMOKE_ORIGIN  Origin header (debe estar en CORS permitidos en staging)
 *   STAGING_SMOKE_EMAIL   default staging-load-01@example.test
 *   STAGING_SMOKE_PASSWORD default StagingLoad2026!
 *   HEALTH_INTERNAL_SECRET + STAGING_SMOKE_DEEP=1 para /api/health?deep=1
 */

const BASE_URL = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const ORIGIN =
  process.env.STAGING_SMOKE_ORIGIN ||
  process.env.FRONTEND_URL ||
  'http://localhost:5173';
const EMAIL = process.env.STAGING_SMOKE_EMAIL || 'staging-load-01@example.test';
const PASSWORD = process.env.STAGING_SMOKE_PASSWORD || 'StagingLoad2026!';
const DEEP = process.env.STAGING_SMOKE_DEEP === '1';
const HEALTH_SECRET = process.env.HEALTH_INTERNAL_SECRET || '';

function fail(msg) {
  console.error('[staging-smoke] FAIL:', msg);
  process.exit(1);
}

async function main() {
  const rHealth = await fetch(`${BASE_URL}/api/health`);
  if (!rHealth.ok) fail(`GET /api/health -> ${rHealth.status}`);
  const j = await rHealth.json();
  if (j.status !== 'ok' && j.status !== 'degraded') {
    fail(`health payload status inesperado: ${JSON.stringify(j.status)}`);
  }
  console.log('[staging-smoke] GET /api/health ok', j.status);

  if (DEEP && HEALTH_SECRET) {
    const u = new URL(`${BASE_URL}/api/health`);
    u.searchParams.set('deep', '1');
    const rDeep = await fetch(u.toString(), {
      headers: { 'x-health-secret': HEALTH_SECRET },
    });
    if (!rDeep.ok) fail(`GET /api/health?deep=1 -> ${rDeep.status}`);
    const jd = await rDeep.json();
    console.log('[staging-smoke] deep health ok', JSON.stringify(jd.postgres ?? {}).slice(0, 200));
  }

  const preflight = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });
  const acao = preflight.headers.get('access-control-allow-origin');
  if (!acao && ORIGIN !== 'null') {
    console.warn('[staging-smoke] WARN: OPTIONS sin Access-Control-Allow-Origin (¿CORS mal configurado?)');
  } else {
    console.log('[staging-smoke] OPTIONS preflight allow-origin:', acao || '(none)');
  }

  const rLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!rLogin.ok) {
    const t = await rLogin.text();
    fail(`POST /api/auth/login -> ${rLogin.status} ${t.slice(0, 200)}`);
  }
  const loginBody = await rLogin.json();
  const token = loginBody.token;
  if (!token) fail('login sin token');
  console.log('[staging-smoke] POST /api/auth/login ok');

  const authHeaders = { Authorization: `Bearer ${token}` };

  const rNotif = await fetch(`${BASE_URL}/api/notifications`, { headers: authHeaders });
  if (!rNotif.ok) fail(`GET /api/notifications -> ${rNotif.status}`);
  console.log('[staging-smoke] GET /api/notifications ok');

  const rProfile = await fetch(`${BASE_URL}/api/student/profile`, { headers: authHeaders });
  if (!rProfile.ok) fail(`GET /api/student/profile -> ${rProfile.status}`);
  console.log('[staging-smoke] GET /api/student/profile ok');

  const rEvents = await fetch(`${BASE_URL}/api/events`, { headers: authHeaders });
  if (!rEvents.ok) fail(`GET /api/events -> ${rEvents.status}`);
  console.log('[staging-smoke] GET /api/events ok');

  console.log('[staging-smoke] ALL OK');
}

main().catch((e) => fail(e.message));
