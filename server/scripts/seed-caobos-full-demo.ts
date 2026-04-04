/**
 * Completa datos demo Caobos (PostgreSQL): directores por sección, cursos nuevos,
 * estudiantes (inserción masiva por grupo) y copia de materias para 12H/12C/12D desde 11H.
 *
 * Contraseña demo: Caobosdemo. Rol en DB: `directivo` (en la app: director de sección).
 *
 * Idempotencia: no vuelve a insertar mismos emails. Para rehecho limpio de alumnos de prueba:
 *   DELETE FROM users WHERE institution_id = 'f0000000-0000-0000-0000-000000000001'
 *     AND role = 'estudiante' AND email LIKE 'alumno.%@caobos.edu.co';
 *
 * Uso: npx tsx server/scripts/seed-caobos-full-demo.ts
 */
import '../config/env.js';
import bcrypt from 'bcryptjs';
import { getPgPool, queryPg } from '../config/db-pg.js';
import { generateUserId } from '../utils/idGenerator.js';

const INSTITUTION_ID = 'f0000000-0000-0000-0000-000000000001';
const DEMO_PASSWORD = 'Caobosdemo';
const TEMPLATE_GROUP_NAME = '11H';

type SectionKey = 'high' | 'middle' | 'junior' | 'koala';

const SECTION_NAMES: Record<SectionKey, string> = {
  high: 'High School',
  middle: 'Middle School',
  junior: 'Junior School',
  koala: 'Little Koalas',
};

const DIRECTORS: Array<{ name: string; email: string; section: SectionKey }> = [
  { name: 'Mauricio Posada', email: 'mauricio.posada@caobos.edu.co', section: 'high' },
  { name: 'Claudia Cruz', email: 'claudia.cruz@caobos.edu.co', section: 'middle' },
  { name: 'random1', email: 'random1@caobos.edu.co', section: 'junior' },
  { name: 'random2', email: 'random2@caobos.edu.co', section: 'koala' },
];

const HS_NEW_GROUPS: Record<string, number> = { '12H': 13, '12C': 12, '12D': 13 };

const MIDDLE_GROUPS: Array<{ name: string; students: number }> = [
  { name: '8A', students: 17 },
  { name: '8B', students: 17 },
  { name: '7A', students: 17 },
  { name: '7B', students: 17 },
  { name: '6A', students: 17 },
  { name: '6B', students: 17 },
];

const JUNIOR_GROUPS: Array<{ name: string; students: number }> = [
  { name: '5A', students: 19 },
  { name: '5B', students: 19 },
  { name: '4A', students: 18 },
  { name: '4B', students: 18 },
  { name: '3A', students: 18 },
  { name: '3B', students: 18 },
  { name: '2A', students: 18 },
  { name: '2B', students: 18 },
  { name: '1A', students: 18 },
  { name: '1B', students: 18 },
];

const KOALA_GROUPS: Array<{ name: string; students: number }> = [
  { name: 'PKA', students: 20 },
  { name: 'PKB', students: 20 },
  { name: 'KA', students: 19 },
  { name: 'KB', students: 19 },
];

type Tx = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
};

async function randomInternalCode(c: Tx): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const r = await c.query('SELECT 1 FROM users WHERE internal_code = $1 LIMIT 1', [code]);
    if (!r.rowCount) return code;
  }
  throw new Error('internal_code');
}

async function sectionIdByName(c: Tx, name: string): Promise<string> {
  const r = await c.query(
    'SELECT id FROM sections WHERE institution_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))',
    [INSTITUTION_ID, name]
  );
  const id = r.rows[0]?.id as string | undefined;
  if (!id) throw new Error(`Sección no encontrada: ${name}`);
  return id;
}

async function ensureGroup(c: Tx, sectionId: string, groupName: string): Promise<string> {
  const upper = groupName.toUpperCase().trim();
  const ex = await c.query(
    'SELECT id FROM groups WHERE institution_id = $1 AND UPPER(TRIM(name)) = UPPER(TRIM($2))',
    [INSTITUTION_ID, upper]
  );
  if (ex.rows[0]?.id) return ex.rows[0].id as string;
  const ins = await c.query(
    `INSERT INTO groups (institution_id, section_id, name, description, academic_period_id)
     VALUES ($1, $2, $3, $4, NULL) RETURNING id`,
    [INSTITUTION_ID, sectionId, upper, `Grupo ${upper}`]
  );
  return ins.rows[0]!.id as string;
}

async function copySubjectsFromGroup(c: Tx, sourceGroupName: string, targetGroupId: string): Promise<number> {
  const src = await c.query(
    `SELECT g.id FROM groups g
     JOIN sections s ON s.id = g.section_id
     WHERE g.institution_id = $1 AND UPPER(TRIM(g.name)) = UPPER(TRIM($2))
       AND LOWER(TRIM(s.name)) IN ('high school', 'highschool')`,
    [INSTITUTION_ID, sourceGroupName]
  );
  const fromId = src.rows[0]?.id as string | undefined;
  if (!fromId) throw new Error(`Grupo plantilla ${sourceGroupName} no encontrado`);

  const rows = await c.query(
    'SELECT subject_id, teacher_id, display_name, icon FROM group_subjects WHERE group_id = $1',
    [fromId]
  );
  let n = 0;
  for (const row of rows.rows as Array<{
    subject_id: string;
    teacher_id: string | null;
    display_name: string | null;
    icon: string | null;
  }>) {
    const exists = await c.query(
      'SELECT 1 FROM group_subjects WHERE group_id = $1 AND subject_id = $2',
      [targetGroupId, row.subject_id]
    );
    if (exists.rowCount) continue;
    await c.query(
      `INSERT INTO group_subjects (institution_id, group_id, subject_id, teacher_id, display_name, icon)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [INSTITUTION_ID, targetGroupId, row.subject_id, row.teacher_id, row.display_name, row.icon]
    );
    n++;
  }
  return n;
}

async function upsertDirector(c: Tx, fullName: string, email: string, sectionId: string, hash: string): Promise<void> {
  const em = email.toLowerCase().trim();
  const found = await c.query(
    'SELECT id FROM users WHERE institution_id = $1 AND LOWER(email) = $2 LIMIT 1',
    [INSTITUTION_ID, em]
  );
  if (found.rows[0]?.id) {
    const uid = found.rows[0].id as string;
    await c.query(
      `UPDATE users SET full_name = $1, role = 'directivo', status = 'active', section_id = $2, password_hash = $3, updated_at = now()
       WHERE id = $4 AND institution_id = $5`,
      [fullName, sectionId, hash, uid, INSTITUTION_ID]
    );
    const info = generateUserId('directivo', uid as never);
    await c.query(
      `UPDATE users SET config = COALESCE(config, '{}'::jsonb) || $1::jsonb, updated_at = now() WHERE id = $2`,
      [JSON.stringify({ userId: info.fullId }), uid]
    );
    return;
  }
  const code = await randomInternalCode(c);
  const ins = await c.query(
    `INSERT INTO users (institution_id, email, password_hash, full_name, role, status, internal_code, section_id, config)
     VALUES ($1, $2, $3, $4, 'directivo', 'active', $5, $6, '{}'::jsonb) RETURNING id`,
    [INSTITUTION_ID, em, hash, fullName, code, sectionId]
  );
  const id = ins.rows[0]!.id as string;
  const info = generateUserId('directivo', id as never);
  await c.query('UPDATE users SET config = $1::jsonb, updated_at = now() WHERE id = $2', [
    JSON.stringify({ userId: info.fullId }),
    id,
  ]);
}

function slugEmail(groupName: string): string {
  return groupName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function nextAlumnoIndex(c: Tx, groupName: string): Promise<number> {
  const slug = slugEmail(groupName);
  const like = `alumno.${slug}.%@caobos.edu.co`;
  const r = await c.query('SELECT email FROM users WHERE institution_id = $1 AND email ILIKE $2', [
    INSTITUTION_ID,
    like,
  ]);
  let max = 0;
  const re = new RegExp(`^alumno\\.${slug}\\.(\\d+)@`, 'i');
  for (const row of r.rows as Array<{ email: string }>) {
    const m = row.email?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/** Por grupo: inserta estudiantes, luego config, luego matrículas (misma transacción). */
async function bulkStudentsForGroup(
  c: Tx,
  groupId: string,
  groupLabel: string,
  slug: string,
  startN: number,
  count: number,
  passwordHash: string
): Promise<number> {
  if (count <= 0) return 0;
  const endN = startN + count - 1;
  const ins = await c.query(
    `WITH serie AS (SELECT generate_series($1::int, $2::int) AS n)
     INSERT INTO users (institution_id, email, password_hash, full_name, role, status, internal_code, config)
     SELECT
       $3::uuid,
       'alumno.' || $4::text || '.' || lpad(serie.n::text, 3, '0') || '@caobos.edu.co',
       $5,
       'Alumno ' || $6::text || ' ' || serie.n::text,
       'estudiante',
       'active',
       NULL,
       '{}'::jsonb
     FROM serie
     ON CONFLICT (email, institution_id) DO NOTHING
     RETURNING id`,
    [startN, endN, INSTITUTION_ID, slug, passwordHash, groupLabel]
  );
  const ids = ins.rows.map((row) => row.id as string);
  if (ids.length === 0) return 0;
  await c.query(
    `UPDATE users u
     SET config = jsonb_build_object('userId', 'STU-' || u.id::text), updated_at = now()
     WHERE u.id = ANY($1::uuid[])`,
    [ids]
  );
  const enr = await c.query(
    `INSERT INTO enrollments (student_id, group_id, academic_period_id)
     SELECT unnest($1::uuid[]), $2::uuid, NULL`,
    [ids, groupId]
  );
  return ids.length;
}

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const pool = getPgPool();
  const client = await pool.connect();
  const c = client as unknown as Tx;

  const sectionIds: Record<SectionKey, string> = {
    high: await sectionIdByName(c, SECTION_NAMES.high),
    middle: await sectionIdByName(c, SECTION_NAMES.middle),
    junior: await sectionIdByName(c, SECTION_NAMES.junior),
    koala: await sectionIdByName(c, SECTION_NAMES.koala),
  };

  let insertedStudents = 0;

  try {
    await client.query('BEGIN');

    for (const d of DIRECTORS) {
      await upsertDirector(c, d.name, d.email, sectionIds[d.section], hash);
    }

    for (const [gName, count] of Object.entries(HS_NEW_GROUPS)) {
      const gid = await ensureGroup(c, sectionIds.high, gName);
      const nCopy = await copySubjectsFromGroup(c, TEMPLATE_GROUP_NAME, gid);
      console.log(`[seed-caobos] HS ${gName}: materias ${nCopy}`);
      const start = await nextAlumnoIndex(c, gName);
      const slug = slugEmail(gName);
      insertedStudents += await bulkStudentsForGroup(c, gid, gName, slug, start, count, hash);
    }

    for (const { name, students } of MIDDLE_GROUPS) {
      const gid = await ensureGroup(c, sectionIds.middle, name);
      const start = await nextAlumnoIndex(c, name);
      insertedStudents += await bulkStudentsForGroup(c, gid, name, slugEmail(name), start, students, hash);
    }

    for (const { name, students } of JUNIOR_GROUPS) {
      const gid = await ensureGroup(c, sectionIds.junior, name);
      const start = await nextAlumnoIndex(c, name);
      insertedStudents += await bulkStudentsForGroup(c, gid, name, slugEmail(name), start, students, hash);
    }

    for (const { name, students } of KOALA_GROUPS) {
      const gid = await ensureGroup(c, sectionIds.koala, name);
      const start = await nextAlumnoIndex(c, name);
      insertedStudents += await bulkStudentsForGroup(c, gid, name, slugEmail(name), start, students, hash);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const tot = await queryPg<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM users WHERE institution_id = $1 AND role = 'estudiante'`,
    [INSTITUTION_ID]
  );
  const dirC = await queryPg<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM users WHERE institution_id = $1 AND role = 'directivo'`,
    [INSTITUTION_ID]
  );
  console.log(`[seed-caobos] Directivos: ${dirC.rows[0]?.c}`);
  console.log(`[seed-caobos] Estudiantes totales: ${tot.rows[0]?.c}`);
  console.log(`[seed-caobos] Estudiantes insertados (filas nuevas en users): ${insertedStudents}`);
  console.log('[seed-caobos] Listo.');
}

main().catch((err) => {
  console.error('[seed-caobos]', err);
  process.exit(1);
});
