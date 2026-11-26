import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { UsuarioPeticion } from '../auth.types.js';

/** Petición de Express con el usuario que agrega JwtAuthGuard. */
export type PeticionAutenticada = Request & { usuario?: UsuarioPeticion };

/** Inyecta `{ idUsuario, idSesion, rol, permisos }` del usuario autenticado. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioPeticion => {
    const usuario = contexto.switchToHttp().getRequest<PeticionAutenticada>().usuario;
    if (!usuario) {
      throw new Error('@UsuarioActual() se usó en una ruta @Publico() o sin JwtAuthGuard');
    }
    return usuario;
  },
);
