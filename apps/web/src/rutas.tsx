import { Navigate, type RouteObject } from 'react-router';

import { PaginaVacia } from './componentes/PaginaVacia';
import { LayoutAdministrador } from './layouts/LayoutAdministrador';
import { LayoutMedico } from './layouts/LayoutMedico';
import { OPCIONES_ADMINISTRADOR, OPCIONES_MEDICO } from './layouts/navegacion';
import { Inicio } from './paginas/Inicio';

export const rutas: RouteObject[] = [
  { path: '/', element: <Inicio /> },
  {
    path: '/admin',
    element: <LayoutAdministrador />,
    children: [
      { index: true, element: <Navigate to="estadisticas" replace /> },
      ...OPCIONES_ADMINISTRADOR.map(({ ruta, titulo }) => ({
        path: ruta,
        element: <PaginaVacia titulo={titulo} />,
      })),
    ],
  },
  {
    path: '/medico',
    element: <LayoutMedico />,
    children: [
      { index: true, element: <Navigate to="pacientes" replace /> },
      ...OPCIONES_MEDICO.map(({ ruta, titulo }) => ({
        path: ruta,
        element: <PaginaVacia titulo={titulo} />,
      })),
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
