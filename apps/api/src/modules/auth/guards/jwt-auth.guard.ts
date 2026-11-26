import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { contextoActual } from '../../../common/contexto/contexto-peticion.js';
import { AuthService, MENSAJE_SESION_INVALIDA } from '../auth.service.js';
import { ES_PUBLICO } from '../decoradores/publico.decorator.js';
import type { PeticionAutenticada } from '../decoradores/usuario-actual.decorator.js';

/** Lee el token de `Authorization: Bearer <token>`. */
export function tokenBearer(cabecera: string | undefined): string | undefined {
  const [esquema, token] = cabecera?.split(' ') ?? [];
  return esquema?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Guard global: toda ruta exige un access token válido de una sesión abierta, salvo las
 * marcadas con @Publico(). Deja el usuario (con sus permisos efectivos) en `req.usuario`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionAutenticada>();
    const token = tokenBearer(peticion.headers.authorization);
    if (!token) throw new UnauthorizedException('Debes iniciar sesión para continuar.');

    const payload = await this.authService.verificarAccessToken(token);
    const usuario = payload ? await this.authService.usuarioDeSesion(payload) : null;
    if (!usuario) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);

    peticion.usuario = usuario;
    const contextoPeticion = contextoActual();
    if (contextoPeticion) {
      contextoPeticion.idUsuario = usuario.idUsuario;
      contextoPeticion.idSesion = usuario.idSesion;
    }
    return true;
  }
}
