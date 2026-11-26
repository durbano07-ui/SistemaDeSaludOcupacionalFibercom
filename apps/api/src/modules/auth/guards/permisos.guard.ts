import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CodigoPermiso } from '@smo/shared';

import { PERMISOS_REQUERIDOS } from '../decoradores/requiere-permiso.decorator.js';
import type { PeticionAutenticada } from '../decoradores/usuario-actual.decorator.js';

/**
 * Guard global (después de JwtAuthGuard): si la ruta tiene @RequierePermiso(...), el usuario
 * debe tener todos esos permisos efectivos. Usa los permisos ya calculados en `req.usuario`.
 */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<CodigoPermiso[] | undefined>(
      PERMISOS_REQUERIDOS,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (!requeridos?.length) return true;

    const usuario = contexto.switchToHttp().getRequest<PeticionAutenticada>().usuario;
    const faltan = requeridos.filter((permiso) => !usuario?.permisos.includes(permiso));
    if (faltan.length > 0) {
      throw new ForbiddenException({
        message: 'No tienes permiso para realizar esta acción.',
        permisosFaltantes: faltan,
      });
    }
    return true;
  }
}
