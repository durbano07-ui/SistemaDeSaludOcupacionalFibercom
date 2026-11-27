import { fileURLToPath } from 'node:url';

import { config as cargarEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Variables del .env raíz; las ya definidas (por ejemplo en CI) tienen prioridad.
cargarEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

/**
 * Las pruebas de integración usan SIEMPRE la base smo_pruebas (nunca la de desarrollo):
 * DATABASE_URL_PRUEBAS si está definida; si no, DATABASE_URL con la base cambiada a smo_pruebas.
 */
function urlBasePruebas(): string | undefined {
  if (process.env.DATABASE_URL_PRUEBAS) return process.env.DATABASE_URL_PRUEBAS;
  if (!process.env.DATABASE_URL) return undefined;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/smo_pruebas';
  return url.toString();
}

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: urlBasePruebas() ?? '' },
    // Varias suites escriben en la misma base: se ejecutan de a una.
    fileParallelism: false,
    // Cobertura (caja blanca): pnpm --filter @smo/api test:cobertura
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/generated/**', 'src/main.ts'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
