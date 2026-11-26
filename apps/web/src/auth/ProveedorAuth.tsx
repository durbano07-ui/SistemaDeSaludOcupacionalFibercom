import { type DatosLogin, respuestaLoginSchema, type UsuarioAutenticado } from '@smo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';

import {
  alExpirarSesion,
  enviar,
  establecerAccessToken,
  pedirSinRespuesta,
  renovarSesion,
} from '../lib/api';
import { ContextoAuth, type EstadoSesion, type ValorAuth } from './contexto';

/**
 * Estado de la sesión. Al cargar la app intenta recuperar la sesión con /auth/refresh
 * (la cookie HttpOnly); el access token queda solo en memoria.
 */
export function ProveedorAuth() {
  const navegar = useNavigate();
  const clienteConsultas = useQueryClient();
  const [sesion, setSesion] = useState<EstadoSesion>({ estado: 'cargando' });

  useEffect(() => {
    let vigente = true;
    void renovarSesion().then((recuperada) => {
      if (!vigente) return;
      setSesion(
        recuperada ? { estado: 'autenticado', usuario: recuperada.usuario } : { estado: 'anonimo' },
      );
    });
    return () => {
      vigente = false;
    };
  }, []);

  const terminar = useCallback(() => {
    establecerAccessToken(null);
    clienteConsultas.clear();
    setSesion({ estado: 'anonimo' });
    void navegar('/login', { replace: true });
  }, [clienteConsultas, navegar]);

  useEffect(() => {
    alExpirarSesion(terminar);
    return () => alExpirarSesion(null);
  }, [terminar]);

  const iniciarSesion = useCallback(async (datos: DatosLogin): Promise<UsuarioAutenticado> => {
    const respuesta = await enviar('/auth/login', respuestaLoginSchema, datos);
    establecerAccessToken(respuesta.accessToken);
    setSesion({ estado: 'autenticado', usuario: respuesta.usuario });
    return respuesta.usuario;
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await pedirSinRespuesta('/auth/logout', { method: 'POST' });
    } catch {
      // Aunque la API no responda, la sesión local se cierra igual.
    }
    terminar();
  }, [terminar]);

  const valor = useMemo<ValorAuth>(
    () => ({
      sesion,
      usuario: sesion.estado === 'autenticado' ? sesion.usuario : null,
      iniciarSesion,
      cerrarSesion,
    }),
    [sesion, iniciarSesion, cerrarSesion],
  );

  return (
    <ContextoAuth.Provider value={valor}>
      <Outlet />
    </ContextoAuth.Provider>
  );
}
