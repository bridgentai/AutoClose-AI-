/**
 * Prueba piloto MVP - Cumple con todos los requisitos de docs/MVP_VALIDACION_PILOTO.md
 *
 * Requisitos: app corriendo (npm run dev), MongoDB conectado.
 * Opcional: ADMIN_EMAIL y ADMIN_PASSWORD en .env o env para login.
 *
 * Ejecutar: npx playwright test e2e/piloto-mvp.spec.ts
 * 
 * IMPORTANTE: Antes de ejecutar, asegúrate de que:
 * 1. El servidor está corriendo: npm run dev
 * 2. MongoDB está conectado (verifica los logs del servidor)
 * 3. El puerto 3000 está libre y accesible
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD;

// Verificar que el servidor está disponible antes de ejecutar tests
test.beforeAll(async ({ request }) => {
  try {
    const response = await request.get('/api/health', { timeout: 5000 });
    if (!response.ok()) {
      throw new Error(`Servidor no responde correctamente: ${response.status()}`);
    }
  } catch (error: any) {
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('timeout')) {
      throw new Error(
        '❌ ERROR: El servidor no está corriendo en http://localhost:3000\n' +
        'Por favor ejecuta: npm run dev\n' +
        'Y espera a ver el mensaje "🚀 Servidor iniciado exitosamente!" antes de ejecutar los tests.'
      );
    }
    throw error;
  }
});

test.describe('Prueba piloto MVP - Requisitos completos', () => {
  test.beforeEach(async ({ page }) => {
    // Manejo mejorado de errores de navegación
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (error: any) {
      if (error.message?.includes('net::ERR_CONNECTION_REFUSED')) {
        throw new Error(
          '❌ ERROR: No se puede conectar al servidor.\n' +
          'Asegúrate de que el servidor está corriendo: npm run dev'
        );
      }
      throw error;
    }
  });

  // --- 1. Creación de cuentas y roles ---
  test('1.1 App carga y muestra login o dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/(login|dashboard|consent)?/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('1.2 Página de login accesible y tiene formulario', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('input-email')).toBeVisible();
    await expect(page.getByTestId('input-password')).toBeVisible();
    await expect(page.getByTestId('button-login')).toBeVisible();
  });

  test('1.3 Páginas estáticas Términos y Privacidad existen', async ({ page }) => {
    await page.goto('/terminos');
    await expect(page.getByRole('heading', { name: /Términos/i })).toBeVisible();
    await page.goto('/privacidad');
    await expect(page.getByRole('heading', { name: /Privacidad/i })).toBeVisible();
  });

  // --- 2. Configuración académica (requiere login admin) ---
  test('2.1 Con credenciales admin: login y redirección a dashboard', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'ADMIN_EMAIL y ADMIN_PASSWORD no configurados');
    await page.goto('/login');
    await page.getByTestId('input-email').fill(ADMIN_EMAIL!);
    await page.getByTestId('input-password').fill(ADMIN_PASSWORD!);
    await page.getByTestId('button-login').click();
    await page.waitForURL(/\/(dashboard|consent)/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('2.2 Consentimiento: si aparece /consent, tiene enlaces a términos y privacidad', async ({ page }) => {
    await page.goto('/consent');
    const linkTerminos = page.getByRole('link', { name: /Términos/i });
    const linkPrivacidad = page.getByRole('link', { name: /Privacidad/i });
    await expect(linkTerminos).toBeVisible();
    await expect(linkPrivacidad).toBeVisible();
  });

  // --- 3. Validación de dashboards (rutas y contenido por rol) ---
  test('3.1 Ruta /dashboard existe y carga', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('3.2 Ruta /notificaciones existe', async ({ page }) => {
    await page.goto('/notificaciones');
    await expect(page).toHaveURL(/\/notificaciones/);
    await expect(page.getByText(/Notificaciones/i).first()).toBeVisible();
  });

  test('3.3 Ruta /boletin existe', async ({ page }) => {
    await page.goto('/boletin');
    await expect(page).toHaveURL(/\/boletin/);
  });

  test('3.4 Ruta /directivo redirige a Academia', async ({ page }) => {
    await page.goto('/directivo');
    await expect(page).toHaveURL(/\/directivo\/academia/);
  });

  test('3.5 Ruta /mi-aprendizaje existe (estudiante)', async ({ page }) => {
    await page.goto('/mi-aprendizaje');
    await expect(page).toHaveURL(/\/mi-aprendizaje/);
  });

  test('3.6 Ruta /profesor/academia existe', async ({ page }) => {
    await page.goto('/profesor/academia');
    await expect(page).toHaveURL(/\/profesor\/academia/);
  });

  // --- 4. Seguridad y permisos (APIs) ---
  test('4.1 Health check API responde', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
  });

  test('4.2 Login API rechaza credenciales inválidas', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'noexiste@test.com', password: 'wrong' },
    });
    expect(res.status()).toBe(401);
  });

  // --- 5. Funciones transversales ---
  test('5.1 PWA: manifest.json accesible', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.name).toBeDefined();
    expect(json.start_url).toBeDefined();
  });

  test('5.2 Página de consentimiento tiene botón Aceptar y continuar', async ({ page }) => {
    await page.goto('/consent');
    await expect(page.getByRole('button', { name: /Aceptar y continuar/i })).toBeVisible();
  });

  test('5.3 Boletín: página tiene zona imprimible o botón Imprimir', async ({ page }) => {
    await page.goto('/boletin');
    const imprimir = page.getByRole('button', { name: /Imprimir/i });
    const content = page.locator('#boletin-print, [id*="boletin"]');
    const hasPrint = (await imprimir.count()) > 0 || (await content.count()) > 0;
    expect(hasPrint).toBeTruthy();
  });

  test('5.4 Notificaciones: página tiene opción marcar leídas o listado', async ({ page }) => {
    await page.goto('/notificaciones');
    await expect(
      page.getByText(/Bandeja|Notificaciones|sin leer|Marcar/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('5.5 Vista directivo: Gestión muestra hub de tarjetas', async ({ page }) => {
    await page.goto('/directivo/gestion');
    await expect(
      page.getByText(/Gestión|Usuarios|Asignación de Horarios/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('5.6 Vista directivo: ruta /directivo redirige a gestión', async ({ page }) => {
    await page.goto('/directivo');
    await expect(page).toHaveURL(/\/directivo\/gestion/);
  });

  test('5.7 Login redirige a /dashboard o /consent tras éxito (con credenciales)', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Credenciales no configuradas');
    await page.goto('/login');
    await page.getByTestId('input-email').fill(ADMIN_EMAIL!);
    await page.getByTestId('input-password').fill(ADMIN_PASSWORD!);
    await page.getByTestId('button-login').click();
    await page.waitForURL(/\/(dashboard|consent)/, { timeout: 15000 });
    const url = page.url();
    expect(url).toMatch(/\/(dashboard|consent)/);
  });

  test('5.8 Chat y Mi perfil accesibles (rutas)', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/chat/);
    await page.goto('/mi-perfil');
    await expect(page).toHaveURL(/\/mi-perfil/);
  });
});

test.describe('Piloto MVP - Flujo completo (con admin)', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Requiere ADMIN_EMAIL y ADMIN_PASSWORD');

  test('Flujo: login admin → dashboard con secciones (Usuarios, Cursos, Auditoría)', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('input-email').fill(ADMIN_EMAIL!);
    await page.getByTestId('input-password').fill(ADMIN_PASSWORD!);
    await page.getByTestId('button-login').click();
    await page.waitForURL(/\/(dashboard|consent)/, { timeout: 15000 });
    if (page.url().includes('/consent')) {
      await page.getByRole('checkbox').first().check();
      await page.getByRole('checkbox').nth(1).check();
      await page.getByRole('button', { name: /Aceptar y continuar/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    }
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('button', { name: /Dashboard|Usuarios|Auditoría/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
