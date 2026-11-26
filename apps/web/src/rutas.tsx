import { Navigate, type RouteObject } from 'react-router';

import { ProveedorAuth } from './auth/ProveedorAuth';
import { Permitido, RedirigirAlInicio, RutaProtegida, SoloAnonimo } from './auth/RutaProtegida';
import { PaginaVacia } from './componentes/PaginaVacia';
import { PrimeraOpcionPermitida } from './componentes/PrimeraOpcionPermitida';
import { SinPermiso } from './componentes/SinPermiso';
import { LayoutAdministrador } from './layouts/LayoutAdministrador';
import { LayoutMedico } from './layouts/LayoutMedico';
import {
  OPCIONES_ADMINISTRADOR,
  OPCIONES_MEDICO,
  type OpcionNavegacion,
} from './layouts/navegacion';
import { Inicio } from './paginas/Inicio';
import { Login } from './paginas/Login';

function rutasDeOpciones(opciones: readonly OpcionNavegacion[]): RouteObject[] {
  return opciones.map(({ ruta, titulo, permiso }) => ({
    path: ruta,
    element: (
      <Permitido permiso={permiso} sinPermiso={<SinPermiso />}>
        <PaginaVacia titulo={titulo} />
      </Permitido>
    ),
  }));
}

export const rutas: RouteObject[] = [
  {
    element: <ProveedorAuth />,
    children: [
      {
        path: '/login',
        element: (
          <SoloAnonimo>
            <Login />
          </SoloAnonimo>
        ),
      },
      // Estado de la API y la base (página de diagnóstico, pública)
      { path: '/estado', element: <Inicio /> },
      {
        element: <RutaProtegida />,
        children: [
          { path: '/', element: <RedirigirAlInicio /> },
          {
            path: '/admin',
            element: (
              <RutaProtegida roles={['administrador']}>
                <LayoutAdministrador />
              </RutaProtegida>
            ),
            children: [
              {
                index: true,
                element: <PrimeraOpcionPermitida opciones={OPCIONES_ADMINISTRADOR} />,
              },
              ...rutasDeOpciones(OPCIONES_ADMINISTRADOR),
            ],
          },
          {
            path: '/medico',
            element: (
              <RutaProtegida roles={['medico_ocupacional', 'apoyo']}>
                <LayoutMedico />
              </RutaProtegida>
            ),
            children: [
              { index: true, element: <PrimeraOpcionPermitida opciones={OPCIONES_MEDICO} /> },
              ...rutasDeOpciones(OPCIONES_MEDICO),
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
