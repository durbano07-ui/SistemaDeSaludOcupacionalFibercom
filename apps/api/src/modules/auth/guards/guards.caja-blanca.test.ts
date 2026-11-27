/**
 * PRUEBAS DE CAJA BLANCA — control de acceso.
 *
 *   tokenBearer ............. 1 decisión compuesta (3 condiciones) → V(G) = 2
 *   JwtAuthGuard.canActivate  5 decisiones → V(G) = 6
 *   PermisosGuard.canActivate 2 decisiones → V(G) = 3
 *   permisos.ts (rolDe, permisosDe, aUsuarioAutenticado): ramas defensivas de los `??`
 */
import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { contextoActual, middlewareContexto } from '../../../common/contexto/contexto-peticion.js';
import type { AuthService } from '../auth.service.js';
import type { UsuarioPeticion } from '../auth.types.js';
import { ES_PUBLICO } from '../decoradores/publico.decorator.js';
import { PERMISOS_REQUERIDOS } from '../decoradores/requiere-permiso.decorator.js';
import { aUsuarioAutenticado, permisosDe, rolDe } from '../permisos.js';
import { JwtAuthGuard, tokenBearer } from './jwt-auth.guard.js';
import { PermisosGuard } from './permisos.guard.js';

const USUARIO: UsuarioPeticion = {
  idUsuario: 7,
  idSesion: 5n,
  rol: 'medico_ocupacional',
  permisos: ['datos_clinicos', 'reportes'],
};

/** Contexto de ejecución falso con la petición indicada. */
function contexto(peticion: Partial<Request> & { usuario?: UsuarioPeticion }): ExecutionContext {
  return {
    getHandler: () => function manejador() {},
    getClass: () => class Controlador {},
    switchToHttp: () => ({ getRequest: () => peticion }),
  } as unknown as ExecutionContext;
}

/** Reflector falso: devuelve los metadatos indicados por clave. */
const reflector = (metadatos: Record<string, unknown>) =>
  ({ getAllAndOverride: vi.fn((clave: string) => metadatos[clave]) }) as unknown as Reflector;

describe('Caja blanca · tokenBearer (V(G) = 2)', () => {
  it('B1 · "Bearer <token>" (sin distinguir mayúsculas) → token', () => {
    expect(tokenBearer('Bearer abc.def')).toBe('abc.def');
    expect(tokenBearer('bearer abc')).toBe('abc');
  });

  it('B2 · sin cabecera, otro esquema o sin token → undefined', () => {
    expect(tokenBearer(undefined)).toBeUndefined();
    expect(tokenBearer('Basic dXN1YXJpbw==')).toBeUndefined();
    expect(tokenBearer('Bearer')).toBeUndefined();
  });
});

describe('Caja blanca · JwtAuthGuard.canActivate (V(G) = 6)', () => {
  const servicio = (usuario: UsuarioPeticion | null, payloadValido = true) => {
    const s = {
      verificarAccessToken: vi.fn(() =>
        Promise.resolve(payloadValido ? { sub: '7', sid: '5', rol: 'medico_ocupacional' } : null),
      ),
      usuarioDeSesion: vi.fn(() => Promise.resolve(usuario)),
    };
    return s as typeof s & AuthService;
  };

  it('J1 · D1 verdadera: ruta @Publico() → pasa sin mirar el token', async () => {
    const auth = servicio(USUARIO);
    const guard = new JwtAuthGuard(reflector({ [ES_PUBLICO]: true }), auth);
    await expect(guard.canActivate(contexto({ headers: {} }))).resolves.toBe(true);
    expect(auth.verificarAccessToken).not.toHaveBeenCalled();
  });

  it('J2 · D2 verdadera: sin token → 401 "Debes iniciar sesión"', async () => {
    const guard = new JwtAuthGuard(reflector({}), servicio(USUARIO));
    await expect(guard.canActivate(contexto({ headers: {} }))).rejects.toThrow(
      'Debes iniciar sesión',
    );
  });

  it('J3 · D3 falsa: token inválido → no consulta la sesión y responde 401', async () => {
    const auth = servicio(USUARIO, false);
    const guard = new JwtAuthGuard(reflector({}), auth);
    await expect(
      guard.canActivate(contexto({ headers: { authorization: 'Bearer malo' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.usuarioDeSesion).not.toHaveBeenCalled();
  });

  it('J4 · D4 verdadera: token válido de una sesión cerrada → 401', async () => {
    const guard = new JwtAuthGuard(reflector({}), servicio(null));
    await expect(
      guard.canActivate(contexto({ headers: { authorization: 'Bearer bueno' } })),
    ).rejects.toThrow('La sesión no es válida');
  });

  it('J5 · D5 falsa (fuera de una petición HTTP): deja el usuario en req.usuario', async () => {
    const peticion: Partial<Request> & { usuario?: UsuarioPeticion } = {
      headers: { authorization: 'Bearer bueno' },
    };
    const guard = new JwtAuthGuard(reflector({}), servicio(USUARIO));
    await expect(guard.canActivate(contexto(peticion))).resolves.toBe(true);
    expect(peticion.usuario).toEqual(USUARIO);
    expect(contextoActual()).toBeUndefined();
  });

  it('J6 · D5 verdadera (dentro de una petición): también completa el contexto para la auditoría', async () => {
    const peticion = {
      headers: { authorization: 'Bearer bueno' },
      ip: '10.0.0.8',
      socket: {},
      get: () => 'navegador',
    } as unknown as Request;
    const guard = new JwtAuthGuard(reflector({}), servicio(USUARIO));

    const enContexto = await new Promise<ReturnType<typeof contextoActual>>((resolver) => {
      middlewareContexto(peticion, {} as Response, () => {
        void guard.canActivate(contexto(peticion)).then(() => resolver(contextoActual()));
      });
    });
    expect(enContexto).toMatchObject({ ip: '10.0.0.8', idUsuario: 7, idSesion: 5n });
  });
});

describe('Caja blanca · PermisosGuard.canActivate (V(G) = 3)', () => {
  it('G1 · D1 verdadera: la ruta no exige permisos (sin metadato o lista vacía) → pasa', () => {
    expect(new PermisosGuard(reflector({})).canActivate(contexto({}))).toBe(true);
    expect(
      new PermisosGuard(reflector({ [PERMISOS_REQUERIDOS]: [] })).canActivate(contexto({})),
    ).toBe(true);
  });

  it('G2 · D2 falsa: tiene todos los permisos exigidos → pasa', () => {
    const guard = new PermisosGuard(
      reflector({ [PERMISOS_REQUERIDOS]: ['reportes', 'datos_clinicos'] }),
    );
    expect(guard.canActivate(contexto({ usuario: USUARIO }))).toBe(true);
  });

  it('G3 · D2 verdadera: le falta un permiso → 403 con los permisos faltantes', () => {
    const guard = new PermisosGuard(
      reflector({ [PERMISOS_REQUERIDOS]: ['reportes', 'atenciones'] }),
    );
    let error: unknown;
    try {
      guard.canActivate(contexto({ usuario: USUARIO }));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      permisosFaltantes: ['atenciones'],
    });
  });

  it('G4 · sin usuario en la petición (ruta pública con permiso, error de configuración) → 403', () => {
    const guard = new PermisosGuard(reflector({ [PERMISOS_REQUERIDOS]: ['reportes'] }));
    expect(() => guard.canActivate(contexto({}))).toThrow(ForbiddenException);
  });
});

describe('Caja blanca · permisos.ts — ramas defensivas', () => {
  const base = {
    idUsuario: 3,
    nombreUsuario: null,
    nombres: 'Sin',
    apellidos: 'Rol',
    estado: 'activo' as const,
    rol: null,
    permisosExtra: [{ permiso: { codigo: 'reportes' } }],
  };

  it('rolDe: sin rol o con un código desconocido → null', () => {
    expect(rolDe({ rol: null })).toBeNull();
    expect(rolDe({ rol: { codigo: 'otro', nombre: 'Otro', permisos: [] } })).toBeNull();
  });

  it('permisosDe: sin rol solo cuenta los permisos extra', () => {
    expect(permisosDe(base)).toEqual(['reportes']);
  });

  it('aUsuarioAutenticado: sin nombre de usuario ni rol cargado usa valores de respaldo', () => {
    expect(aUsuarioAutenticado(base, 'apoyo')).toMatchObject({
      nombreUsuario: '',
      rol: { codigo: 'apoyo', nombre: 'apoyo' },
      permisos: ['reportes'],
    });
  });
});
