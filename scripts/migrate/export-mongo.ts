/**
 * Phase 2 - Export MongoDB collections to JSON.
 * Excludes: facturas, pagos (treasury). Optionally exclude boletines (reports computed later).
 * Run: npx tsx scripts/migrate/export-mongo.ts
 */

import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI_DIRECT || '';
if (!MONGO_URI) {
  console.error('Set MONGO_URI or MONGODB_URI_DIRECT in .env');
  process.exit(1);
}

const OUT_DIR = resolve(process.cwd(), 'scripts/migrate/data');

const COLLECTIONS_TO_EXPORT = [
  'config_institucion',
  'codigos_institucion',
  'usuarios',
  'secciones',
  'materias',
  'grupos',
  'grupo_estudiantes',
  'cursos',
  'tareas',
  'notas',
  'asistencias',
  'grade_events',
  'grading_schemas',
  'grading_categories',
  'logros_calificacion',
  'conversaciones',
  'mensajes',
  'notificaciones',
  'eventos',
  'vinculaciones',
  'chats',
  'chat_messages',
  'evo_threads',
  'evo_messages',
  'materiales',
  'assignment_materials',
  'examenes',
  'performance_snapshots',
  'performance_forecasts',
  'risk_assessments',
  'ai_action_logs',
  'group_schedules',
  'professor_schedules',
] as const;

const EXCLUDED = ['facturas', 'pagos', 'boletines'];

async function run() {
  const dbModule = await import('../../server/config/db.ts');
  const { mongoose, connectDB } = dbModule;
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    console.error('MongoDB not connected');
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const existingCollections = await db.listCollections().toArray();
  const names = existingCollections.map((c) => c.name);

  for (const collName of COLLECTIONS_TO_EXPORT) {
    if (!names.includes(collName)) {
      console.warn(`Collection ${collName} not found, skipping`);
      continue;
    }
    const coll = db.collection(collName);
    const cursor = coll.find({});
    const docs: unknown[] = [];
    for await (const doc of cursor) {
      const d = doc as Record<string, unknown>;
      if (d._id && typeof d._id === 'object' && 'toHexString' in d._id) {
        (d as Record<string, unknown>)._id = (d._id as { toHexString: () => string }).toHexString();
      }
      docs.push(d);
    }
    const outPath = resolve(OUT_DIR, `${collName}.json`);
    writeFileSync(outPath, JSON.stringify(docs, null, 0), 'utf-8');
    console.log(`${collName}: ${docs.length} documents -> ${outPath}`);
  }

  console.log(`\nExcluded (not exported): ${EXCLUDED.join(', ')}`);
  console.log('Done.');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
