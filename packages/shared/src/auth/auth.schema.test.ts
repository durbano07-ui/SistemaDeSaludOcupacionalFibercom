import { describe, expect, it } from 'vitest';

import { loginSchema, respuestaLoginSchema } from './auth.schema.js';

describe('loginSchema', () => {
  it('acepta credenciales válidas y recorta espacios del usuario', () => {
    expect(loginSchema.parse({ usuario: '  medico ', contrasena: 'x' })).toEqual({
      usuario: 'medico',
      contrasena: 'x',
    });
  });

  it('pide el usuario y la contraseña cuando faltan', () => {
    const resultado = loginSchema.safeParse({ usuario: '', contrasena: '' });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((i) => i.message)).toEqual([
      'Ingresa tu usuario',
      'Ingresa tu contraseña',
    ]);
  });

  it('limita el largo del usuario (3–50) y de la contraseña (1–128)', () => {
    expect(loginSchema.safeParse({ usuario: 'ab', contrasena: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ usuario: 'a'.repeat(51), contrasena: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ usuario: 'abc', contrasena: 'x'.repeat(129) }).success).toBe(
      false,
    );
  });
});

describe('respuestaLoginSchema', () => {
  it('rechaza permisos desconocidos', () => {
    const respuesta = {
      accessToken: 'a.b.c',
      usuario: {
        id: 1,
        nombreUsuario: 'medico',
        nombres: 'Ana',
        apellidos: 'Prueba',
        rol: { codigo: 'medico_ocupacional', nombre: 'Médico ocupacional' },
        permisos: ['volar'],
      },
    };
    expect(respuestaLoginSchema.safeParse(respuesta).success).toBe(false);
  });
});
