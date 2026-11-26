import { fileURLToPath } from 'node:url';

import { config as cargarEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// El .env vive en la raíz del monorepo; las variables ya definidas (CI) tienen prioridad.
cargarEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
