import type { CodigoPermiso } from '@smo/shared';
import { useContext } from 'react';

import { ContextoAuth, type ValorAuth } from './contexto';

/** Estado de la sesión y acciones de login / logout. */
export function useAuth(): ValorAuth {
  const valor = useContext(ContextoAuth);
  if (!valor) throw new Error('useAuth() debe usarse dentro de <ProveedorAuth>');
  return valor;
}

/** `true` si el usuario actual tiene el permiso (del rol o extra). */
export function usePermiso(permiso: CodigoPermiso): boolean {
  return useAuth().usuario?.permisos.includes(permiso) ?? false;
}
