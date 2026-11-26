import type { UsuarioAutenticado } from '@smo/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';

import { establecerAccessToken } from '../lib/api';
import { rutas } from '../rutas';

export const USUARIO_ADMIN: UsuarioAutenticado = {
  id: 1,
  nombreUsuario: 'admin',
  nombres: 'Andrea Sofía',
  apellidos: 'Prueba Administradora',
  rol: { codigo: 'administrador', nombre: 'Administrador' },
  permisos: ['base_datos', 'catalogos', 'nomina', 'supervision', 'trabajadores', 'usuarios'],
};

export const USUARIO_MEDICO: UsuarioAutenticado = {
  id: 2,
  nombreUsuario: 'medico',
  nombres: 'Carlos Andrés',
  apellidos: 'Ficticio Médico',
  rol: { codigo: 'medico_ocupacional', nombre: 'Médico ocupacional' },
  permisos: [
    'atenciones',
    'catalogos',
    'datos_clinicos',
    'fichas_matrices',
    'historia_clinica',
    'reportes',
    'trabajadores',
  ],
};

/** Respuesta Problem Details (RFC 9457) como la que envía la API. */
export function problema(status: number, detail: string, extensiones: object = {}): Response {
  return Response.json(
    { type: 'about:blank', title: 'Error', status, detail, ...extensiones },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

/** Respuesta de login / refresh para un usuario. */
export function sesionDe(usuario: UsuarioAutenticado, accessToken = 'token.de.prueba'): Response {
  return Response.json({ accessToken, usuario });
}

type Manejador = (init?: RequestInit) => Response | Promise<Response>;

/**
 * Simula `fetch` por ruta. La clave es `"/api/v1/ruta"` o `"POST /api/v1/ruta"`.
 * Las rutas no simuladas responden 404.
 */
export function simularApi(respuestas: Record<string, Manejador>) {
  const simulado = vi.fn((url: string, init?: RequestInit) => {
    const manejador = respuestas[`${init?.method ?? 'GET'} ${url}`] ?? respuestas[url];
    return manejador
      ? Promise.resolve().then(() => manejador(init))
      : Promise.resolve(problema(404, `Sin simular: ${url}`));
  });
  vi.stubGlobal('fetch', simulado);
  return simulado;
}

interface OpcionesRender {
  /** Usuario con sesión (la recupera /auth/refresh al cargar); sin él, no hay sesión. */
  usuario?: UsuarioAutenticado;
  respuestas?: Record<string, Manejador>;
}

/** Renderiza la aplicación completa en la ruta indicada (para pruebas). */
export function renderizarEn(ruta: string, { usuario, respuestas = {} }: OpcionesRender = {}) {
  establecerAccessToken(null);
  const fetchSimulado = simularApi({
    'POST /api/v1/auth/refresh': () =>
      usuario ? sesionDe(usuario) : problema(401, 'La sesión no es válida o ya venció.'),
    'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
    ...respuestas,
  });
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    router,
    fetchSimulado,
    ...render(
      <QueryClientProvider client={cliente}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}
