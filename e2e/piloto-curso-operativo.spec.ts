/**
 * Prueba Piloto - Curso Operativo Completo
 *
 * Test E2E híbrido (API + UI) que simula la operación real de un colegio en producción.
 * Crea admin, grupo "Noveno A", 5 profesores, 25 estudiantes, 50 padres, 6 tareas,
 * entregas, calificaciones. Valida UI y permisos. Logs detallados y resumen al final.
 *
 * Tests: 12 (serial). Duración estimada: ~8-12 min.
 * Ver docs/E2E_CURSO_OPERATIVO.md para instrucciones y troubleshooting.
 *
 * Requisitos: Servidor en http://localhost:3000 (npm run dev), MongoDB conectado.
 * Ejecutar: npm run test:e2e:curso-operativo
 */

import { test, expect, type Page } from '@playwright/test';
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
  tipo: 'RESUMEN_PRUEBA_PILOTO_CURSO_OPERATIVO';
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
    tipo: 'RESUMEN_PRUEBA_PILOTO_CURSO_OPERATIVO',
    fechaInicio: new Date().toISOString(),
    tests: [],
    erroresEncontrados: [],
  },
  currentTest: null,

  log(msg: string, nivel: 'info' | 'ok' | 'fail' | 'warn' = 'info') {
    const ts = new Date().toISOString().slice(11, 23);
    const pref = { info: '  ', ok: '✅ ', fail: '❌ ', warn: '⚠️ ' }[nivel];
    const out = `[${ts}] [PILOTO] ${pref}${msg}`;
    console.log(out);
  },

  step(paso: string, estado: 'ok' | 'fail' | 'skip', detalle?: string, error?: string) {
    const entry: PilotStepLog = { paso, estado, detalle, error, timestamp: new Date().toISOString() };
    if (pilotReport.currentTest) pilotReport.currentTest.pasos.push(entry);
    const pref = { ok: '    ✓ ', fail: '    ✗ ', skip: '    ⊘ ' }[estado];
    console.log(`[PILOTO] ${pref}${paso}${detalle ? ` — ${detalle}` : ''}${error ? ` | Error: ${error}` : ''}`);
    if (estado === 'fail' && error) pilotReport.data.erroresEncontrados.push(`[${pilotReport.currentTest?.test || '?'}] ${paso}: ${error}`);
  },

  startTest(numero: number, nombre: string) {
    pilotReport.currentTest = { test: nombre, numero, estado: 'ok', pasos: [] };
    pilotReport.data.tests.push(pilotReport.currentTest);
    const t0 = Date.now();
    (pilotReport.currentTest as PilotTestResult & { _t0?: number })._t0 = t0;
    console.log(`\n[PILOTO] ═══════════════════════════════════════════════════════════════`);
    console.log(`[PILOTO] >>> TEST ${numero}: ${nombre}`);
    console.log(`[PILOTO] ═══════════════════════════════════════════════════════════════`);
  },

  endTest(estado: 'ok' | 'fail' | 'skip', error?: string) {
    if (pilotReport.currentTest) {
      pilotReport.currentTest.estado = estado;
      pilotReport.currentTest.error = error;
      const t0 = (pilotReport.currentTest as PilotTestResult & { _t0?: number })._t0;
      if (t0) pilotReport.currentTest.duracionMs = Date.now() - t0;
      console.log(`[PILOTO] <<< FIN TEST ${pilotReport.currentTest.numero}: ${estado.toUpperCase()}${error ? ` — ${error}` : ''} (${pilotReport.currentTest.duracionMs}ms)\n`);
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

    const resumenPath = path.join(docsDir, `RESUMEN_PRUEBA_PILOTO_${fecha}.md`);
    const ok = pilotReport.data.tests.filter((t) => t.estado === 'ok').length;
    const fail = pilotReport.data.tests.filter((t) => t.estado === 'fail').length;
    const skip = pilotReport.data.tests.filter((t) => t.estado === 'skip').length;

    let md = `# Resumen Prueba Piloto - Curso Operativo

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
      pilotReport.data.erroresEncontrados.forEach((e, i) => {
        md += `${i + 1}. ${e}\n`;
      });
      md += `\n`;
    }

    if (pilotReport.data.credencialesArchivo) {
      md += `## Archivos generados\n\n`;
      md += `- **Credenciales:** \`${pilotReport.data.credencialesArchivo}\`\n`;
    }

    fs.writeFileSync(resumenPath, md, 'utf-8');
    pilotReport.data.resumenArchivo = resumenPath;

    const jsonPath = path.join(docsDir, `RESULTADOS_PRUEBA_PILOTO_${fecha}.json`);
    const jsonData = {
      ...pilotReport.data,
      tests: pilotReport.data.tests.map((t) => ({
        test: t.test,
        numero: t.numero,
        estado: t.estado,
        error: t.error,
        pasos: t.pasos,
        duracionMs: t.duracionMs,
      })),
    };
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');

    // Bloque final: credenciales + resultados juntos al final de la prueba
    console.log(`\n[PILOTO] ═══════════════════════════════════════════════════════════════`);
    console.log(`[PILOTO] 📋 ARCHIVOS GENERADOS AL FINAL DE LA PRUEBA`);
    console.log(`[PILOTO] ═══════════════════════════════════════════════════════════════`);
    console.log(`[PILOTO] 📄 Credenciales: ${pilotReport.data.credencialesArchivo || '(no generado)'}`);
    console.log(`[PILOTO] 📄 Resumen:      ${resumenPath}`);
    console.log(`[PILOTO] 📄 Resultados:   ${jsonPath}`);
    if (pilotReport.data.credenciales) {
      const c = pilotReport.data.credenciales;
      console.log(`[PILOTO] ═══════════════════════════════════════════════════════════════`);
      console.log(`[PILOTO] 🔑 CREDENCIALES DE ACCESO`);
      console.log(`[PILOTO] ═══════════════════════════════════════════════════════════════`);
      console.log(`[PILOTO] Admin: ${c.admin.email} / ${c.admin.password}`);
      c.profesores.forEach((p) => console.log(`[PILOTO] Profesor (${p.materia}): ${p.email} / ${p.password}`));
      c.estudiantes.slice(0, 5).forEach((e) => console.log(`[PILOTO] Estudiante: ${e.email} / ${e.password}`));
      if (c.estudiantes.length > 5) console.log(`[PILOTO] ... y ${c.estudiantes.length - 5} estudiantes más`);
      c.padres.slice(0, 3).forEach((p) => console.log(`[PILOTO] Padre: ${p.email} / ${p.password}`));
      if (c.padres.length > 3) console.log(`[PILOTO] ... y ${c.padres.length - 3} padres más`);
      console.log(`[PILOTO] (Ver archivo JSON para lista completa)`);
    }
    console.log(`[PILOTO] ═══════════════════════════════════════════════════════════════\n`);
  },
};

const API_REQUEST_TIMEOUT = 60000; // 60s por request (test 4 hace ~150 llamadas; servidor puede cargarse)

async function login(request: { post: (url: string, opts?: { data?: object; timeout?: number }) => Promise<{ ok: () => boolean; json: () => Promise<{ token: string }>; text: () => Promise<string> }> }, email: string, password: string): Promise<string> {
  const response = await request.post('/api/auth/login', { data: { email, password }, timeout: API_REQUEST_TIMEOUT });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`[AUTH] Login fallido para ${email}. Respuesta: ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  if (!data.token) throw new Error(`[AUTH] No se recibió token en respuesta para ${email}`);
  return data.token;
}

async function authenticatedRequest(
  request: { get: (u: string, o?: object) => Promise<any>; post: (u: string, o?: object) => Promise<any>; put: (u: string, o?: object) => Promise<any> },
  token: string,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  data?: object,
  timeoutMs = API_REQUEST_TIMEOUT
): Promise<any> {
  const opts: { headers: Record<string, string>; data?: object; timeout?: number } = {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: timeoutMs,
  };
  if (data && method !== 'GET') opts.data = data;
  const response = await (request as any)[method.toLowerCase()](url, opts);
  if (!response.ok()) {
    const body = await response.text();
    const status = (response as { status?: () => number }).status?.() ?? '?';
    throw new Error(`[API] ${method} ${url} falló (${status}). Respuesta: ${body.slice(0, 300)}`);
  }
  return await response.json();
}

async function ensureConsent(page: Page): Promise<void> {
  if (page.url().includes('/consent')) {
    await page.getByRole('checkbox', { name: /términos/i }).check();
    await page.getByRole('checkbox', { name: /privacidad|política/i }).check();
    await page.getByRole('button', { name: /Aceptar y continuar/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  }
}

async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/Correo electrónico|email/i).fill(email);
  await page.getByLabel(/Contraseña|password/i).fill(password);
  await page.getByRole('button', { name: /Ingresar/i }).click();
  await page.waitForURL(/\/(dashboard|consent)/, { timeout: 15000 });
  await ensureConsent(page);
}

const CODIGO_COLEGIO = 'COLEGIO_DEMO_2025';
const MATERIAS = ['Matemáticas', 'Español', 'Ciencias', 'Sociales', 'Inglés'];
const TS = Date.now();
const OUTPUT_DIR = 'prueba-curso-completo-2'; // Carpeta en docs/ para credenciales, resumen y resultados
const NUM_ESTUDIANTES = process.env.PILOTO_RAPIDO ? 10 : 25; // PILOTO_RAPIDO=1 reduce a 10 estudiantes (20 padres) para pruebas más rápidas

test.describe('Piloto Curso Operativo - Noveno A', () => {
  test.setTimeout(600000); // 10 min (test 4 hace ~150 llamadas API)
  test.describe.configure({ mode: 'serial' }); // Ejecutar en orden para preservar estado entre tests

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
    if (!res.ok()) {
      throw new Error('[SERVIDOR] No responde en /api/health. Ejecuta: npm run dev en otra terminal.');
    }
    pilotReport.log('Servidor verificado y listo', 'ok');
  });

  test.afterAll(() => {
    pilotReport.writeResumen();
  });

  test('1. Crear admin y grupo Noveno A', async ({ request }) => {
    pilotReport.startTest(1, 'Crear admin y grupo Noveno A');
    try {
      await test.step('Crear admin', async () => {
        pilotReport.step('Registro de admin en API', 'ok', 'POST /api/auth/register');
        const email = `piloto-curso-${TS}-admin@colegio-piloto.local`;
        const password = 'PilotoCursoAdmin123!';
        const reg = await request.post('/api/auth/register', {
          data: {
            nombre: 'Admin Piloto Curso',
            email,
            password,
            rol: 'admin-general-colegio',
            codigoAcceso: CODIGO_COLEGIO,
          },
        });
        if (!reg.ok()) {
          const body = await reg.text();
          if (!body.includes('ya está') && !body.includes('ya existe')) {
            pilotReport.step('Registro admin', 'fail', undefined, `${reg.status?.() ?? '?'} - ${body.slice(0, 150)}`);
            throw new Error(`[REGISTRO] Admin fallido: ${reg.status?.() ?? '?'} - ${body}`);
          }
          pilotReport.step('Admin ya existía (reutilizando)', 'ok', email);
        } else {
          pilotReport.step('Admin creado', 'ok', email);
        }
        pilotReport.step('Login admin vía API', 'ok', 'Obteniendo token');
        created.admin = { email, password, token: await login(request, email, password) };
        pilotReport.log(`Admin listo: ${email}`, 'ok');
      });

      await test.step('Crear grupo Noveno A', async () => {
        pilotReport.step('Listar grupos existentes', 'ok', 'GET /api/groups/all');
        const groups = await authenticatedRequest(request, created.admin.token, 'GET', '/api/groups/all');
        const noveno = (groups || []).find((g: { nombre: string }) => (g.nombre || '').toUpperCase().trim() === 'NOVENO A');
        if (noveno) {
          created.grupoId = noveno._id;
          pilotReport.step('Grupo Noveno A ya existía', 'ok', `ID: ${noveno._id}`);
          return;
        }
        pilotReport.step('Crear grupo Noveno A', 'ok', 'POST /api/groups/create');
        const resp = await authenticatedRequest(request, created.admin.token, 'POST', '/api/groups/create', {
          nombre: 'Noveno A',
          seccion: 'high-school',
        });
        created.grupoId = resp.grupo._id;
        pilotReport.step('Grupo Noveno A creado', 'ok', `ID: ${resp.grupo._id}`);
      });
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('2. Crear 5 profesores y asignar al grupo', async ({ request }) => {
    pilotReport.startTest(2, 'Crear 5 profesores y asignar al grupo');
    try {
      await test.step('Crear profesores', async () => {
        for (let i = 0; i < MATERIAS.length; i++) {
          const materia = MATERIAS[i];
          const email = `piloto-curso-${TS}-prof${i}@colegio-piloto.local`;
          pilotReport.step(`Crear profesor ${materia}`, 'ok', email);
          const data = await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/create', {
            nombre: `Profesor ${materia}`,
            email,
            rol: 'profesor',
            materias: [materia],
          });
          created.profesores.push({
            id: data.user._id,
            nombre: data.user.nombre,
            email: data.user.email,
            password: data.user.passwordTemporal,
            materia,
          });
        }
        pilotReport.step('5 profesores creados', 'ok', created.profesores.map((p) => p.email).join(', '));
      });

      await test.step('Asignar profesores al grupo', async () => {
        for (const prof of created.profesores) {
          pilotReport.step(`Asignar ${prof.materia} al grupo`, 'ok');
          const resp = await authenticatedRequest(request, created.admin.token, 'POST', '/api/courses/assign-professor-to-groups', {
            professorId: prof.id,
            groupNames: [created.grupoNombre],
          });
          const c = resp.course ?? resp;
          const cId = c?._id ?? c?.id;
          if (cId && !created.courses.some((x) => x.id === cId)) {
            created.courses.push({ id: String(cId), nombre: prof.materia });
          }
        }
        if (created.courses.length === 0) {
          pilotReport.step('Sin cursos en asignación, obteniendo listado GET /api/courses', 'ok', 'Fallback');
          const allCourses = await authenticatedRequest(request, created.admin.token, 'GET', '/api/courses');
          const arr = Array.isArray(allCourses) ? allCourses : (allCourses?.courses ?? []);
          const first = arr.find((c: { nombre?: string }) => (c.nombre || '').includes('Matemáticas')) ?? arr[0];
          if (first) created.courses.push({ id: String(first._id ?? first.id), nombre: first.nombre ?? MATERIAS[0] });
        }
        expect(created.courses.length, 'Debe haber al menos un curso asignado').toBeGreaterThanOrEqual(1);
        pilotReport.step('Profesores asignados al grupo', 'ok', `${created.courses.length} cursos`);
      });
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test(`3. Crear ${NUM_ESTUDIANTES} estudiantes y asignar al grupo`, async ({ request }) => {
    pilotReport.startTest(3, `Crear ${NUM_ESTUDIANTES} estudiantes y asignar al grupo`);
    try {
      for (let i = 0; i < NUM_ESTUDIANTES; i++) {
        const email = `piloto-curso-${TS}-est${i}@colegio-piloto.local`;
        const data = await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/create', {
          nombre: `Estudiante ${i + 1}`,
          email,
          rol: 'estudiante',
        });
        created.estudiantes.push({
          id: data.user._id,
          nombre: data.user.nombre,
          email: data.user.email,
          password: data.user.passwordTemporal,
          curso: created.grupoNombre,
        });
        await authenticatedRequest(request, created.admin.token, 'POST', '/api/groups/assign-student', {
          grupoId: created.grupoNombre,
          estudianteId: data.user._id,
        });
        if ((i + 1) % 5 === 0) pilotReport.step(`Estudiantes ${i - 4}-${i + 1}/${NUM_ESTUDIANTES} creados y asignados`, 'ok');
      }
      pilotReport.step(`${NUM_ESTUDIANTES} estudiantes creados y asignados al grupo Noveno A`, 'ok', `${created.estudiantes.length} registrados`);
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('4. Crear padres, vincular, confirmar y activar', { timeout: 600000 }, async ({ request }) => {
    pilotReport.startTest(4, 'Crear padres, vincular, confirmar y activar');
    try {
      expect(created.estudiantes.length, '[PRERREQUISITO] Requiere estudiantes (test 3).').toBeGreaterThan(0);
      const nPadres = created.estudiantes.length * 2;
      pilotReport.step(`Creando ${nPadres} padres (2 por estudiante) y vinculando`, 'ok', `~${created.estudiantes.length * 6} llamadas API`);
      for (let i = 0; i < created.estudiantes.length; i++) {
        const est = created.estudiantes[i];
        const padre = await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/create', {
          nombre: `Padre de ${est.nombre}`,
          email: `piloto-curso-${TS}-padre-${i}-0@colegio-piloto.local`,
          rol: 'padre',
        });
        const madre = await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/create', {
          nombre: `Madre de ${est.nombre}`,
          email: `piloto-curso-${TS}-padre-${i}-1@colegio-piloto.local`,
          rol: 'padre',
        });
        await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/vinculaciones', {
          padreId: padre.user._id,
          estudianteId: est.id,
        });
        await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/vinculaciones', {
          padreId: madre.user._id,
          estudianteId: est.id,
        });
        created.padres.push(
          { id: padre.user._id, nombre: padre.user.nombre, email: padre.user.email, password: padre.user.passwordTemporal, estudianteId: est.id },
          { id: madre.user._id, nombre: madre.user.nombre, email: madre.user.email, password: madre.user.passwordTemporal, estudianteId: est.id }
        );
        if ((i + 1) % 5 === 0) pilotReport.log(`Padres creados: ${(i + 1) * 2}/${nPadres}`, 'info');
      }
      pilotReport.step(`${created.padres.length} padres creados y vinculados`, 'ok', `${created.padres.length} padres`);

      pilotReport.step('Confirmar vinculaciones por estudiante', 'ok', `${created.estudiantes.length} estudiantes`);
      for (const est of created.estudiantes) {
        await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/confirmar-vinculacion', { estudianteId: est.id });
      }

      pilotReport.step('Activar cuentas de estudiantes y padres', 'ok', `${created.estudiantes.length} estudiantes`);
      for (let idx = 0; idx < created.estudiantes.length; idx++) {
        const est = created.estudiantes[idx];
        try {
          await authenticatedRequest(request, created.admin.token, 'POST', '/api/users/activar-cuentas', { estudianteId: est.id });
          if ((idx + 1) % 5 === 0) pilotReport.log(`Cuentas activadas: ${idx + 1}/${created.estudiantes.length}`, 'info');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          pilotReport.step(`Activar cuentas estudiante ${est.nombre} (${est.id})`, 'fail', undefined, msg);
          throw err;
        }
      }
      pilotReport.step(`${created.padres.length} padres vinculados y cuentas activadas`, 'ok', 'Proceso completo');
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('5. Crear 6 tareas', async ({ request }) => {
    pilotReport.startTest(5, 'Crear 6 tareas');
    try {
      expect(created.profesores?.length, '[PRERREQUISITO] Requiere profesores (test 2). Ejecuta tests en orden.').toBeGreaterThan(0);
      pilotReport.step('Verificar profesores y cursos', 'ok', `${created.profesores?.length ?? 0} profesores`);

      let courseId = created.courses[0]?.id;
      if (!courseId) {
        pilotReport.step('Sin courseId en created, obteniendo GET /api/courses', 'ok', 'Fallback');
        const allCourses = await authenticatedRequest(request, created.admin.token, 'GET', '/api/courses');
        const arr = Array.isArray(allCourses) ? allCourses : (allCourses?.courses ?? []);
        const first = arr.find((c: { nombre?: string }) => (c.nombre || '').includes('Matemáticas')) ?? arr[0];
        courseId = first ? String(first._id ?? first.id) : undefined;
        if (courseId) created.courses.push({ id: courseId, nombre: 'Matemáticas' });
      }
      expect(courseId, '[CURSOS] Debe existir al menos un curso para crear tareas. Revisa asignación de profesores.').toBeTruthy();

      pilotReport.step('Login como profesor', 'ok', created.profesores![0].email);
      const token = await login(request, created.profesores[0].email, created.profesores[0].password);

      for (let i = 0; i < 6; i++) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + i + 3);
        pilotReport.step(`Crear tarea ${i + 1}/6`, 'ok', `POST /api/assignments`);
        const data = await authenticatedRequest(request, token, 'POST', '/api/assignments', {
          titulo: `Tarea ${i + 1} - ${created.courses[0]?.nombre || 'Materia'}`,
          descripcion: `Descripción tarea ${i + 1}`,
          curso: created.grupoNombre,
          courseId,
          fechaEntrega: fecha.toISOString(),
        });
        const assignment = (data && data.assignment) ? data.assignment : data;
        created.tareas.push({ id: assignment._id, titulo: assignment.titulo, courseId });
      }
      expect(created.tareas.length).toBe(6);
      pilotReport.step('6 tareas creadas', 'ok', created.tareas.map((t) => t.titulo).join('; '));
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('6. Validación UI: tareas visibles en profesor, estudiante, padre', async ({ page }) => {
    pilotReport.startTest(6, 'Validación UI: tareas visibles en profesor, estudiante, padre');
    try {
      expect(created.profesores?.[0], '[PRERREQUISITO] Requiere profesores (test 2).').toBeDefined();
      expect(created.estudiantes?.[0], '[PRERREQUISITO] Requiere estudiantes (test 3).').toBeDefined();
      expect(created.padres?.[0], '[PRERREQUISITO] Requiere padres (test 4).').toBeDefined();

      await test.step('Profesor: ver tareas en calendario', async () => {
        pilotReport.step('Login profesor vía UI', 'ok', created.profesores![0].email);
        await loginViaUI(page, created.profesores![0].email, created.profesores![0].password);
        pilotReport.step('Navegar a /teacher-calendar', 'ok');
        await page.goto('/teacher-calendar');
        await page.waitForLoadState('networkidle');
        pilotReport.step('Esperar contenido de página', 'ok');
        await expect(page.locator('body')).toContainText(/Calendario del Mes|Calendario General|tarea|calendario/i, { timeout: 15000 });
        pilotReport.step('Verificar botón crear tarea visible', 'ok');
        await expect(
          page.getByTestId('button-create-assignment').or(page.getByRole('button', { name: /crear.*tarea|nueva tarea/i }))
        ).first().toBeVisible({ timeout: 15000 });
        pilotReport.step('Verificar contenido tarea/calendario', 'ok');
        await expect(page.locator('body')).toContainText(/tarea|calendario/i, { timeout: 5000 });
        pilotReport.step('Profesor: tareas visibles en calendario', 'ok');
      });

      await test.step('Estudiante: ver tareas', async () => {
        pilotReport.step('Login estudiante vía UI', 'ok', created.estudiantes[0].email);
        await loginViaUI(page, created.estudiantes[0].email, created.estudiantes[0].password);
        pilotReport.step('Navegar a /mi-aprendizaje/tareas', 'ok');
        await page.goto('/mi-aprendizaje/tareas');
        await page.waitForLoadState('networkidle');
        pilotReport.step('Verificar contenido tarea/pendiente', 'ok');
        await expect(page.locator('body')).toContainText(/tarea|pendiente|por entregar/i, { timeout: 8000 });
        pilotReport.step('Estudiante: tareas visibles', 'ok');
      });

      await test.step('Padre: vista carga correctamente', async () => {
        pilotReport.step('Login padre vía UI', 'ok', created.padres[0].email);
        await loginViaUI(page, created.padres[0].email, created.padres[0].password);
        pilotReport.step('Navegar a /calendar (vista padre)', 'ok');
        await page.goto('/calendar');
        await page.waitForLoadState('networkidle');
        pilotReport.step('Verificar ausencia de error en página', 'ok');
        await expect(page.locator('body')).not.toContainText(/error|no encontrado/i);
        pilotReport.step('Padre: vista carga correctamente', 'ok');
      });
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('7. Entregas vía UI (estudiante)', async ({ page }) => {
    pilotReport.startTest(7, 'Entregas vía UI (estudiante)');
    try {
      const tarea = created.tareas[0];
      expect(tarea, '[PRERREQUISITO] Requiere tareas (test 5).').toBeDefined();
      const estudiantesParaEntregar = created.estudiantes.slice(0, 3);
      expect(estudiantesParaEntregar.length, '[PRERREQUISITO] Requiere estudiantes (test 3).').toBeGreaterThan(0);

      for (const est of estudiantesParaEntregar) {
        await test.step(`Estudiante ${est.nombre} entrega tarea`, async () => {
          pilotReport.step(`Login estudiante ${est.nombre}`, 'ok', est.email);
          await loginViaUI(page, est.email, est.password);
          pilotReport.step(`Navegar a /assignment/${tarea.id}`, 'ok');
          await page.goto(`/assignment/${tarea.id}`);
          await page.waitForLoadState('networkidle');
          pilotReport.step('Esperar formulario de entrega visible', 'ok');
          const comentario = page.locator('[data-testid="input-comentario"]');
          await comentario.waitFor({ state: 'visible', timeout: 10000 });
          pilotReport.step('Completar campo comentario y enviar', 'ok');
          await comentario.first().fill(`Entrega piloto de ${est.nombre}`);
          await page.getByTestId('button-submit-entrega').click();
          await page.waitForLoadState('networkidle');
          pilotReport.step('Verificar mensaje de éxito', 'ok');
          await expect(page.locator('body')).toContainText(/entreg|éxito|enviad|Tu Entrega|Entregaste/i, { timeout: 8000 });
          created.entregas.push({ tareaId: tarea.id, estudianteId: est.id });
          pilotReport.step(`Entrega completada por ${est.nombre}`, 'ok');
        });
      }
      expect(created.entregas.length, '[ENTREGA] Al menos una entrega debe completarse. Revisa data-testid input-comentario y button-submit-entrega.').toBeGreaterThanOrEqual(1);
      pilotReport.step('Entregas realizadas vía UI', 'ok', `${created.entregas.length} entregas`);
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('8. Calificar entregas vía API', async ({ request }) => {
    pilotReport.startTest(8, 'Calificar entregas vía API');
    if (created.entregas.length === 0) {
      pilotReport.step('Sin entregas del test 7', 'skip', 'Test omitido');
      pilotReport.endTest('skip');
      test.skip(true, 'Requiere entregas del test 7.');
      return;
    }
    try {
      expect(created.profesores?.[0], '[PRERREQUISITO] Requiere profesores (test 2).').toBeDefined();
      pilotReport.step('Login profesor vía API', 'ok', created.profesores![0].email);
      const token = await login(request, created.profesores![0].email, created.profesores![0].password);
      for (const e of created.entregas) {
        pilotReport.step(`Calificar entrega tarea ${e.tareaId} estudiante ${e.estudianteId}`, 'ok');
        await authenticatedRequest(request, token, 'PUT', `/api/assignments/${e.tareaId}/grade`, {
          estudianteId: e.estudianteId,
          calificacion: 85,
          retroalimentacion: 'Excelente trabajo',
          logro: 'Alcanzado',
        });
      }
      pilotReport.step('Calificaciones aplicadas', 'ok', `${created.entregas.length} entregas calificadas`);
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('9. Validación vista padre: dashboard', async ({ page }) => {
    pilotReport.startTest(9, 'Validación vista padre: dashboard');
    try {
      expect(created.padres?.[0], '[PRERREQUISITO] Requiere padres (test 4).').toBeDefined();
      const padre = created.padres![0];
      pilotReport.step('Login padre vía UI', 'ok', padre.email);
      await loginViaUI(page, padre.email, padre.password);
      pilotReport.step('Navegar a /dashboard', 'ok');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      pilotReport.step('Verificar dashboard-page visible', 'ok');
      await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible({ timeout: 8000 });
      pilotReport.step('Verificar ausencia de error/no autorizado', 'ok');
      await expect(page.locator('body')).not.toContainText(/error|no autorizado/i);
      pilotReport.step('Padre: dashboard correcto', 'ok');
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('10. Validar permisos: padre no accede a panel profesor', async ({ page }) => {
    pilotReport.startTest(10, 'Validar permisos: padre no accede a panel profesor');
    try {
      expect(created.padres?.[0], '[PRERREQUISITO] Requiere padres (test 4).').toBeDefined();
      pilotReport.step('Login padre vía UI', 'ok', created.padres![0].email);
      await loginViaUI(page, created.padres![0].email, created.padres![0].password);
      pilotReport.step('Intentar acceder a /profesor/academia', 'ok', 'Debe redirigir');
      await page.goto('/profesor/academia');
      await page.waitForLoadState('networkidle');
      pilotReport.step('Verificar que URL no es /profesor/academia (redirección)', 'ok');
      await expect(page).not.toHaveURL(/\/profesor\/academia/);
      pilotReport.step('Padre no accede a profesor: OK', 'ok');
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('11. Validar permisos: estudiante no accede a admin', async ({ page }) => {
    pilotReport.startTest(11, 'Validar permisos: estudiante no accede a admin');
    try {
      expect(created.estudiantes?.[0], '[PRERREQUISITO] Requiere estudiantes (test 3).').toBeDefined();
      pilotReport.step('Login estudiante vía UI', 'ok', created.estudiantes![0].email);
      await loginViaUI(page, created.estudiantes![0].email, created.estudiantes![0].password);
      pilotReport.step('Navegar a /dashboard', 'ok');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      pilotReport.step('Verificar que no ve Usuarios/Auditoría/admin-general', 'ok');
      await expect(page.locator('body')).not.toContainText(/Usuarios|Auditoría|admin-general/i);
      pilotReport.step('Estudiante no ve panel admin: OK', 'ok');
      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });

  test('12. Generar credenciales y archivo JSON', async () => {
    pilotReport.startTest(12, 'Generar credenciales y archivo JSON');
    try {
      pilotReport.step('Construir objeto de credenciales', 'ok');
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
        entregas: created.entregas.length,
        calificaciones: created.entregas.length,
      };

      const docsDir = path.join(process.cwd(), 'docs', OUTPUT_DIR);
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
      const fecha = new Date().toISOString().split('T')[0];
      const filePath = path.join(docsDir, `CREDENCIALES_PILOTO_CURSO_${fecha}.json`);
      fs.writeFileSync(filePath, JSON.stringify(cred, null, 2), 'utf-8');
      pilotReport.data.credencialesArchivo = filePath;
      pilotReport.data.credenciales = cred;
      pilotReport.step('Archivo credenciales guardado', 'ok', filePath);

      pilotReport.endTest('ok');
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      pilotReport.endTest('fail', err);
      throw e;
    }
  });
});
