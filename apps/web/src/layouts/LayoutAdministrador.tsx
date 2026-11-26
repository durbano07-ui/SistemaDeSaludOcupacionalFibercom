import { Settings } from '@carbon/icons-react';
import {
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  SideNav,
  SideNavItems,
  SideNavLink,
} from '@carbon/react';
import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../auth/useAuth';
import { Logo } from '../componentes/Logo';
import { PanelPerfil } from '../componentes/PanelPerfil';
import { OPCIONES_ADMINISTRADOR } from './navegacion';

export function LayoutAdministrador() {
  const { usuario } = useAuth();
  const opciones = OPCIONES_ADMINISTRADOR.filter(({ permiso }) =>
    usuario?.permisos.includes(permiso),
  );

  return (
    <>
      <Header aria-label="Administración" className="smo-encabezado">
        <Logo inicio="/admin" />
        <HeaderGlobalBar>
          <HeaderGlobalAction aria-label="Configuración" tooltipAlignment="end">
            <Settings size={20} />
          </HeaderGlobalAction>
          <PanelPerfil />
        </HeaderGlobalBar>
      </Header>

      <SideNav
        aria-label="Navegación del administrador"
        className="smo-nav-lateral"
        isFixedNav
        expanded
        isChildOfHeader={false}
      >
        <SideNavItems>
          {opciones.map(({ ruta, titulo, icono }) => (
            <SideNavLink key={ruta} as={NavLink} to={`/admin/${ruta}`} renderIcon={icono}>
              {titulo}
            </SideNavLink>
          ))}
        </SideNavItems>
      </SideNav>

      <main className="smo-contenido-admin">
        <Outlet />
      </main>
    </>
  );
}
