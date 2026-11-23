import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom no implementa matchMedia; Carbon lo usa en el SideNav. Simula una pantalla grande.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((consulta: string) => ({
    matches: consulta.includes('min-width'),
    media: consulta,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

afterEach(() => {
  cleanup();
});
