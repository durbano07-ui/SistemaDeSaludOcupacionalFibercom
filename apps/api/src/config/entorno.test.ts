import { describe, expect, it } from 'vitest';

import { EntornoInvalidoError, validarEntorno } from './entorno.js';

const valido = {
  NODE_ENV: 'test',
  PORT: '3000',
  TZ: 'America/Guayaquil',
  DATABASE_URL: 'mysql://smo:smo_local@127.0.0.1:3306/smo_desarrollo',
  CORS_ORIGIN: 'http://localhost:5173',
  JWT_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  LOG_LEVEL: 'info',
};

describe('validarEntorno', () => {
  it('acepta un entorno completo y convierte el puerto a número', () => {
    expect(validarEntorno(valido).PORT).toBe(3000);
  });

  it('dice qué variable falta', () => {
    const { JWT_SECRET: _omitida, ...sinSecreto } = valido;
    expect(() => validarEntorno(sinSecreto)).toThrow(EntornoInvalidoError);
    expect(() => validarEntorno(sinSecreto)).toThrow('JWT_SECRET: falta la variable');
  });

  it('explica por qué una variable es inválida', () => {
    expect(() => validarEntorno({ ...valido, DATABASE_URL: 'postgres://x@y/z' })).toThrow(
      'DATABASE_URL: debe empezar con mysql:// o mariadb://',
    );
  });
});
