import { QueryClient } from '@tanstack/react-query';

/** Cliente de TanStack Query con los valores por defecto del sistema. */
export function crearClienteConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
