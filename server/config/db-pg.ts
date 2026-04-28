/**
 * PostgreSQL connection pool for migration and repository layer.
 * Used only after schema exists and data is migrated (Phase 3+).
 */

import pg from 'pg';
import { ENV } from './env.js';

export let pgPool: pg.Pool | null = null;
export let pgError: string | null = null;

export function getPgPool(): pg.Pool {
  if (!pgPool) {
    if (!ENV.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Configure it in .env for PostgreSQL.');
    }
    pgPool = new pg.Pool({
      connectionString: ENV.DATABASE_URL,
      max: ENV.PG_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pgPool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
      pgError = err.message;
    });
  }
  return pgPool;
}

export async function queryPg<T = pg.QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<pg.QueryResult<T>> {
  const pool = getPgPool();
  return pool.query<T>(text, values);
}

export async function closePg(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    pgError = null;
  }
}
