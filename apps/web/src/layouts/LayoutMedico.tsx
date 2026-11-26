import { Logout, Settings, Switcher, UserProfile } from '@carbon/icons-react';
import { Header, HeaderGlobalAction, HeaderGlobalBar, Tile } from '@carbon/react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';

import { useAuth } from '../auth/useAuth';
import { Logo } from '../componentes/Logo';
import { PanelPerfil } from '../componentes/PanelPerfil';
import { OPCIONES_MEDICO } from './navegacion';

/** Layout del médico; el personal de apoyo lo usa viendo solo lo que sus permisos permiten. */
export function LayoutMedico() {
  const { usuario, cerrarSesion } = useAuth();
  const [saliendo, setSaliendo] = useState(false);
  const opciones = OPCIONES_MEDICO.filter(({ permiso }) => usuario?.permisos.includes(permiso));
  const veDatosClinicos = usuario?.permisos.includes('datos_clinicos') ?? false;

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
          <PanelPerfil />
          <HeaderGlobalAction
            aria-label="Salir"
            tooltipAlignment="end"
            onClick={() => {
              if (saliendo) return;
              setSaliendo(true);
              void cerrarSesion();
            }}
          >
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>

      <nav aria-label="Navegación del médico" className="smo-nav-superior">
        {opciones.map(({ ruta, titulo, icono: Icono }) => (
          <NavLink key={ruta} to={`/medico/${ruta}`} className="smo-nav-superior__enlace">
            <Icono size={16} aria-hidden="true" />
            {titulo}
          </NavLink>
        ))}
      </nav>

      <div className={veDatosClinicos ? 'smo-medico' : 'smo-medico smo-medico--sin-paciente'}>
        {veDatosClinicos && (
          <aside aria-label="Paciente seleccionado">
            <Tile className="smo-medico__paciente">
              <UserProfile size={32} aria-hidden="true" />
              <p>No se ha seleccionado ningún paciente</p>
            </Tile>
          </aside>
        )}
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}
