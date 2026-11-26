import { Loading } from '@carbon/react';
import type { CodigoPermiso, CodigoRol } from '@smo/shared';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { inicioDeRol } from './contexto';
import { useAuth, usePermiso } from './useAuth';

function CargandoSesion() {
  return (
    <div className="smo-cargando-sesion">
      <Loading withOverlay={false} description="Recuperando la sesión…" />
    </div>
  );
}

interface RutaProtegidaProps {
  /** Roles que pueden entrar; si no se indica, basta con tener sesión. */
  roles?: readonly CodigoRol[];
  children?: ReactNode;
}

/** Sin sesión → /login. Con un rol que no corresponde → al inicio de su rol. */
export function RutaProtegida({ roles, children }: RutaProtegidaProps) {
  const { sesion } = useAuth();
  const ubicacion = useLocation();

  if (sesion.estado === 'cargando') return <CargandoSesion />;
  if (sesion.estado === 'anonimo') {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }
  if (roles && !roles.includes(sesion.usuario.rol.codigo)) {
    return <Navigate to={inicioDeRol(sesion.usuario.rol.codigo)} replace />;
  }
  return children ?? <Outlet />;
}

/** Solo sin sesión (pantalla de login): con sesión, va al inicio de su rol. */
export function SoloAnonimo({ children }: { children: ReactNode }) {
  const { sesion } = useAuth();
  if (sesion.estado === 'cargando') return <CargandoSesion />;
  if (sesion.estado === 'autenticado') {
    return <Navigate to={inicioDeRol(sesion.usuario.rol.codigo)} replace />;
  }
  return children;
}

/** Al entrar a `/`: lleva al inicio del rol del usuario. */
export function RedirigirAlInicio() {
  const { usuario } = useAuth();
  return <Navigate to={usuario ? inicioDeRol(usuario.rol.codigo) : '/login'} replace />;
}

interface PermitidoProps {
  permiso: CodigoPermiso;
  children: ReactNode;
  /** Lo que se muestra sin el permiso (por defecto, nada). */
  sinPermiso?: ReactNode;
}

/** Muestra su contenido solo si el usuario tiene el permiso. */
export function Permitido({ permiso, children, sinPermiso = null }: PermitidoProps) {
  return usePermiso(permiso) ? children : sinPermiso;
}
