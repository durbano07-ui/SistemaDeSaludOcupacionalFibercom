import {
  Analytics,
  Building,
  DataBase,
  Document,
  Enterprise,
  Meter,
  Report,
  User,
  UserMultiple,
} from '@carbon/icons-react';

/** Opciones de la navegación lateral del administrador. */
export const OPCIONES_ADMINISTRADOR = [
  { ruta: 'estadisticas', titulo: 'Estadísticas', icono: Analytics },
  { ruta: 'usuarios', titulo: 'Usuarios', icono: User },
  { ruta: 'departamentos-cargos', titulo: 'Departamentos y cargos', icono: Enterprise },
  { ruta: 'bases', titulo: 'Bases', icono: Building },
  { ruta: 'rendimiento', titulo: 'Rendimiento', icono: Meter },
  { ruta: 'base-datos', titulo: 'Base de datos', icono: DataBase },
  { ruta: 'logs', titulo: 'Logs', icono: Document },
] as const;

/** Opciones de la navegación superior del médico. */
export const OPCIONES_MEDICO = [
  { ruta: 'pacientes', titulo: 'Pacientes', icono: UserMultiple },
  { ruta: 'reportes', titulo: 'Reportes', icono: Report },
] as const;
