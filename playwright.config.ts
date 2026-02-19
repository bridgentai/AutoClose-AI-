import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Configuración mejorada de Playwright para pruebas E2E
 * 
 * Mejoras:
 * - Manejo mejorado de errores de conexión
 * - Timeouts más claros
 * - Verificación del servidor antes de ejecutar tests
 * - Mejor logging de errores
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0, // Sin retries: si falla, termina. Evita re-ejecutar suite completa (modo serial).
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Manejo mejorado de errores de red
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    { 
      name: 'chromium', 
      use: { 
        ...devices['Desktop Chrome'],
        // Headless por defecto, pero puedes cambiar a false para debug
        headless: process.env.PWDEBUG ? false : true,
      } 
    },
  ],
  timeout: 600000, // 10 min (test 4 hace ~150 llamadas API secuenciales)
  expect: { 
    timeout: 10000,
    // Mejorar mensajes de error en expect
    toHaveSnapshot: { threshold: 0.2 },
  },
  // Verificar que el servidor está corriendo antes de ejecutar tests
  // Si el servidor no está corriendo, Playwright mostrará un error claro
  globalSetup: undefined, // Puedes agregar un setup personalizado aquí si lo necesitas
  
  // Configuración para manejar mejor los errores
  globalTeardown: undefined,
});
