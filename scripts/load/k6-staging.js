/**
 * Prueba de carga staging (~20 VUs) — k6
 *
 * Requisitos: brew install k6  (o https://k6.io/docs/get-started/installation/)
 *
 * Variables de entorno:
 *   BASE_URL                  default http://localhost:5000
 *   STAGING_LOAD_PASSWORD     misma que seed (default StagingLoad2026!)
 *   STAGING_USER_COUNT        default 20
 *
 * Antes: npm run seed:staging-load-users
 * En el servidor staging con load test: LOAD_TEST_DISABLE_AUTH_RATE_LIMIT=true
 *
 * Ejecutar: npm run staging:load
 *   o: k6 run scripts/load/k6-staging.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const PASS = __ENV.STAGING_LOAD_PASSWORD || 'StagingLoad2026!';
const USER_COUNT = Math.min(50, Math.max(1, parseInt(__ENV.STAGING_USER_COUNT || '20', 10) || 20));

export const options = {
  scenarios: {
    staging_load: {
      executor: 'constant-vus',
      vus: USER_COUNT,
      duration: __ENV.K6_DURATION || '2m',
      startTime: '0s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000'],
  },
};

export function setup() {
  const tokens = [];
  for (let i = 1; i <= USER_COUNT; i++) {
    const num = String(i).padStart(2, '0');
    const email = `staging-load-${num}@example.test`;
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password: PASS }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (res.status !== 200) {
      throw new Error(`login failed ${email}: ${res.status} ${String(res.body).slice(0, 120)}`);
    }
    let body;
    try {
      body = JSON.parse(res.body);
    } catch {
      throw new Error(`login invalid JSON for ${email}`);
    }
    if (!body.token) throw new Error(`no token for ${email}`);
    tokens.push(body.token);
  }
  return { tokens };
}

export default function (data) {
  const vu = __VU - 1;
  const token = data.tokens[vu % data.tokens.length];
  const headers = { Authorization: `Bearer ${token}` };

  const r1 = http.get(`${BASE_URL}/api/notifications`, { headers });
  check(r1, { 'notifications 200': (r) => r.status === 200 });

  const r2 = http.get(`${BASE_URL}/api/events`, { headers });
  check(r2, { 'events 200': (r) => r.status === 200 });

  sleep(Math.random() * 0.5 + 0.2);
}

export function handleSummary(d) {
  return {
    stdout: textSummary(d, { indent: ' ', enableColors: false }) + `\n`,
  };
}
