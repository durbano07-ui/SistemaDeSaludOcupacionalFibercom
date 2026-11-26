import { lazy } from 'react';

// Pantallas con gráficos: se cargan de forma perezosa (junto con la librería de gráficos).
export const PantallaReportes = lazy(() => import('./reportes/PantallaReportes'));
export const PaginaEstadisticas = lazy(() => import('./admin/PaginaEstadisticas'));
