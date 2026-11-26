import {
  Analytics,
  Building,
  DataBase,
  Document,
  Enterprise,
  Meter,
  User,
} from '@carbon/icons-react';
import type { CodigoPermiso } from '@smo/shared';

/** Opción de navegación; solo se muestra a quien tiene `permiso`. */
export interface OpcionNavegacion {
  ruta: string;
  titulo: string;
  icono: typeof Analytics;
  permiso: CodigoPermiso;
}

/** Opciones de la navegación lateral del administrador. */
export const OPCIONES_ADMINISTRADOR = [
  { ruta: 'estadisticas', titulo: 'Estadísticas', icono: Analytics, permiso: 'supervision' },
  { ruta: 'usuarios', titulo: 'Usuarios', icono: User, permiso: 'usuarios' },
  {
    ruta: 'departamentos-cargos',
    titulo: 'Departamentos y cargos',
    icono: Enterprise,
    permiso: 'usuarios',
  },
  { ruta: 'bases', titulo: 'Bases', icono: Building, permiso: 'usuarios' },
  { ruta: 'rendimiento', titulo: 'Rendimiento', icono: Meter, permiso: 'supervision' },
  { ruta: 'base-datos', titulo: 'Base de datos', icono: DataBase, permiso: 'base_datos' },
  { ruta: 'logs', titulo: 'Logs', icono: Document, permiso: 'supervision' },
] as const satisfies readonly OpcionNavegacion[];
