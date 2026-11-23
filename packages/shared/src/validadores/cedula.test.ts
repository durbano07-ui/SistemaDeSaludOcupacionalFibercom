import { describe, expect, it } from 'vitest';

import { cedulaSchema, esCedulaValida } from './cedula.js';

describe('esCedulaValida', () => {
  it.each(['1710034065', '0926687856', '0102030400', '3050000003'])(
    'acepta la cédula válida %s',
    (cedula) => {
      expect(esCedulaValida(cedula)).toBe(true);
    },
  );

  it('rechaza un dígito verificador incorrecto', () => {
    expect(esCedulaValida('1710034066')).toBe(false);
  });

  it.each(['171003406', '17100340651', '17100340a5', '', ' 1710034065'])(
    'rechaza %j por no tener 10 dígitos',
    (cedula) => {
      expect(esCedulaValida(cedula)).toBe(false);
    },
  );

  it.each(['0010034064', '2510034065', '2910034061', '9910034066'])(
    'rechaza la provincia inválida de %s',
    (cedula) => {
      expect(esCedulaValida(cedula)).toBe(false);
    },
  );

  it('acepta la provincia 30 (ecuatorianos en el exterior)', () => {
    expect(esCedulaValida('3050000003')).toBe(true);
  });

  it('rechaza un tercer dígito mayor o igual a 6', () => {
    expect(esCedulaValida('1760000008')).toBe(false);
  });
});

describe('cedulaSchema', () => {
  it('acepta una cédula válida y recorta espacios', () => {
    expect(cedulaSchema.parse(' 1710034065 ')).toBe('1710034065');
  });

  it('informa el error de longitud en español', () => {
    const resultado = cedulaSchema.safeParse('123');
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe('La cédula debe tener exactamente 10 dígitos');
  });

  it('informa el error de cédula inválida', () => {
    const resultado = cedulaSchema.safeParse('1710034066');
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe('La cédula no es válida');
  });
});
