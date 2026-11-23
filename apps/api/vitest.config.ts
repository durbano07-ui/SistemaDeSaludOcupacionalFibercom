import { fileURLToPath } from 'node:url';

import { config as cargarEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Variables del .env raíz; las ya definidas (por ejemplo en CI) tienen prioridad.
cargarEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    env: { NODE_ENV: 'test', LOG_LEVEL: 'silent' },
  },
});
