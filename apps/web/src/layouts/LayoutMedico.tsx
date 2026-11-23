import { Logout, Settings, Switcher, UserAvatar, UserProfile } from '@carbon/icons-react';
import { Header, HeaderGlobalAction, HeaderGlobalBar, Tile } from '@carbon/react';
import { NavLink, Outlet } from 'react-router';

import { Logo } from '../componentes/Logo';
import { OPCIONES_MEDICO } from './navegacion';

export function LayoutMedico() {
  return (
    <>
      <Header aria-label="Consultorio médico" className="smo-encabezado">
        <Logo inicio="/medico" />
        <HeaderGlobalBar>
          <HeaderGlobalAction aria-label="Otras funciones" tooltipAlignment="end">
            <Switcher size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction aria-label="Configuración" tooltipAlignment="end">
            <Settings size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction aria-label="Perfil" tooltipAlignment="end">
            <UserAvatar size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction aria-label="Salir" tooltipAlignment="end">
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>

      <nav aria-label="Navegación del médico" className="smo-nav-superior">
        {OPCIONES_MEDICO.map(({ ruta, titulo, icono: Icono }) => (
          <NavLink key={ruta} to={`/medico/${ruta}`} className="smo-nav-superior__enlace">
            <Icono size={16} aria-hidden="true" />
            {titulo}
          </NavLink>
        ))}
      </nav>

      <div className="smo-medico">
        <aside aria-label="Paciente seleccionado">
          <Tile className="smo-medico__paciente">
            <UserProfile size={32} aria-hidden="true" />
            <p>No se ha seleccionado ningún paciente</p>
          </Tile>
        </aside>
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}
