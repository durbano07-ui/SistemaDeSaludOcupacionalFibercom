import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { rutas } from '../rutas';

/** Renderiza la aplicación completa en la ruta indicada (para pruebas). */
export function renderizarEn(ruta: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    router,
    ...render(
      <QueryClientProvider client={cliente}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}
