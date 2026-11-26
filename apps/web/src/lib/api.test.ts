import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { problema, sesionDe, simularApi, USUARIO_MEDICO } from '../test/renderizar';
import { alExpirarSesion, ErrorApi, establecerAccessToken, obtenerAccessToken, pedir } from './api';

const datosSchema = z.object({ ok: z.boolean() });

afterEach(() => {
  vi.unstubAllGlobals();
  establecerAccessToken(null);
  alExpirarSesion(null);
});

describe('cliente de la API', () => {
  it('envía el access token en Authorization', async () => {
    establecerAccessToken('token-1');
    const fetchSimulado = simularApi({ '/api/v1/datos': () => Response.json({ ok: true }) });

    await pedir('/datos', datosSchema);

    const cabeceras = fetchSimulado.mock.calls[0]?.[1]?.headers as Headers;
    expect(cabeceras.get('Authorization')).toBe('Bearer token-1');
  });

  it('ante varios 401 a la vez hace UNA sola renovación y reintenta todas', async () => {
    establecerAccessToken('vencido');
    const fetchSimulado = simularApi({
      '/api/v1/datos': (init) =>
        new Headers(init?.headers).get('Authorization') === 'Bearer nuevo'
          ? Response.json({ ok: true })
          : problema(401, 'Vencido'),
      'POST /api/v1/auth/refresh': () => sesionDe(USUARIO_MEDICO, 'nuevo'),
    });

    const resultados = await Promise.all([
      pedir('/datos', datosSchema),
      pedir('/datos', datosSchema),
      pedir('/datos', datosSchema),
    ]);

    expect(resultados).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    const renovaciones = fetchSimulado.mock.calls.filter(([url]) => url === '/api/v1/auth/refresh');
    expect(renovaciones).toHaveLength(1);
    expect(obtenerAccessToken()).toBe('nuevo');
  });

  it('si la renovación falla avisa que la sesión expiró y lanza el 401', async () => {
    establecerAccessToken('vencido');
    const alExpirar = vi.fn();
    alExpirarSesion(alExpirar);
    simularApi({
      '/api/v1/datos': () => problema(401, 'Vencido'),
      'POST /api/v1/auth/refresh': () => problema(401, 'Sin sesión'),
    });

    await expect(pedir('/datos', datosSchema)).rejects.toBeInstanceOf(ErrorApi);
    expect(alExpirar).toHaveBeenCalledOnce();
    expect(obtenerAccessToken()).toBeNull();
  });

  it('no intenta renovar cuando el 401 viene de /auth (credenciales incorrectas)', async () => {
    const fetchSimulado = simularApi({
      'POST /api/v1/auth/login': () =>
        problema(401, 'Usuario o contraseña incorrectos', { intentosRestantes: 2 }),
    });

    const error = await pedir('/auth/login', datosSchema, { method: 'POST' }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).extensiones).toEqual({ intentosRestantes: 2 });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });
});
