/**
 * Phase 3.5 - Dual read validation: compare MongoDB vs PostgreSQL results.
 * - With USE_POSTGRES_ONLY=true (and DATABASE_URL): only validates PG (no Mongo connection).
 * - Otherwise: needs MONGO_URI and DATABASE_URL, compares both. Exits 0 if sample checks match.
 */

import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const usePgOnly = process.env.USE_POSTGRES_ONLY === 'true';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL for validation.');
  process.exit(1);
}

async function runPgOnly() {
  const { getPgPool } = await import('../../server/config/db-pg.ts');
  const pool = getPgPool();
  const r = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  const count = r.rows[0]?.c ?? 0;
  await pool.end();
  console.log('USE_POSTGRES_ONLY=true: skipping MongoDB.');
  console.log(`PostgreSQL users count: ${count}`);
  console.log('PG-only validation passed. Backend can run with USE_POSTGRES_ONLY=true.');
  process.exit(0);
}

async function runDualRead() {
  const dbModule = await import('../../server/config/db.ts');
  await dbModule.connectDB();
  const { User } = await import('../../server/models/User.ts');
  const { findUserById } = await import('../../server/repositories/userRepository.ts');
  const { getPgPool } = await import('../../server/config/db-pg.ts');

  const errors: string[] = [];
  const mongoUsers = await User.find({}).limit(20).lean();
  const pool = getPgPool();
  const pgCount = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  const mongoCount = await User.countDocuments();
  if (mongoCount !== pgCount.rows[0]?.c) {
    errors.push(`User count: Mongo ${mongoCount} vs PG ${pgCount.rows[0]?.c ?? 0}`);
  }

  const { v5: uuidV5 } = await import('uuid');
  const NAMESPACE = uuidV5('evoos-migration', uuidV5.DNS);
  const toUUID = (oid: string) => (oid && oid.length === 24 ? uuidV5(oid, NAMESPACE) : '');

  for (let i = 0; i < mongoUsers.length; i++) {
    const m = mongoUsers[i];
    const mId = (m as { _id?: { toString?: () => string } })._id?.toString?.() ?? (m as { _id?: string })._id;
    const hex = typeof mId === 'string' ? mId.replace(/^ObjectId\(|\)$/g, '').trim() : '';
    if (!hex || hex.length !== 24) continue;
    const pgId = toUUID(hex);
    const pgRow = await findUserById(pgId);
    if (!pgRow) errors.push(`User Mongo _id ${hex} -> UUID ${pgId} not found in PG`);
  }

  await dbModule.mongoose.connection.close();
  await pool.end();

  if (errors.length) {
    console.error('Dual-read validation issues:');
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  console.log('Dual-read sample check passed (users). Run full comparison with more entities as needed.');
  process.exit(0);
}

async function run() {
  if (usePgOnly) return runPgOnly();
  return runDualRead();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
