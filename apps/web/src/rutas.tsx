import { type ReactNode, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router';

import { ProveedorAuth } from './auth/ProveedorAuth';
import { Permitido, RedirigirAlInicio, RutaProtegida, SoloAnonimo } from './auth/RutaProtegida';
import { CargandoPagina } from './componentes/CargandoPagina';
import { PaginaVacia } from './componentes/PaginaVacia';
import { PrimeraOpcionPermitida } from './componentes/PrimeraOpcionPermitida';
import { SinPermiso } from './componentes/SinPermiso';
import { LayoutAdministrador } from './layouts/LayoutAdministrador';
import { LayoutMedico } from './layouts/LayoutMedico';
import { OPCIONES_ADMINISTRADOR, type OpcionNavegacion } from './layouts/navegacion';
import { PantallaMedico } from './medico/PantallaMedico';
import { Inicio } from './paginas/Inicio';
import { Login } from './paginas/Login';
import { PaginaEstadisticas, PantallaReportes } from './paginas-perezosas';

/** Páginas del administrador ya construidas; el resto todavía es una página vacía. */
const PAGINAS_ADMIN: Record<string, ReactNode> = {
  estadisticas: <PaginaEstadisticas />,
};

function rutasDeOpciones(opciones: readonly OpcionNavegacion[]): RouteObject[] {
  return opciones.map(({ ruta, titulo, permiso }) => ({
    path: ruta,
    element: (
      <Permitido permiso={permiso} sinPermiso={<SinPermiso />}>
        <Suspense fallback={<CargandoPagina />}>
          {PAGINAS_ADMIN[ruta] ?? <PaginaVacia titulo={titulo} />}
        </Suspense>
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
              { index: true, element: <PantallaMedico /> },
              {
                path: 'reportes',
                element: (
                  <Permitido permiso="reportes" sinPermiso={<SinPermiso />}>
                    <Suspense fallback={<CargandoPagina />}>
                      <PantallaReportes />
                    </Suspense>
                  </Permitido>
                ),
              },
              // Enlaces anteriores (/medico/pacientes, /medico/reportes) llevan a la pantalla única
              { path: '*', element: <Navigate to="/medico" replace /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
