import { Navigate } from 'react-router';

import { useAuth } from '../auth/useAuth';
import type { OpcionNavegacion } from '../layouts/navegacion';
import { SinPermiso } from './SinPermiso';

/** Lleva a la primera opción a la que el usuario tiene permiso; si no tiene ninguna, avisa. */
export function PrimeraOpcionPermitida({ opciones }: { opciones: readonly OpcionNavegacion[] }) {
  const { usuario } = useAuth();
  const primera = opciones.find(({ permiso }) => usuario?.permisos.includes(permiso));
  return primera ? (
    <Navigate to={primera.ruta} replace />
  ) : (
    <SinPermiso mensaje="Todavía no tienes opciones habilitadas. Pide al administrador los permisos que necesitas." />
  );
}
