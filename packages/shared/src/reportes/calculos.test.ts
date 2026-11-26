import { describe, expect, it } from 'vitest';

import {
  evaluarMeta,
  mesesDelTrimestre,
  porcentajeDe,
  textoMedicamentos,
  trimestreDeMes,
} from './calculos.js';
import { actualizarMetaSstSchema, filtrosMorbilidadSchema } from './reportes.schema.js';

describe('trimestres', () => {
  it('ubica cada mes en su trimestre', () => {
    expect([1, 3, 4, 6, 7, 9, 10, 12].map(trimestreDeMes)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(mesesDelTrimestre(4)).toEqual([10, 11, 12]);
  });
});

describe('porcentajeDe', () => {
  it('redondea a dos decimales y devuelve null si el total es 0', () => {
    expect(porcentajeDe(1, 3)).toBe(33.33);
    expect(porcentajeDe(5, 5)).toBe(100);
    expect(porcentajeDe(0, 0)).toBeNull();
  });
});

describe('evaluarMeta (Cumple)', () => {
  const porcentaje = { tipo: 'porcentaje_maximo' as const, limite: 15 };
  const casos = { tipo: 'casos_maximo' as const, limite: 0 };

  it('porcentaje máximo: cumple si el % del trimestre no pasa el límite', () => {
    expect(evaluarMeta(porcentaje, { total: 3, porcentaje: 15 })).toBe('si');
    expect(evaluarMeta(porcentaje, { total: 4, porcentaje: 15.01 })).toBe('no');
  });

  it('casos máximos: cumple si el total del trimestre no pasa el límite', () => {
    expect(evaluarMeta(casos, { total: 0, porcentaje: null })).toBe('si');
    expect(evaluarMeta(casos, { total: 1, porcentaje: 10 })).toBe('no');
  });

  it('informativa siempre "—"; porcentaje sin atenciones en el trimestre también "—"', () => {
    expect(
      evaluarMeta({ tipo: 'informativa', limite: null }, { total: 9, porcentaje: 50 }),
    ).toBeNull();
    expect(evaluarMeta(porcentaje, { total: 0, porcentaje: null })).toBeNull();
  });
});

describe('textoMedicamentos', () => {
  it('arma "Nombre concentración – dosis frecuencia" separados por "; "', () => {
    expect(
      textoMedicamentos([
        {
          nombre: 'Ibuprofeno',
          concentracion: '400 mg',
          dosis: '1 tableta',
          frecuencia: 'cada 8 horas',
        },
        { nombre: 'Amoxicilina', concentracion: '500 mg', dosis: '1 cápsula', frecuencia: 'c/8 h' },
        {
          nombre: 'Diclofenaco',
          concentracion: '1 %',
          dosis: 'Aplicación local',
          frecuencia: 'cada 12 horas',
        },
      ]),
    ).toBe(
      'Ibuprofeno 400 mg – 1 t c/8 h; Amoxicilina 500 mg – 1 c c/8 h; Diclofenaco 1 % – Aplicación local c/12 h',
    );
  });

  it('sin receta: "—"', () => {
    expect(textoMedicamentos([])).toBe('—');
  });
});

describe('esquemas de reportes', () => {
  it('la meta exige límite salvo si es informativa (y lo anula si lo es)', () => {
    expect(
      actualizarMetaSstSchema.safeParse({ texto: '< 10%', tipo: 'porcentaje_maximo', limite: '' })
        .success,
    ).toBe(false);
    expect(
      actualizarMetaSstSchema.parse({ texto: 'Monitoreo', tipo: 'informativa', limite: 5 }).limite,
    ).toBeNull();
    expect(
      actualizarMetaSstSchema.parse({ texto: '< 12,5%', tipo: 'porcentaje_maximo', limite: '12,5' })
        .limite,
    ).toBe(12.5);
  });

  it('morbilidad: mes o trimestre, no ambos; límite por defecto 20', () => {
    expect(filtrosMorbilidadSchema.parse({ anio: '2026' }).limite).toBe(20);
    expect(filtrosMorbilidadSchema.safeParse({ anio: 2026, mes: 3, trimestre: 1 }).success).toBe(
      false,
    );
  });
});
