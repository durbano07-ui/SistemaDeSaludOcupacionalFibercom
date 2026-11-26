import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  type DatosLogin,
  loginSchema,
  type Perfil,
  perfilSchema,
  type RespuestaLogin,
  respuestaLoginSchema,
} from '@smo/shared';
import type { Request, Response } from 'express';

import { esquemaOpenApi } from '../../common/openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ENTORNO, type Entorno } from '../../config/entorno.js';
import { AuthService, type SesionEmitida } from './auth.service.js';
import type { UsuarioPeticion } from './auth.types.js';
import { Publico } from './decoradores/publico.decorator.js';
import { UsuarioActual } from './decoradores/usuario-actual.decorator.js';
import { tokenBearer } from './guards/jwt-auth.guard.js';
import { COOKIE_RENOVACION, RUTA_COOKIE_RENOVACION } from './token-renovacion.js';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  @Publico()
  @UseGuards(ThrottlerGuard)
  @Throttle({ login: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicia sesión',
    description:
      'Devuelve el access token (15 min) y deja el refresh token en una cookie HttpOnly. ' +
      '401 con `intentosRestantes`; 423 con `bloqueadoHasta`; 429 tras 10 intentos por minuto.',
  })
  @ApiBody({ schema: esquemaOpenApi(loginSchema) })
  @ApiOkResponse({ schema: esquemaOpenApi(respuestaLoginSchema) })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) datos: DatosLogin,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<RespuestaLogin> {
    return this.emitir(await this.authService.login(datos), respuesta);
  }

  @Publico()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(COOKIE_RENOVACION)
  @ApiOperation({ summary: 'Renueva el access token y rota el refresh token (cookie)' })
  @ApiOkResponse({ schema: esquemaOpenApi(respuestaLoginSchema) })
  async renovar(
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<RespuestaLogin> {
    try {
      return this.emitir(await this.authService.renovar(this.cookie(peticion)), respuesta);
    } catch (error) {
      if (error instanceof UnauthorizedException) this.borrarCookie(respuesta);
      throw error;
    }
  }

  @Publico()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cierra la sesión (idempotente)' })
  @ApiNoContentResponse({ description: 'Sesión cerrada (o no había sesión que cerrar).' })
  async cerrarSesion(
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<void> {
    await this.authService.cerrarSesion(
      this.cookie(peticion),
      tokenBearer(peticion.headers.authorization),
    );
    this.borrarCookie(respuesta);
  }

  @Get('perfil')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario actual con su rol y permisos efectivos' })
  @ApiOkResponse({ schema: esquemaOpenApi(perfilSchema) })
  perfil(@UsuarioActual() usuario: UsuarioPeticion): Promise<Perfil> {
    return this.authService.perfil(usuario.idUsuario);
  }

  private cookie(peticion: Request): unknown {
    return (peticion.cookies as Record<string, unknown> | undefined)?.[COOKIE_RENOVACION];
  }

  private opcionesCookie() {
    return {
      httpOnly: true,
      secure: this.entorno.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: RUTA_COOKIE_RENOVACION,
    };
  }

  private emitir(sesion: SesionEmitida, respuesta: Response): RespuestaLogin {
    respuesta.cookie(COOKIE_RENOVACION, sesion.tokenRenovacion, {
      ...this.opcionesCookie(),
      expires: sesion.renovacionExpira,
    });
    respuesta.setHeader('Cache-Control', 'no-store');
    return sesion.respuesta;
  }

  private borrarCookie(respuesta: Response): void {
    respuesta.clearCookie(COOKIE_RENOVACION, this.opcionesCookie());
  }
}
