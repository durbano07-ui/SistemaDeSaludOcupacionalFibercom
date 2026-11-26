import { Logout, Settings, Switcher } from '@carbon/icons-react';
import { Header, HeaderGlobalAction, HeaderGlobalBar } from '@carbon/react';
import { useState } from 'react';
import { Outlet } from 'react-router';

import { useAuth } from '../auth/useAuth';
import { Logo } from '../componentes/Logo';
import { PanelPerfil } from '../componentes/PanelPerfil';

/** Layout del médico; el personal de apoyo lo usa viendo solo lo que sus permisos permiten. */
export function LayoutMedico() {
  const { cerrarSesion } = useAuth();
  const [saliendo, setSaliendo] = useState(false);

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

      <main className="smo-medico-contenido">
        <Outlet />
      </main>
    </>
  );
}
