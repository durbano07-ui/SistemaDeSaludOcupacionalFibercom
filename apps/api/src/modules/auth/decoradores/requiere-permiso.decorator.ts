import { SetMetadata } from '@nestjs/common';
import type { CodigoPermiso } from '@smo/shared';

export const PERMISOS_REQUERIDOS = 'smo:permisos-requeridos';

/**
 * Exige que el usuario tenga TODOS los permisos indicados (permisos del rol ∪ permisos extra).
 * Se puede poner en el controlador o en cada método; el del método reemplaza al del controlador.
 * Ejemplo: `@RequierePermiso('datos_clinicos')` sobre un `@Get()`.
 */
export const RequierePermiso = (...permisos: [CodigoPermiso, ...CodigoPermiso[]]) =>
  SetMetadata(PERMISOS_REQUERIDOS, permisos);
