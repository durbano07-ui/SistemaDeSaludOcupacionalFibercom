import { Logout, UserAvatar } from '@carbon/icons-react';
import { Button, HeaderGlobalAction, HeaderPanel } from '@carbon/react';
import { useState } from 'react';

import { useAuth } from '../auth/useAuth';

/** Botón "Perfil" del encabezado con un panel que muestra el usuario y "Cerrar sesión". */
export function PanelPerfil() {
  const { usuario, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  return (
    <>
      <HeaderGlobalAction
        aria-label="Perfil"
        aria-expanded={abierto}
        isActive={abierto}
        tooltipAlignment="end"
        onClick={() => setAbierto((valor) => !valor)}
      >
        <UserAvatar size={20} />
      </HeaderGlobalAction>
      <HeaderPanel
        aria-label="Perfil del usuario"
        expanded={abierto}
        onHeaderPanelFocus={() => setAbierto(false)}
        className="smo-perfil"
      >
        {abierto && usuario && (
          <div className="smo-perfil__contenido">
            <UserAvatar size={32} aria-hidden="true" />
            <p className="smo-perfil__nombre">
              {usuario.nombres} {usuario.apellidos}
            </p>
            <p className="smo-perfil__rol">{usuario.rol.nombre}</p>
            <p className="smo-perfil__usuario">Usuario: {usuario.nombreUsuario}</p>
            <Button
              kind="tertiary"
              size="md"
              renderIcon={Logout}
              disabled={cerrando}
              onClick={() => {
                setCerrando(true);
                void cerrarSesion();
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        )}
      </HeaderPanel>
    </>
  );
}
