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

// jsdom tampoco implementa ResizeObserver (lo usan las pestañas y los ComboBox de Carbon).
class ResizeObserverSimulado {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverSimulado as unknown as typeof ResizeObserver;

// ni scrollIntoView (lo usa la lista desplegable del ComboBox).
Element.prototype.scrollIntoView ??= vi.fn();

afterEach(() => {
  cleanup();
});
