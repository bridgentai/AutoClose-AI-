/**
 * Prueba Piloto - Curso Corto (6 tests)
 *
 * Versión reducida: crea admin, grupo, profesores, estudiantes, padres, tareas.
 * Test 6 genera credenciales y resultados. Sin UI, entregas ni calificaciones.
 *
 * Tests: 6 (serial). Duración estimada: ~5-7 min.
 *
 * Requisitos: Servidor en http://localhost:3000 (npm run dev), MongoDB conectado.
 * Ejecutar: npm run test:e2e:curso-corto
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// --- Tipos ---
interface PilotStepLog {
  paso: string;
  estado: 'ok' | 'fail' | 'skip';
  detalle?: string;
  error?: string;
  timestamp: string;
}

interface PilotTestResult {
  test: string;
  numero: number;
  estado: 'ok' | 'fail' | 'skip';
  error?: string;
  pasos: PilotStepLog[];
  duracionMs?: number;
}

interface PilotReport {
  tipo: string;
  fechaInicio: string;
  fechaFin?: string;
  duracionTotalSeg?: number;
  tests: PilotTestResult[];
  credencialesArchivo?: string;
  credenciales?: CredencialesPiloto;
  resumenArchivo?: string;
  erroresEncontrados: string[];
}

interface CredencialesPiloto {
  fechaEjecucion: string;
  admin: { email: string; password: string };
  profesores: Array<{ nombre: string; email: string; password: string; materia: string }>;
  estudiantes: Array<{ nombre: string; email: string; password: string; curso: string }>;
  padres: Array<{ nombre: string; email: string; password: string; estudianteVinculado: string }>;
  grupo: string;
  tareas: Array<{ id: string; titulo: string }>;
  entregas: number;
  calificaciones: number;
}

interface CreatedData {
  admin: { email: string; password: string; token: string };
  grupoId: string;
  grupoNombre: string;
  profesores: Array<{ id: string; nombre: string; email: string; password: string; materia: string }>;
  estudiantes: Array<{ id: string; nombre: string; email: string; password: string; curso: string }>;
  padres: Array<{ id: string; nombre: string; email: string; password: string; estudianteId: string }>;
  courses: Array<{ id: string; nombre: string }>;
  tareas: Array<{ id: string; titulo: string; courseId: string }>;
  entregas: Array<{ tareaId: string; estudianteId: string }>;
}

const OUTPUT_DIR = 'prueba-curso-corto';
const CODIGO_COLEGIO = 'COLEGIO_DEMO_2025';
const MATERIAS = ['Matemáticas', 'Español', 'Ciencias', 'Sociales', 'Inglés'];
const TS = Date.now();
const NUM_ESTUDIANTES = process.env.PILOTO_RAPIDO ? 10 : 25;
const API_REQUEST_TIMEOUT = 60000;

// --- Helpers ---
const pilotReport: {
  data: PilotReport;
  currentTest: PilotTestResult | null;
  log: (msg: string, nivel?: 'info' | 'ok' | 'fail' | 'warn') => void;
  step: (paso: string, estado: 'ok' | 'fail' | 'skip', detalle?: string, error?: string) => void;
  startTest: (numero: number, nombre: string) => void;
  endTest: (estado: 'ok' | 'fail' | 'skip', error?: string) => void;
  writeResumen: () => void;
} = {
  data: {
    tipo: 'RESUMEN_PRUEBA_PILOTO_CURSO_CORTO',
    fechaInicio: new Date().toISOString(),
    tests: [],
    erroresEncontrados: [],
  },
  currentTest: null,

  log(msg: string, nivel: 'info' | 'ok' | 'fail' | 'warn' = 'info') {
    const ts = new Date().toISOString().slice(11, 23);
    const pref = { info: '  ', ok: '✅ ', fail: '❌ ', warn: '⚠️ ' }[nivel];
    console.log(`[${ts}] [PILOTO-CORTO] ${pref}${msg}`);
  },

  step(paso: string, estado: 'ok' | 'fail' | 'skip', detalle?: string, error?: string) {
    const entry: PilotStepLog = { paso, estado, detalle, error, timestamp: new Date().toISOString() };
    if (pilotReport.currentTest) pilotReport.currentTest.pasos.push(entry);
    const pref = { ok: '    ✓ ', fail: '    ✗ ', skip: '    ⊘ ' }[estado];
    console.log(`[PILOTO-CORTO] ${pref}${paso}${detalle ? ` — ${detalle}` : ''}${error ? ` | Error: ${error}` : ''}`);
    if (estado === 'fail' && error) pilotReport.data.erroresEncontrados.push(`[${pilotReport.currentTest?.test || '?'}] ${paso}: ${error}`);
  },

  startTest(numero: number, nombre: string) {
    pilotReport.currentTest = { test: nombre, numero, estado: 'ok', pasos: [] };
    pilotReport.data.tests.push(pilotReport.currentTest);
    const t0 = Date.now();
    (pilotReport.currentTest as PilotTestResult & { _t0?: number })._t0 = t0;
    console.log(`\n[PILOTO-CORTO] ═══════════════════════════════════════════════════════════════`);
    console.log(`[PILOTO-CORTO] >>> TEST ${numero}: ${nombre}`);
    console.log(`[PILOTO-CORTO] ═══════════════════════════════════════════════════════════════`);
  },

  endTest(estado: 'ok' | 'fail' | 'skip', error?: string) {
    if (pilotReport.currentTest) {
      pilotReport.currentTest.estado = estado;
      pilotReport.currentTest.error = error;
      const t0 = (pilotReport.currentTest as PilotTestResult & { _t0?: number })._t0;
      if (t0) pilotReport.currentTest.duracionMs = Date.now() - t0;
      console.log(`[PILOTO-CORTO] <<< FIN TEST ${pilotReport.currentTest.numero}: ${estado.toUpperCase()} (${pilotReport.currentTest.duracionMs}ms)\n`);
    }
    pilotReport.currentTest = null;
  },

  writeResumen() {
    pilotReport.data.fechaFin = new Date().toISOString();
    const inicio = new Date(pilotReport.data.fechaInicio).getTime();
    const fin = new Date(pilotReport.data.fechaFin).getTime();
    pilotReport.data.duracionTotalSeg = Math.round((fin - inicio) / 1000);

    const docsDir = path.join(process.cwd(), 'docs', OUTPUT_DIR);
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    const fecha = new Date().toISOString().split('T')[0];

    const resumenPath = path.join(docsDir, `RESUMEN_PRUEBA_PILOTO_CORTO_${fecha}.md`);
    const ok = pilotReport.data.tests.filter((t) => t.estado === 'ok').length;
    const fail = pilotReport.data.tests.filter((t) => t.estado === 'fail').length;
    const skip = pilotReport.data.tests.filter((t) => t.estado === 'skip').length;

    let md = `# Resumen Prueba Piloto - Curso Corto

**Fecha de ejecución:** ${pilotReport.data.fechaInicio}
**Duración total:** ${pilotReport.data.duracionTotalSeg} segundos

## Resultado global

| Métrica | Valor |
|---------|-------|
| Tests ejecutados | ${pilotReport.data.tests.length} |
| OK | ${ok} |
| Fallidos | ${fail} |
| Omitidos | ${skip} |

## Detalle por test

`;

    for (const t of pilotReport.data.tests) {
      const icono = { ok: '✅', fail: '❌', skip: '⊘' }[t.estado];
      md += `### ${icono} Test ${t.numero}: ${t.test}\n\n`;
      md += `- **Estado:** ${t.estado.toUpperCase()}${t.duracionMs ? ` (${t.duracionMs}ms)` : ''}\n`;
      if (t.error) md += `- **Error:** ${t.error}\n`;
      if (t.pasos.length > 0) {
        md += `- **Pasos:**\n`;
        for (const p of t.pasos) {
          const picon = { ok: '✓', fail: '✗', skip: '⊘' }[p.estado];
          md += `  - ${picon} ${p.paso}${p.detalle ? ` — ${p.detalle}` : ''}${p.error ? ` — *Error: ${p.error}*` : ''}\n`;
        }
      }
      md += `\n`;
    }

    if (pilotReport.data.erroresEncontrados.length > 0) {
      md += `## Errores encontrados\n\n`;
      pilotReport.data.erroresEncontrados.forEach((e, i) => { md += `${i + 1}. ${e}\n`; });
    }

    if (pilotReport.data.credencialesArchivo) {
      md += `\n## Archivos generados\n\n`;
      md += `- **Credenciales:** \`${pilotReport.data.credencialesArchivo}\`\n`;
    }

    fs.writeFileSync(resumenPath, md, 'utf-8');
    pilotReport.data.resumenArchivo = resumenPath;

    const jsonPath = path.join(docsDir, `RESULTADOS_PRUEBA_PILOTO_CORTO_${fecha}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify({
      ...pilotReport.data,
      tests: pilotReport.data.tests.map((t) => ({
        test: t.test, numero: t.numero, estado: t.estado, error: t.error, pasos: t.pasos, duracionMs: t.duracionMs,
      })),
    }, null, 2), 'utf-8');

    console.log(`\n[PILOTO-CORTO] ═══════════════════════════════════════════════════════════════`);
    console.log(`[PILOTO-CORTO] 📋 ARCHIVOS GENERADOS AL FINAL`);
    console.log(`[PILOTO-CORTO] ═══════════════════════════════════════════════════════════════`);
    console.log(`[PILOTO-CORTO] 📄 Credenciales: ${pilotReport.data.credencialesArchivo || '(no generado)'}`);
    console.log(`[PILOTO-CORTO] 📄 Resumen:      ${resumenPath}`);
    console.log(`[PILOTO-CORTO] 📄 Resultados:   ${jsonPath}`);
    if (pilotReport.data.credenciales) {
      const c = pilotReport.data.credenciales;
      console.log(`[PILOTO-CORTO] ═══════════════════════════════════════════════════════════════`);
      console.log(`[PILOTO-CORTO] 🔑 CREDENCIALES DE ACCESO`);
      console.log(`[PILOTO-CORTO] ═══════════════════════════════════════════════════════════════`);
      console.log(`[PILOTO-CORTO] Admin: ${c.admin.email} / ${c.admin.password}`);
      c.profesores.forEach((p) => console.log(`[PILOTO-CORTO] Profesor (${p.materia}): ${p.email} / ${p.password}`));
      c.estudiantes.slice(0, 5).forEach((e) => console.log(`[PILOTO-CORTO] Estudiante: ${e.email} / ${e.password}`));
      if (c.estudiantes.length > 5) console.log(`[PILOTO-CORTO] ... y ${c.estudiantes.length - 5} estudiantes más`);
      c.padres.slice(0, 3).forEach((p) => console.log(`[PILOTO-CORTO] Padre: ${p.email} / ${p.password}`));
      if (c.padres.length > 3) console.log(`[PILOTO-CORTO] ... y ${c.padres.length - 3} padres más`);
      console.log(`[PILOTO-CORTO] (Ver archivo JSON para lista completa)`);
    }
    console.log(`[PILOTO-CORTO] ═══════════════════════════════════════════════════════════════\n`);
  },
};

async function login(request: { post: (url: string, opts?: { data?: object; timeout?: number }) => Promise<{ ok: () => boolean; json: () => Promise<{ token: string }>; text: () => Promise<string> }> }, email: string, password: string): Promise<string> {
  const response = await request.post('/api/auth/login', { data: { email, password }, timeout: API_REQUEST_TIMEOUT });
  if (!response.ok()) throw new Error(`[AUTH] Login fallido: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  if (!data.token) throw new Error(`[AUTH] No token`);
  return data.token;
}

async function authenticatedRequest(
  request: { get: (u: string, o?: object) => Promise<any>; post: (u: string, o?: object) => Promise<any>; put: (u: string, o?: object) => Promise<any> },
  token: string, method: 'GET' | 'POST' | 'PUT', url: string, data?: object
): Promise<any> {
  const opts: { headers: Record<string, string>; data?: object; timeout?: number } = {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: API_REQUEST_TIMEOUT,
  };
  if (data && method !== 'GET') opts.data = data;
  const response = await (request as any)[method.toLowerCase()](url, opts);
  if (!response.ok()) throw new Error(`[API] ${method} ${url}: ${(await response.text()).slice(0, 200)}`);
  return await response.json();
}

// --- Tests ---
test.describe('Piloto Curso Corto - Noveno A', () => {
  test.setTimeout(600000);
  test.describe.configure({ mode: 'serial' });

  const created: CreatedData = {
    admin: { email: '', password: '', token: '' },
    grupoId: '',
    grupoNombre: 'NOVENO A',
    profesores: [],
    estudiantes: [],
    padres: [],
    courses: [],
    tareas: [],
    entregas: [],
  };

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/health', { timeout: 5000 });
    if (!res.ok()) throw new Error('[SERVIDOR] No responde. Ejecuta: npm run dev');
    pilotReport.log('Servidor verificado', 'ok');
  });

  test.afterAll(() => pilotReport.writeResumen());

  test('1. Crear admin y grupo Noveno A', async ({ request }) => {
    pilotReport.startTest(1, 'Crear admin y grupo Noveno A');
    try {
      const email = `piloto-corto-${TS}-admin@colegio-piloto.local`;
      const password = 'PilotoCursoAdmin123!';
      const reg = await request.post('/api/auth/register', {
        data: { nombre: 'Admin Piloto Corto', email, password, rol: 'admin-general-colegio', codigoAcceso: CODIGO_COLEGIO },
      });
      if (!reg.ok()) {
        const body = await reg.text();
        if (!body.includes('ya está') && !body.includes('ya existe')) throw new Error(`Registro: ${body.slice(0, 150)}`);
      }
      created.admin = { email, password, token: await login(request, email, password) };
      pilotReport.step('Admin creado', 'ok', email);

      const groups = await authenticatedRequest(request, created.admin.token, 'GET', '/api/groups/all');
      const noveno = (groups || []).find((g: { nombre: string }) => (g.nombre || '').toUpperCase().trim() === 'NOVENO A');
      if (noveno) {
        created.grupoId = noveno._id;
        pilotReport.step('Grupo Noveno A existía', 'ok');
      } else {
        const resp = await authenticatedRequest(request, created.admin.token, 'POST', '/api/groups/create', { nombre: 'Noveno A', seccion: 'high-school' });
        created.grupoId = resp.grupo._id;
        pilotReport.step('Grupo Noveno A creado', 'ok');
      }
      pilotReport.endTest('ok');
    } catch (e) {
      pilotReport.endTest('fail', e instanceof Error ? e.message : String(e));
      throw e;
    }
  });

  test('2. Crear 5 profesores y asignar al grupo', async ({ request }) => {
    pilotReport.startTest(2, 'Crear 5 profesores y asignar al grupo');
    try {
      for (let i = 0; i < MATERIAS.length; i++) {
        const materia = MATERIAS[i];
        const email = `piloto-corto-${TS}-prof${i}@colegio-piloto.local`;
        const data = await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/create', {
          nombre: `Profesor ${materia}`, email, rol: 'profesor', materias: [materia],
        });
        created.profesores.push({ id: data.user._id, nombre: data.user.nombre, email: data.user.email, password: data.user.passwordTemporal, materia });
      }
      for (const prof of created.profesores) {
        const resp = await authenticatedRequest(request, created.admin.token, 'POST', '/api/courses/assign-professor-to-groups', {
          professorId: prof.id, groupNames: [created.grupoNombre],
        });
        const c = resp.course ?? resp;
        const cId = c?._id ?? c?.id;
        if (cId && !created.courses.some((x) => x.id === cId)) created.courses.push({ id: String(cId), nombre: prof.materia });
      }
      if (created.courses.length === 0) {
        const allCourses = await authenticatedRequest(request, created.admin.token, 'GET', '/api/courses');
        const arr = Array.isArray(allCourses) ? allCourses : (allCourses?.courses ?? []);
        const first = arr.find((c: { nombre?: string }) => (c.nombre || '').includes('Matemáticas')) ?? arr[0];
        if (first) created.courses.push({ id: String(first._id ?? first.id), nombre: first.nombre ?? MATERIAS[0] });
      }
      expect(created.courses.length).toBeGreaterThanOrEqual(1);
      pilotReport.step('5 profesores creados y asignados', 'ok');
      pilotReport.endTest('ok');
    } catch (e) {
      pilotReport.endTest('fail', e instanceof Error ? e.message : String(e));
      throw e;
    }
  });

  test('3. Crear estudiantes y asignar al grupo', async ({ request }) => {
    pilotReport.startTest(3, `Crear ${NUM_ESTUDIANTES} estudiantes y asignar al grupo`);
    try {
      for (let i = 0; i < NUM_ESTUDIANTES; i++) {
        const email = `piloto-corto-${TS}-est${i}@colegio-piloto.local`;
        const data = await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/create', {
          nombre: `Estudiante ${i + 1}`, email, rol: 'estudiante',
        });
        created.estudiantes.push({ id: data.user._id, nombre: data.user.nombre, email: data.user.email, password: data.user.passwordTemporal, curso: created.grupoNombre });
        await authenticatedRequest(request, created.admin.token, 'POST', '/api/groups/assign-student', { grupoId: created.grupoNombre, estudianteId: data.user._id });
      }
      pilotReport.step(`${NUM_ESTUDIANTES} estudiantes creados`, 'ok');
      pilotReport.endTest('ok');
    } catch (e) {
      pilotReport.endTest('fail', e instanceof Error ? e.message : String(e));
      throw e;
    }
  });

  test('4. Crear padres, vincular, confirmar y activar', { timeout: 600000 }, async ({ request }) => {
    pilotReport.startTest(4, 'Crear padres, vincular, confirmar y activar');
    try {
      expect(created.estudiantes.length).toBeGreaterThan(0);
      const nPadres = created.estudiantes.length * 2;
      for (let i = 0; i < created.estudiantes.length; i++) {
        const est = created.estudiantes[i];
        const padre = await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/create', {
          nombre: `Padre de ${est.nombre}`, email: `piloto-corto-${TS}-padre-${i}-0@colegio-piloto.local`, rol: 'padre',
        });
        const madre = await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/create', {
          nombre: `Madre de ${est.nombre}`, email: `piloto-corto-${TS}-padre-${i}-1@colegio-piloto.local`, rol: 'padre',
        });
        await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/vinculaciones', { padreId: padre.user._id, estudianteId: est.id });
        await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/vinculaciones', { padreId: madre.user._id, estudianteId: est.id });
        created.padres.push(
          { id: padre.user._id, nombre: padre.user.nombre, email: padre.user.email, password: padre.user.passwordTemporal, estudianteId: est.id },
          { id: madre.user._id, nombre: madre.user.nombre, email: madre.user.email, password: madre.user.passwordTemporal, estudianteId: est.id }
        );
        if ((i + 1) % 5 === 0) pilotReport.log(`Padres: ${(i + 1) * 2}/${nPadres}`, 'info');
      }
      for (const est of created.estudiantes) {
        await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/confirmar-vinculacion', { estudianteId: est.id });
      }
      for (const est of created.estudiantes) {
        await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/activar-cuentas', { estudianteId: est.id });
      }
      pilotReport.step(`${created.padres.length} padres vinculados y activados`, 'ok');
      pilotReport.endTest('ok');
    } catch (e) {
      pilotReport.endTest('fail', e instanceof Error ? e.message : String(e));
      throw e;
    }
  });

  test('5. Crear 6 tareas', async ({ request }) => {
    pilotReport.startTest(5, 'Crear 6 tareas');
    try {
      expect(created.profesores?.length).toBeGreaterThan(0);
      let courseId = created.courses[0]?.id;
      if (!courseId) {
        const allCourses = await authenticatedRequest(request, created.admin.token, 'GET', '/api/courses');
        const arr = Array.isArray(allCourses) ? allCourses : (allCourses?.courses ?? []);
        const first = arr.find((c: { nombre?: string }) => (c.nombre || '').includes('Matemáticas')) ?? arr[0];
        courseId = first ? String(first._id ?? first.id) : undefined;
        if (courseId) created.courses.push({ id: courseId, nombre: 'Matemáticas' });
      }
      expect(courseId).toBeTruthy();
      const token = await login(request, created.profesores![0].email, created.profesores![0].password);
      for (let i = 0; i < 6; i++) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + i + 3);
        const data = await authenticatedRequest(request, token, 'POST', '/api/assignments', {
          titulo: `Tarea ${i + 1} - ${created.courses[0]?.nombre || 'Materia'}`,
          descripcion: `Descripción tarea ${i + 1}`,
          curso: created.grupoNombre,
          courseId,
          fechaEntrega: fecha.toISOString(),
        });
        const assignment = (data?.assignment) ? data.assignment : data;
        created.tareas.push({ id: assignment._id, titulo: assignment.titulo, courseId });
      }
      expect(created.tareas.length).toBe(6);
      pilotReport.step('6 tareas creadas', 'ok');
      pilotReport.endTest('ok');
    } catch (e) {
      pilotReport.endTest('fail', e instanceof Error ? e.message : String(e));
      throw e;
    }
  });

  test('6. Generar credenciales y resultados', async () => {
    pilotReport.startTest(6, 'Generar credenciales y resultados');
    try {
      pilotReport.step('Construir credenciales', 'ok');
      const cred: CredencialesPiloto = {
        fechaEjecucion: new Date().toISOString(),
        admin: { email: created.admin.email, password: created.admin.password },
        profesores: created.profesores.map((p) => ({ nombre: p.nombre, email: p.email, password: p.password, materia: p.materia })),
        estudiantes: created.estudiantes.map((e) => ({ nombre: e.nombre, email: e.email, password: e.password, curso: e.curso })),
        padres: created.padres.map((p) => ({
          nombre: p.nombre,
          email: p.email,
          password: p.password,
          estudianteVinculado: created.estudiantes.find((e) => e.id === p.estudianteId)?.nombre || '',
        })),
        grupo: created.grupoNombre,
        tareas: created.tareas.map((t) => ({ id: t.id, titulo: t.titulo })),
        entregas: 0,
        calificaciones: 0,
      };

      const docsDir = path.join(process.cwd(), 'docs', OUTPUT_DIR);
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
      const fecha = new Date().toISOString().split('T')[0];
      const filePath = path.join(docsDir, `CREDENCIALES_PILOTO_CORTO_${fecha}.json`);
      fs.writeFileSync(filePath, JSON.stringify(cred, null, 2), 'utf-8');
      pilotReport.data.credencialesArchivo = filePath;
      pilotReport.data.credenciales = cred;
      pilotReport.step('Archivo credenciales guardado', 'ok', filePath);
      pilotReport.endTest('ok');
    } catch (e) {
      pilotReport.endTest('fail', e instanceof Error ? e.message : String(e));
      throw e;
    }
  });
});
