import react from '@vitejs/plugin-react';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // "@smo/source": usa directamente el código TypeScript de @smo/shared (sin compilarlo antes).
    conditions: ['@smo/source', ...defaultClientConditions],
  },
  css: {
    preprocessorOptions: {
      scss: { quietDeps: true },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
