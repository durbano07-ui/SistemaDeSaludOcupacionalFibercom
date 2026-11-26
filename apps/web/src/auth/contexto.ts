import type { CodigoRol, DatosLogin, UsuarioAutenticado } from '@smo/shared';
import { createContext } from 'react';

export type EstadoSesion =
  | { estado: 'cargando' }
  | { estado: 'anonimo' }
  | { estado: 'autenticado'; usuario: UsuarioAutenticado };

export interface ValorAuth {
  sesion: EstadoSesion;
  /** Usuario autenticado, o `null` si no hay sesión (o todavía se está recuperando). */
  usuario: UsuarioAutenticado | null;
  iniciarSesion: (datos: DatosLogin) => Promise<UsuarioAutenticado>;
  cerrarSesion: () => Promise<void>;
}

export const ContextoAuth = createContext<ValorAuth | null>(null);

/** Página de inicio de cada rol (el rol apoyo usa el layout del médico). */
export function inicioDeRol(rol: CodigoRol): string {
  return rol === 'administrador' ? '/admin' : '/medico';
}
