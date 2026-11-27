/**
 * PRUEBAS DE CAJA BLANCA — AuthService: renovar, cerrarSesion, verificarAccessToken,
 * usuarioDeSesion y perfil (el login ya está cubierto en auth.service.test.ts).
 *
 *   renovar ............... 6 decisiones → V(G) = 7  (9 condiciones simples)
 *   cerrarSesion .......... 5 decisiones → V(G) = 6
 *   verificarAccessToken .. try/catch + condición compuesta → V(G) = 3
 *   usuarioDeSesion ....... 2 decisiones (una con 6 condiciones) → V(G) = 3
 *   perfil ................ 1 decisión compuesta → V(G) = 2
 */
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Entorno } from '../../config/entorno.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AuthService } from './auth.service.js';
import { ContrasenasService } from './contrasenas.service.js';
import { generarTokenRenovacion } from './token-renovacion.js';

const AHORA = new Date('2026-11-26T15:00:00.000Z');
const MANANA = new Date('2026-11-27T15:00:00.000Z');
const AYER = new Date('2026-11-25T15:00:00.000Z');
const SECRETO = 'x'.repeat(32);

const entorno = {
  TZ: 'America/Guayaquil',
  JWT_SECRET: SECRETO,
  JWT_EXPIRES_IN: '15m',
  REFRESH_EXPIRES_DAYS: 7,
  MAX_INTENTOS: 5,
  BLOQUEO_MINUTOS: 15,
} as Entorno;

const usuario = (cambios: Record<string, unknown> = {}) => ({
  idUsuario: 7,
  nombreUsuario: 'medico',
  nombres: 'Ana',
  apellidos: 'Prueba',
  estado: 'activo',
  rol: {
    codigo: 'medico_ocupacional',
    nombre: 'Médico ocupacional',
    permisos: [{ permiso: { codigo: 'reportes' } }],
  },
  permisosExtra: [{ permiso: { codigo: 'usuarios' } }],
  ...cambios,
});

const { token: TOKEN, hash: HASH } = generarTokenRenovacion(5n);

function sesion(cambios: Record<string, unknown> = {}) {
  return {
    idSesion: 5n,
    idUsuario: 7,
    fin: null as Date | null,
    tokenRenovacionHash: HASH,
    renovacionExpira: MANANA as Date | null,
    usuario: usuario(),
    ...cambios,
  };
}

function crear(
  opciones: {
    sesion?: ReturnType<typeof sesion> | null;
    /** count que devuelven las actualizaciones condicionales, en orden. */
    conteos?: number[];
    sesionPorHash?: { idSesion: bigint; idUsuario: number } | null;
    usuario?: ReturnType<typeof usuario> | null;
  } = {},
) {
  const conteos = [...(opciones.conteos ?? [1, 1])];
  const prisma = {
    sesion: {
      findUnique: vi.fn(() =>
        Promise.resolve(opciones.sesion === undefined ? sesion() : opciones.sesion),
      ),
      findFirst: vi.fn(() => Promise.resolve(opciones.sesionPorHash ?? null)),
      updateMany: vi.fn(() => Promise.resolve({ count: conteos.shift() ?? 1 })),
    },
    usuario: {
      findUnique: vi.fn(() =>
        Promise.resolve(opciones.usuario === undefined ? usuario() : opciones.usuario),
      ),
    },
  };
  const auditoria = { registrar: vi.fn(() => Promise.resolve()) };
  const jwt = new JwtService({ secret: SECRETO, signOptions: { expiresIn: '15m' } });
  const servicio = new AuthService(
    prisma as unknown as PrismaService,
    jwt,
    auditoria as unknown as AuditoriaService,
    new ContrasenasService(),
    entorno,
  );
  return { servicio, prisma, auditoria, jwt };
}

const acciones = (auditoria: { registrar: ReturnType<typeof vi.fn> }) =>
  auditoria.registrar.mock.calls.map(([r]) => r as { accion: string; descripcion?: string });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AHORA);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Caja blanca · AuthService.renovar (V(G) = 7)', () => {
  it('R1 · D1 verdadera: cookie ausente o con formato inválido → 401 sin tocar la base', async () => {
    const { servicio, prisma } = crear();
    await expect(servicio.renovar(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(servicio.renovar('no-es-un-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.sesion.findUnique).not.toHaveBeenCalled();
  });

  it('R2 · D2 primera condición: la sesión no existe → 401', async () => {
    const { servicio } = crear({ sesion: null });
    await expect(servicio.renovar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('R3 · D2 segunda condición: la sesión ya está cerrada → 401 sin revocar de nuevo', async () => {
    const { servicio, prisma } = crear({ sesion: sesion({ fin: AYER }) });
    await expect(servicio.renovar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.sesion.updateMany).not.toHaveBeenCalled();
  });

  it('R4 · D3 verdadera: token ya rotado (reutilización) → revoca la sesión y lo audita', async () => {
    const { servicio, prisma, auditoria } = crear({
      sesion: sesion({ tokenRenovacionHash: 'f'.repeat(64) }),
    });
    await expect(servicio.renovar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.sesion.updateMany.mock.calls[0]).toMatchObject([
      {
        where: { idSesion: 5n, fin: null },
        data: { motivoCierre: 'revocada', tokenRenovacionHash: null },
      },
    ]);
    expect(acciones(auditoria)).toEqual([
      expect.objectContaining({
        accion: 'cerrar_sesion',
        descripcion: expect.stringContaining('reutilizó'),
      }),
    ]);
  });

  it('R4b · reutilización sobre una sesión que otra petición ya cerró: no audita dos veces', async () => {
    const { servicio, auditoria } = crear({
      sesion: sesion({ tokenRenovacionHash: 'f'.repeat(64) }),
      conteos: [0],
    });
    await expect(servicio.renovar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('R5 · D4 verdadera (ambas condiciones): sin fecha de vencimiento o vencida → la marca "expirada"', async () => {
    for (const renovacionExpira of [null, AYER]) {
      const { servicio, prisma } = crear({ sesion: sesion({ renovacionExpira }) });
      await expect(servicio.renovar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.sesion.updateMany.mock.calls[0]).toMatchObject([
        { data: { motivoCierre: 'expirada' } },
      ]);
    }
  });

  it('R6 · D5 verdadera (ambas condiciones): usuario inactivo o sin rol válido → la revoca', async () => {
    for (const u of [usuario({ estado: 'inactivo' }), usuario({ rol: null })]) {
      const { servicio, prisma } = crear({ sesion: sesion({ usuario: u }) });
      await expect(servicio.renovar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.sesion.updateMany.mock.calls[0]).toMatchObject([
        { data: { motivoCierre: 'revocada' } },
      ]);
    }
  });

  it('R7 · D6 verdadera: otra petición rotó el token al mismo tiempo (count 0) → reutilización', async () => {
    const { servicio, prisma } = crear({ conteos: [0, 1] });
    await expect(servicio.renovar(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.sesion.updateMany).toHaveBeenCalledTimes(2); // rotación fallida + revocación
  });

  it('R8 · todas las decisiones falsas: rota el token y entrega un access token nuevo', async () => {
    const { servicio, prisma, jwt } = crear();
    const r = await servicio.renovar(TOKEN);

    expect(r.tokenRenovacion).not.toBe(TOKEN);
    expect(r.tokenRenovacion).toMatch(/^5\./);
    expect(r.renovacionExpira).toEqual(MANANA);
    expect(r.respuesta.usuario.permisos).toEqual(['reportes', 'usuarios']);
    expect(await jwt.verifyAsync(r.respuesta.accessToken)).toMatchObject({ sub: '7', sid: '5' });
    expect(prisma.sesion.updateMany.mock.calls[0]).toMatchObject([
      {
        where: { idSesion: 5n, tokenRenovacionHash: HASH, fin: null },
        data: { ultimaActividad: AHORA },
      },
    ]);
  });
});

describe('Caja blanca · AuthService.cerrarSesion (V(G) = 6)', () => {
  it('S1 · sin cookie ni access token: no hace nada (idempotente)', async () => {
    const { servicio, prisma, auditoria } = crear();
    await servicio.cerrarSesion(undefined);
    expect(prisma.sesion.findFirst).not.toHaveBeenCalled();
    expect(prisma.sesion.updateMany).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('S2 · cookie válida: cierra la sesión del hash y audita "cerrar_sesion"', async () => {
    const { servicio, prisma, auditoria } = crear({
      sesionPorHash: { idSesion: 5n, idUsuario: 7 },
    });
    await servicio.cerrarSesion(TOKEN);
    expect(prisma.sesion.findFirst.mock.calls[0]).toMatchObject([
      { where: { idSesion: 5n, tokenRenovacionHash: HASH, fin: null } },
    ]);
    expect(prisma.sesion.updateMany.mock.calls[0]).toMatchObject([
      { data: { motivoCierre: 'cerrada' } },
    ]);
    expect(acciones(auditoria)).toEqual([
      expect.objectContaining({ accion: 'cerrar_sesion', idSesion: 5n }),
    ]);
  });

  it('S3 · cookie que ya no corresponde, pero con access token válido: cierra la sesión del token', async () => {
    const { servicio, prisma, jwt } = crear({ sesionPorHash: null });
    const acceso = await jwt.signAsync({ sub: '7', sid: '9', rol: 'medico_ocupacional' });
    await servicio.cerrarSesion(TOKEN, acceso);
    expect(prisma.sesion.updateMany.mock.calls[0]).toMatchObject([{ where: { idSesion: 9n } }]);
  });

  it('S4 · solo access token inválido: no cierra nada', async () => {
    const { servicio, prisma } = crear();
    await servicio.cerrarSesion(undefined, 'a.b.c');
    expect(prisma.sesion.updateMany).not.toHaveBeenCalled();
  });

  it('S5 · la sesión ya estaba cerrada (count 0): no audita de nuevo', async () => {
    const { servicio, auditoria } = crear({
      sesionPorHash: { idSesion: 5n, idUsuario: 7 },
      conteos: [0],
    });
    await servicio.cerrarSesion(TOKEN);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });
});

describe('Caja blanca · AuthService.verificarAccessToken (V(G) = 3)', () => {
  it('V1 · token válido con sub y sid numéricos → payload', async () => {
    const { servicio, jwt } = crear();
    const token = await jwt.signAsync({ sub: '7', sid: '5', rol: 'apoyo' });
    expect(await servicio.verificarAccessToken(token)).toMatchObject({ sub: '7', sid: '5' });
  });

  it('V2 · firma válida pero sub o sid no numéricos → null', async () => {
    const { servicio, jwt } = crear();
    expect(
      await servicio.verificarAccessToken(await jwt.signAsync({ sub: 'admin', sid: '5' })),
    ).toBeNull();
    expect(
      await servicio.verificarAccessToken(await jwt.signAsync({ sub: '7', sid: 'x' })),
    ).toBeNull();
  });

  it('V3 · firma inválida, otro secreto o vencido → null (rama catch)', async () => {
    const { servicio } = crear();
    const ajeno = await new JwtService({ secret: 'y'.repeat(32) }).signAsync({
      sub: '7',
      sid: '5',
    });
    expect(await servicio.verificarAccessToken(ajeno)).toBeNull();
    expect(await servicio.verificarAccessToken('basura')).toBeNull();
  });
});

describe('Caja blanca · AuthService.usuarioDeSesion (V(G) = 3, 8 condiciones)', () => {
  const payload = { sub: '7', sid: '5', rol: 'medico_ocupacional' as const };

  it.each([
    ['la sesión no existe', null],
    ['la sesión está cerrada', sesion({ fin: AYER })],
    ['la sesión es de otro usuario', sesion({ idUsuario: 8 })],
    ['la sesión no tiene vencimiento', sesion({ renovacionExpira: null })],
    ['la sesión ya venció', sesion({ renovacionExpira: AYER })],
    ['el usuario está inactivo', sesion({ usuario: usuario({ estado: 'inactivo' }) })],
    [
      'el usuario no tiene rol válido',
      sesion({ usuario: usuario({ rol: { codigo: 'desconocido', nombre: 'X', permisos: [] } }) }),
    ],
  ])('U · %s → null', async (_caso, s) => {
    const { servicio } = crear({ sesion: s });
    expect(await servicio.usuarioDeSesion(payload)).toBeNull();
  });

  it('U · sesión abierta y vigente de un usuario activo → usuario con permisos efectivos', async () => {
    const { servicio } = crear();
    expect(await servicio.usuarioDeSesion(payload)).toEqual({
      idUsuario: 7,
      idSesion: 5n,
      rol: 'medico_ocupacional',
      permisos: ['reportes', 'usuarios'],
    });
  });
});

describe('Caja blanca · AuthService.perfil (V(G) = 2)', () => {
  it('P1 · el usuario no existe o no tiene rol → 401', async () => {
    await expect(crear({ usuario: null }).servicio.perfil(7)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      crear({ usuario: usuario({ rol: null }) }).servicio.perfil(7),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('P2 · usuario con rol → perfil con nombre del rol y permisos efectivos', async () => {
    expect(await crear().servicio.perfil(7)).toEqual({
      id: 7,
      nombreUsuario: 'medico',
      nombres: 'Ana',
      apellidos: 'Prueba',
      rol: { codigo: 'medico_ocupacional', nombre: 'Médico ocupacional' },
      permisos: ['reportes', 'usuarios'],
    });
  });
});
