import { Settings, UserAvatar } from '@carbon/icons-react';
import {
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  SideNav,
  SideNavItems,
  SideNavLink,
} from '@carbon/react';
import { NavLink, Outlet } from 'react-router';

import { Logo } from '../componentes/Logo';
import { OPCIONES_ADMINISTRADOR } from './navegacion';

export function LayoutAdministrador() {
  return (
    <>
      <Header aria-label="Administración" className="smo-encabezado">
        <Logo inicio="/admin" />
        <HeaderGlobalBar>
          <HeaderGlobalAction aria-label="Configuración" tooltipAlignment="end">
            <Settings size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction aria-label="Perfil" tooltipAlignment="end">
            <UserAvatar size={20} />
          </HeaderGlobalAction>
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
          {OPCIONES_ADMINISTRADOR.map(({ ruta, titulo, icono }) => (
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
