import { describe, expect, it } from 'vitest';

import { respuestaSaludSchema } from './salud.schema.js';

describe('respuestaSaludSchema', () => {
  it('acepta una respuesta válida', () => {
    const respuesta = { estado: 'ok', baseDatos: 'error', hora: '2026-11-23T10:00:00.000Z' };
    expect(respuestaSaludSchema.parse(respuesta)).toEqual(respuesta);
  });

  it('rechaza un estado de base desconocido', () => {
    const respuesta = { estado: 'ok', baseDatos: 'caida', hora: '2026-11-23T10:00:00.000Z' };
    expect(respuestaSaludSchema.safeParse(respuesta).success).toBe(false);
  });
});
