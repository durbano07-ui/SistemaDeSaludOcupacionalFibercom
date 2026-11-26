import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CodigoRol, DatosLogin, Perfil, RespuestaLogin } from '@smo/shared';

import { contextoActual } from '../../common/contexto/contexto-peticion.js';
import { ENTORNO, type Entorno } from '../../config/entorno.js';
import type { MotivoCierreSesion } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { PayloadAccessToken, UsuarioPeticion } from './auth.types.js';
import { ContrasenasService } from './contrasenas.service.js';
import {
  aUsuarioAutenticado,
  permisosDe,
  rolDe,
  SELECCION_USUARIO_AUTENTICADO,
  type UsuarioConPermisos,
} from './permisos.js';
import { generarTokenRenovacion, leerTokenRenovacion } from './token-renovacion.js';

const MODULO = 'auth';
export const MENSAJE_CREDENCIALES = 'Usuario o contraseña incorrectos';
export const MENSAJE_SESION_INVALIDA =
  'La sesión no es válida o ya venció. Inicia sesión de nuevo.';

/** Resultado de un login o una renovación: la respuesta y el refresh token para la cookie. */
export interface SesionEmitida {
  respuesta: RespuestaLogin;
  tokenRenovacion: string;
  renovacionExpira: Date;
}

const MS_POR_MINUTO = 60_000;
const MS_POR_DIA = 86_400_000;

@Injectable()
export class AuthService {
  private readonly formatoHora: Intl.DateTimeFormat;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditoria: AuditoriaService,
    private readonly contrasenas: ContrasenasService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {
    this.formatoHora = new Intl.DateTimeFormat('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: entorno.TZ,
    });
  }

  // ---------------------------------------------------------------- login

  async login(datos: DatosLogin): Promise<SesionEmitida> {
    const ahora = new Date();
    // La colación de la columna (utf8mb4_uca1400_ai_ci) ya compara sin distinguir mayúsculas.
    const usuario = await this.prisma.usuario.findUnique({
      where: { nombreUsuario: datos.usuario },
      select: {
        ...SELECCION_USUARIO_AUTENTICADO,
        contrasenaHash: true,
        intentosFallidos: true,
        bloqueadoHasta: true,
      },
    });
    const rol = usuario ? rolDe(usuario) : null;

    // Inexistente, inactivo o sin rol: misma respuesta, y se gasta el mismo tiempo en argon2.
    if (!usuario?.contrasenaHash || usuario.estado !== 'activo' || !rol) {
      await this.contrasenas.verificarFicticio(datos.contrasena);
      await this.auditoria.registrar({
        accion: 'login_fallido',
        modulo: MODULO,
        idUsuario: usuario?.idUsuario,
        usuarioIntentado: usuario ? undefined : datos.usuario,
        descripcion: usuario ? 'Cuenta inactiva o sin rol' : 'Usuario inexistente',
      });
      throw new UnauthorizedException(MENSAJE_CREDENCIALES);
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
      await this.auditoria.registrar({
        accion: 'login_fallido',
        modulo: MODULO,
        idUsuario: usuario.idUsuario,
        descripcion: 'Intento con la cuenta bloqueada',
      });
      throw this.cuentaBloqueada(usuario.bloqueadoHasta);
    }

    const correcta = await this.contrasenas.verificar(usuario.contrasenaHash, datos.contrasena);
    if (!correcta) {
      // Si había un bloqueo ya vencido, los intentos vuelven a contar desde cero.
      return this.registrarIntentoFallido(
        usuario.idUsuario,
        usuario.bloqueadoHasta !== null,
        ahora,
      );
    }

    await this.prisma.usuario.update({
      where: { idUsuario: usuario.idUsuario },
      data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: ahora },
    });
    return this.abrirSesion(usuario, rol, ahora);
  }

  private async registrarIntentoFallido(
    idUsuario: number,
    bloqueoVencido: boolean,
    ahora: Date,
  ): Promise<never> {
    const { intentosFallidos } = await this.prisma.usuario.update({
      where: { idUsuario },
      data: bloqueoVencido
        ? { intentosFallidos: 1, bloqueadoHasta: null }
        : { intentosFallidos: { increment: 1 } },
      select: { intentosFallidos: true },
    });

    await this.auditoria.registrar({
      accion: 'login_fallido',
      modulo: MODULO,
      idUsuario,
      descripcion: `Contraseña incorrecta (intento ${intentosFallidos} de ${this.entorno.MAX_INTENTOS})`,
    });

    if (intentosFallidos < this.entorno.MAX_INTENTOS) {
      throw new UnauthorizedException({
        message: MENSAJE_CREDENCIALES,
        intentosRestantes: this.entorno.MAX_INTENTOS - intentosFallidos,
      });
    }

    const bloqueadoHasta = new Date(ahora.getTime() + this.entorno.BLOQUEO_MINUTOS * MS_POR_MINUTO);
    await this.prisma.usuario.update({ where: { idUsuario }, data: { bloqueadoHasta } });
    await this.auditoria.registrar({
      accion: 'cuenta_bloqueada',
      modulo: MODULO,
      idUsuario,
      descripcion: `Bloqueada ${this.entorno.BLOQUEO_MINUTOS} minutos tras ${intentosFallidos} intentos fallidos`,
    });
    throw this.cuentaBloqueada(bloqueadoHasta);
  }

  private cuentaBloqueada(hasta: Date): HttpException {
    return new HttpException(
      {
        message: `Cuenta bloqueada. Podrás intentarlo de nuevo a las ${this.formatoHora.format(hasta)}.`,
        bloqueadoHasta: hasta.toISOString(),
      },
      HttpStatus.LOCKED,
    );
  }

  private async abrirSesion(
    usuario: UsuarioConPermisos,
    rol: CodigoRol,
    ahora: Date,
  ): Promise<SesionEmitida> {
    const contexto = contextoActual();
    const renovacionExpira = new Date(
      ahora.getTime() + this.entorno.REFRESH_EXPIRES_DAYS * MS_POR_DIA,
    );
    const { idSesion } = await this.prisma.sesion.create({
      data: {
        idUsuario: usuario.idUsuario,
        inicio: ahora,
        ultimaActividad: ahora,
        ip: contexto?.ip ?? 'desconocida',
        agenteUsuario: contexto?.agenteUsuario,
        renovacionExpira,
      },
      select: { idSesion: true },
    });
    const { token, hash } = generarTokenRenovacion(idSesion);
    await this.prisma.sesion.update({
      where: { idSesion },
      data: { tokenRenovacionHash: hash },
    });

    await this.auditoria.registrar({
      accion: 'iniciar_sesion',
      modulo: MODULO,
      idUsuario: usuario.idUsuario,
      idSesion,
    });

    return {
      respuesta: {
        accessToken: await this.firmarAccessToken(usuario.idUsuario, idSesion, rol),
        usuario: aUsuarioAutenticado(usuario, rol),
      },
      tokenRenovacion: token,
      renovacionExpira,
    };
  }

  private firmarAccessToken(idUsuario: number, idSesion: bigint, rol: CodigoRol): Promise<string> {
    const payload: PayloadAccessToken = { sub: String(idUsuario), sid: String(idSesion), rol };
    return this.jwt.signAsync(payload);
  }

  // ------------------------------------------------------------ renovación

  /** Rota el refresh token. Un token ya rotado (reutilización) revoca la sesión. */
  async renovar(tokenCookie: unknown): Promise<SesionEmitida> {
    const leido = leerTokenRenovacion(tokenCookie);
    if (!leido) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);

    const sesion = await this.prisma.sesion.findUnique({
      where: { idSesion: leido.idSesion },
      select: {
        idSesion: true,
        idUsuario: true,
        fin: true,
        tokenRenovacionHash: true,
        renovacionExpira: true,
        usuario: { select: SELECCION_USUARIO_AUTENTICADO },
      },
    });
    if (!sesion || sesion.fin) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);

    if (sesion.tokenRenovacionHash !== leido.hash) {
      await this.revocarPorReutilizacion(sesion.idSesion, sesion.idUsuario);
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }

    const ahora = new Date();
    if (!sesion.renovacionExpira || sesion.renovacionExpira <= ahora) {
      await this.cerrar(sesion.idSesion, 'expirada', ahora);
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }

    const rol = rolDe(sesion.usuario);
    if (sesion.usuario.estado !== 'activo' || !rol) {
      await this.cerrar(sesion.idSesion, 'revocada', ahora);
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }

    const { token, hash } = generarTokenRenovacion(sesion.idSesion);
    // Condicional sobre el hash anterior: si otra petición ya lo rotó, no se actualiza nada.
    const { count } = await this.prisma.sesion.updateMany({
      where: { idSesion: sesion.idSesion, tokenRenovacionHash: leido.hash, fin: null },
      data: { tokenRenovacionHash: hash, ultimaActividad: ahora },
    });
    if (count === 0) {
      await this.revocarPorReutilizacion(sesion.idSesion, sesion.idUsuario);
      throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    }

    return {
      respuesta: {
        accessToken: await this.firmarAccessToken(sesion.idUsuario, sesion.idSesion, rol),
        usuario: aUsuarioAutenticado(sesion.usuario, rol),
      },
      tokenRenovacion: token,
      renovacionExpira: sesion.renovacionExpira,
    };
  }

  private async revocarPorReutilizacion(idSesion: bigint, idUsuario: number): Promise<void> {
    if (await this.cerrar(idSesion, 'revocada', new Date())) {
      await this.auditoria.registrar({
        accion: 'cerrar_sesion',
        modulo: MODULO,
        idUsuario,
        idSesion,
        descripcion: 'Sesión revocada: se reutilizó un token de renovación ya rotado',
      });
    }
  }

  /** Cierra la sesión si sigue abierta. Devuelve si la cerró. */
  private async cerrar(idSesion: bigint, motivo: MotivoCierreSesion, ahora: Date) {
    const { count } = await this.prisma.sesion.updateMany({
      where: { idSesion, fin: null },
      data: { fin: ahora, motivoCierre: motivo, tokenRenovacionHash: null },
    });
    return count > 0;
  }

  // ----------------------------------------------------------- cierre

  /**
   * Cierra la sesión del refresh token (o, si no llega, la del access token). Idempotente:
   * si no hay sesión abierta que cerrar, no hace nada.
   */
  async cerrarSesion(tokenCookie: unknown, accessToken?: string): Promise<void> {
    let sesion: { idSesion: bigint; idUsuario: number } | null = null;

    const leido = leerTokenRenovacion(tokenCookie);
    if (leido) {
      sesion = await this.prisma.sesion.findFirst({
        where: { idSesion: leido.idSesion, tokenRenovacionHash: leido.hash, fin: null },
        select: { idSesion: true, idUsuario: true },
      });
    }
    if (!sesion && accessToken) {
      const payload = await this.verificarAccessToken(accessToken);
      if (payload) sesion = { idSesion: BigInt(payload.sid), idUsuario: Number(payload.sub) };
    }
    if (!sesion) return;

    if (await this.cerrar(sesion.idSesion, 'cerrada', new Date())) {
      await this.auditoria.registrar({
        accion: 'cerrar_sesion',
        modulo: MODULO,
        idUsuario: sesion.idUsuario,
        idSesion: sesion.idSesion,
      });
    }
  }

  // ------------------------------------------------- validación por petición

  async verificarAccessToken(token: string): Promise<PayloadAccessToken | null> {
    try {
      const payload = await this.jwt.verifyAsync<PayloadAccessToken>(token);
      return /^\d+$/.test(payload.sub) && /^\d+$/.test(payload.sid) ? payload : null;
    } catch {
      return null;
    }
  }

  /**
   * Usuario de la petición si la sesión del token sigue abierta y vigente y el usuario sigue
   * activo. Calcula los permisos efectivos (una consulta por petición).
   */
  async usuarioDeSesion(payload: PayloadAccessToken): Promise<UsuarioPeticion | null> {
    const idSesion = BigInt(payload.sid);
    const sesion = await this.prisma.sesion.findUnique({
      where: { idSesion },
      select: {
        idUsuario: true,
        fin: true,
        renovacionExpira: true,
        usuario: { select: SELECCION_USUARIO_AUTENTICADO },
      },
    });
    if (
      !sesion ||
      sesion.fin ||
      sesion.idUsuario !== Number(payload.sub) ||
      !sesion.renovacionExpira ||
      sesion.renovacionExpira <= new Date() ||
      sesion.usuario.estado !== 'activo'
    ) {
      return null;
    }
    const rol = rolDe(sesion.usuario);
    if (!rol) return null;
    return { idUsuario: sesion.idUsuario, idSesion, rol, permisos: permisosDe(sesion.usuario) };
  }

  // ---------------------------------------------------------------- perfil

  async perfil(idUsuario: number): Promise<Perfil> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: SELECCION_USUARIO_AUTENTICADO,
    });
    const rol = usuario ? rolDe(usuario) : null;
    if (!usuario || !rol) throw new UnauthorizedException(MENSAJE_SESION_INVALIDA);
    return aUsuarioAutenticado(usuario, rol);
  }
}
