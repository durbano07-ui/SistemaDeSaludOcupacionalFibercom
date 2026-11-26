import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Entorno } from '../../config/entorno.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AuthService, MENSAJE_CREDENCIALES } from './auth.service.js';
import { ContrasenasService } from './contrasenas.service.js';
import { calcularPermisosEfectivos } from './permisos.js';

const CONTRASENA = 'Correcta.2026';
const AHORA = new Date('2026-11-26T15:00:00.000Z');

const entorno = {
  TZ: 'America/Guayaquil',
  JWT_SECRET: 'x'.repeat(32),
  JWT_EXPIRES_IN: '15m',
  REFRESH_EXPIRES_DAYS: 7,
  MAX_INTENTOS: 5,
  BLOQUEO_MINUTOS: 15,
} as Entorno;

const contrasenas = new ContrasenasService();
let hashCorrecto: string;

beforeAll(async () => {
  hashCorrecto = await contrasenas.hash(CONTRASENA);
});

function usuarioDePrueba(cambios: Record<string, unknown> = {}) {
  return {
    idUsuario: 7,
    nombreUsuario: 'medico',
    nombres: 'Ana',
    apellidos: 'Prueba',
    estado: 'activo',
    contrasenaHash: hashCorrecto,
    intentosFallidos: 0,
    bloqueadoHasta: null as Date | null,
    rol: {
      codigo: 'medico_ocupacional',
      nombre: 'Médico ocupacional',
      permisos: [{ permiso: { codigo: 'datos_clinicos' } }, { permiso: { codigo: 'reportes' } }],
    },
    permisosExtra: [] as { permiso: { codigo: string } }[],
    ...cambios,
  };
}

/** Prisma simulado: un solo usuario en memoria y sesiones con id incremental. */
function crearServicio(usuario: ReturnType<typeof usuarioDePrueba> | null) {
  const estado = { usuario };
  const prisma = {
    usuario: {
      findUnique: vi.fn(() => Promise.resolve(estado.usuario)),
      update: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        if (!estado.usuario) throw new Error('sin usuario');
        const { intentosFallidos, ...resto } = data;
        const intentos =
          typeof intentosFallidos === 'object' && intentosFallidos !== null
            ? estado.usuario.intentosFallidos +
              (intentosFallidos as { increment: number }).increment
            : ((intentosFallidos as number | undefined) ?? estado.usuario.intentosFallidos);
        estado.usuario = { ...estado.usuario, ...resto, intentosFallidos: intentos };
        return Promise.resolve(estado.usuario);
      }),
    },
    sesion: {
      create: vi.fn(() => Promise.resolve({ idSesion: 99n })),
      update: vi.fn(() => Promise.resolve({})),
    },
  };
  const auditoria = { registrar: vi.fn(() => Promise.resolve()) };
  const servicio = new AuthService(
    prisma as unknown as PrismaService,
    new JwtService({ secret: entorno.JWT_SECRET, signOptions: { expiresIn: '15m' } }),
    auditoria as unknown as AuditoriaService,
    contrasenas,
    entorno,
  );
  return { servicio, prisma, auditoria, estado };
}

async function capturar(promesa: Promise<unknown>): Promise<HttpException> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('Se esperaba un error HTTP');
}

function accionesAuditadas(auditoria: { registrar: ReturnType<typeof vi.fn> }) {
  return auditoria.registrar.mock.calls.map(
    ([registro]) => (registro as { accion: string }).accion,
  );
}

describe('AuthService.login', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('con la contraseña correcta abre sesión, reinicia intentos y devuelve tokens', async () => {
    const { servicio, estado, prisma, auditoria } = crearServicio(
      usuarioDePrueba({ intentosFallidos: 3 }),
    );

    const sesion = await servicio.login({ usuario: 'MEDICO', contrasena: CONTRASENA });

    expect(sesion.respuesta.usuario).toEqual({
      id: 7,
      nombreUsuario: 'medico',
      nombres: 'Ana',
      apellidos: 'Prueba',
      rol: { codigo: 'medico_ocupacional', nombre: 'Médico ocupacional' },
      permisos: ['datos_clinicos', 'reportes'],
    });
    expect(sesion.respuesta.accessToken.split('.')).toHaveLength(3);
    expect(sesion.tokenRenovacion).toMatch(/^99\.[A-Za-z0-9_-]{43}$/);
    expect(sesion.renovacionExpira).toEqual(new Date('2026-12-03T15:00:00.000Z'));
    expect(estado.usuario).toMatchObject({
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoAcceso: AHORA,
    });
    // En la base solo queda el SHA-256 del refresh token, nunca el token.
    const hashGuardado = (
      prisma.sesion.update.mock.calls[0] as unknown as [{ data: { tokenRenovacionHash: string } }]
    )[0].data.tokenRenovacionHash;
    expect(hashGuardado).toMatch(/^[0-9a-f]{64}$/);
    expect(hashGuardado).not.toContain(sesion.tokenRenovacion);
    expect(accionesAuditadas(auditoria)).toEqual(['iniciar_sesion']);
  });

  it('con la contraseña incorrecta suma un intento y dice cuántos quedan', async () => {
    const { servicio, estado, auditoria } = crearServicio(usuarioDePrueba({ intentosFallidos: 1 }));

    const error = await capturar(servicio.login({ usuario: 'medico', contrasena: 'mala' }));

    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse()).toMatchObject({
      message: MENSAJE_CREDENCIALES,
      intentosRestantes: 3,
    });
    expect(estado.usuario?.intentosFallidos).toBe(2);
    expect(accionesAuditadas(auditoria)).toEqual(['login_fallido']);
  });

  it('al 5.º intento fallido bloquea la cuenta 15 minutos y responde 423', async () => {
    const { servicio, estado, auditoria } = crearServicio(usuarioDePrueba({ intentosFallidos: 4 }));

    const error = await capturar(servicio.login({ usuario: 'medico', contrasena: 'mala' }));

    const hasta = new Date('2026-11-26T15:15:00.000Z');
    expect(error.getStatus()).toBe(HttpStatus.LOCKED);
    expect(error.getResponse()).toMatchObject({
      bloqueadoHasta: hasta.toISOString(),
      message: 'Cuenta bloqueada. Podrás intentarlo de nuevo a las 10:15.',
    });
    expect(estado.usuario).toMatchObject({ intentosFallidos: 5, bloqueadoHasta: hasta });
    expect(accionesAuditadas(auditoria)).toEqual(['login_fallido', 'cuenta_bloqueada']);
  });

  it('con la cuenta bloqueada responde 423 aunque la contraseña sea correcta', async () => {
    const hasta = new Date('2026-11-26T15:10:00.000Z');
    const { servicio, prisma } = crearServicio(
      usuarioDePrueba({ intentosFallidos: 5, bloqueadoHasta: hasta }),
    );

    const error = await capturar(servicio.login({ usuario: 'medico', contrasena: CONTRASENA }));

    expect(error.getStatus()).toBe(HttpStatus.LOCKED);
    expect(error.getResponse()).toMatchObject({ bloqueadoHasta: hasta.toISOString() });
    expect(prisma.sesion.create).not.toHaveBeenCalled();
  });

  it('pasado el tiempo de bloqueo permite entrar y reinicia el contador', async () => {
    const { servicio, estado } = crearServicio(
      usuarioDePrueba({ intentosFallidos: 5, bloqueadoHasta: new Date('2026-11-26T14:59:00Z') }),
    );

    await servicio.login({ usuario: 'medico', contrasena: CONTRASENA });

    expect(estado.usuario).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
  });

  it('pasado el bloqueo, un nuevo error vuelve a contar desde 1', async () => {
    const { servicio, estado } = crearServicio(
      usuarioDePrueba({ intentosFallidos: 5, bloqueadoHasta: new Date('2026-11-26T14:59:00Z') }),
    );

    const error = await capturar(servicio.login({ usuario: 'medico', contrasena: 'mala' }));

    expect(error.getResponse()).toMatchObject({ intentosRestantes: 4 });
    expect(estado.usuario).toMatchObject({ intentosFallidos: 1, bloqueadoHasta: null });
  });

  it('un usuario inexistente recibe el mismo 401 y se audita el nombre intentado', async () => {
    const { servicio, auditoria } = crearServicio(null);
    const verificarFicticio = vi.spyOn(contrasenas, 'verificarFicticio');

    const error = await capturar(servicio.login({ usuario: 'nadie', contrasena: 'x' }));

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.getResponse()).toMatchObject({ message: MENSAJE_CREDENCIALES });
    expect(verificarFicticio).toHaveBeenCalledOnce();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'login_fallido', usuarioIntentado: 'nadie' }),
    );
  });

  it('un usuario inactivo recibe el mismo 401 aunque la contraseña sea correcta', async () => {
    const { servicio } = crearServicio(usuarioDePrueba({ estado: 'inactivo' }));

    const error = await capturar(servicio.login({ usuario: 'medico', contrasena: CONTRASENA }));

    expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.getResponse()).toMatchObject({ message: MENSAJE_CREDENCIALES });
  });

  it('los permisos de la respuesta incluyen los extra del usuario', async () => {
    const { servicio } = crearServicio(
      usuarioDePrueba({
        rol: { codigo: 'apoyo', nombre: 'Personal de apoyo', permisos: [] },
        permisosExtra: [{ permiso: { codigo: 'reportes' } }],
      }),
    );

    const sesion = await servicio.login({ usuario: 'medico', contrasena: CONTRASENA });

    expect(sesion.respuesta.usuario.permisos).toEqual(['reportes']);
  });
});

describe('calcularPermisosEfectivos', () => {
  it('une los permisos del rol y los extra, sin repetir y ordenados', () => {
    expect(
      calcularPermisosEfectivos(['reportes', 'datos_clinicos'], ['usuarios', 'reportes']),
    ).toEqual(['datos_clinicos', 'reportes', 'usuarios']);
  });

  it('el rol apoyo sin permisos propios solo tiene los extra', () => {
    expect(calcularPermisosEfectivos([], ['trabajadores'])).toEqual(['trabajadores']);
  });

  it('ignora códigos que no existen en el sistema', () => {
    expect(calcularPermisosEfectivos(['reportes', 'inventado'], [])).toEqual(['reportes']);
  });
});
