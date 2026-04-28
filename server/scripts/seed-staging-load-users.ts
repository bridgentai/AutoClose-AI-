/**
 * Seed PostgreSQL: 20 usuarios estudiante para pruebas de carga / staging.
 * Idempotente por email: si el usuario ya existe, se omite.
 *
 * Uso: STAGING_INSTITUTION_ID=f0000000-... STAGING_LOAD_PASSWORD=xxx npm run seed:staging-load-users
 *
 * Emails: staging-load-01@example.test ... staging-load-20@example.test
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { findInstitutionById } from '../repositories/institutionRepository.js';
import { findAllInstitutions } from '../repositories/institutionRepository.js';
import { createUser, findUserByEmailAndInstitution } from '../repositories/userRepository.js';

config({ path: resolve(process.cwd(), '.env') });

const DEFAULT_INSTITUTION = 'f0000000-0000-0000-0000-000000000001';
const COUNT = 20;
const ROLE = 'estudiante';

async function resolveInstitutionId(): Promise<string> {
  const fromEnv = process.env.STAGING_INSTITUTION_ID?.trim();
  if (fromEnv) {
    const inst = await findInstitutionById(fromEnv);
    if (inst) return inst.id;
    console.warn(`[seed-staging] STAGING_INSTITUTION_ID ${fromEnv} no existe; usando fallback.`);
  }
  const first = await findAllInstitutions();
  if (first.length === 0) {
    throw new Error('[seed-staging] No hay instituciones en la base de datos.');
  }
  const demo = first.find((i) => i.id === DEFAULT_INSTITUTION) ?? first[0];
  console.log(`[seed-staging] institution_id: ${demo.id} (${demo.name})`);
  return demo.id;
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL requerido (PostgreSQL).');
  }

  const institutionId = await resolveInstitutionId();
  const plain =
    process.env.STAGING_LOAD_PASSWORD?.trim() || 'StagingLoad2026!';
  const passwordHash = await bcrypt.hash(plain, 10);

  let created = 0;
  let skipped = 0;

  for (let n = 1; n <= COUNT; n++) {
    const num = String(n).padStart(2, '0');
    const email = `staging-load-${num}@example.test`;
    const existing = await findUserByEmailAndInstitution(email, institutionId);
    if (existing) {
      skipped++;
      continue;
    }
    await createUser({
      institution_id: institutionId,
      email,
      password_hash: passwordHash,
      full_name: `Staging Load ${num}`,
      role: ROLE,
      status: 'active',
      internal_code: `SL${num}${Date.now().toString(36).slice(-4)}`,
      config: { curso: 'STAGING-LOAD' },
    });
    created++;
    console.log(`[seed-staging] creado ${email}`);
  }

  console.log(`[seed-staging] listo. creados=${created}, omitidos(ya existían)=${skipped}`);
  console.log(`[seed-staging] contraseña para todos (nuevos): ${plain}`);
}

run().catch((e) => {
  console.error('[seed-staging]', (e as Error).message);
  process.exit(1);
});
