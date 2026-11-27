/**
 * PRUEBAS DE CAJA BLANCA — ramas de las reglas compartidas que las pruebas funcionales no
 * recorrían (hallazgos del análisis de cobertura).
 */
import { describe, expect, it } from 'vitest';

import { nuevaAtencionSchema } from './atenciones/atencion.schema.js';
import { alertasSignosVitales } from './atenciones/reglas.js';
import { instanteDeHoraLocal } from './fechas/fechas.js';
import { esCedulaValida } from './validadores/cedula.js';

describe('Caja blanca · alertasSignosVitales — presión con un solo valor medido', () => {
  it('solo diastólica ≥ 90: alerta en la diastólica y la sistólica se muestra "—"', () => {
    expect(alertasSignosVitales({ presionDiastolica: 95 })).toEqual([
      { campo: 'presionDiastolica', mensaje: 'Presión arterial elevada (—/95 mmHg)' },
    ]);
  });

  it('solo sistólica ≥ 140: alerta en la sistólica y la diastólica se muestra "—"', () => {
    expect(alertasSignosVitales({ presionSistolica: 150 })).toEqual([
      { campo: 'presionSistolica', mensaje: 'Presión arterial elevada (150/— mmHg)' },
    ]);
  });

  it('valores no numéricos (NaN) se ignoran como si no se hubieran medido', () => {
    expect(alertasSignosVitales({ presionSistolica: Number.NaN, temperatura: Number.NaN })).toEqual(
      [],
    );
  });
});

describe('Caja blanca · instanteDeHoraLocal — con y sin segundos', () => {
  it('"YYYY-MM-DDTHH:mm" (16 caracteres) y "YYYY-MM-DDTHH:mm:ss" dan el mismo instante', () => {
    expect(instanteDeHoraLocal('2026-11-26T09:30').toISOString()).toBe('2026-11-26T14:30:00.000Z');
    expect(instanteDeHoraLocal('2026-11-26T09:30:45').toISOString()).toBe(
      '2026-11-26T14:30:45.000Z',
    );
  });
});

describe('Caja blanca · nuevaAtencionSchema — fecha y hora (3 caminos)', () => {
  const base = {
    idPaciente: 1,
    tipoAtencion: 'primera',
    motivo: 'm',
    enfermedadActual: 'e',
    idCie10: 'M54.5',
    tipoEvento: 'enfermedad_comun',
  };
  const fecha = (valor: string) => nuevaAtencionSchema.safeParse({ ...base, fecha: valor });

  it('camino 1 · hora local del formulario', () => {
    expect(fecha('2026-11-20T08:00').data?.fecha).toBe('2026-11-20T13:00:00.000Z');
  });

  it('camino 2 · ISO con zona (Z o ±hh:mm)', () => {
    expect(fecha('2026-11-20T08:00:00-05:00').data?.fecha).toBe('2026-11-20T13:00:00.000Z');
    expect(fecha('2026-11-20T13:00:00Z').data?.fecha).toBe('2026-11-20T13:00:00.000Z');
  });

  it('camino 3 · cualquier otro formato → "La fecha y hora no es válida"', () => {
    for (const valor of ['20/11/2026 08:00', '2026-11-20', 'ayer']) {
      const r = fecha(valor);
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.message).toBe('La fecha y hora no es válida');
    }
  });
});

describe('Caja blanca · esCedulaValida — límites de cada decisión', () => {
  it('provincia: 01 y 24 válidas (bordes); 00, 25 y 29 inválidas; 30 válida', () => {
    // dígito verificador calculado para cada prefijo
    const conVerificador = (nueve: string) =>
      [...Array(10).keys()].map((d) => `${nueve}${d}`).find(esCedulaValida);
    expect(conVerificador('010000000')).toBeDefined();
    expect(conVerificador('240000000')).toBeDefined();
    expect(conVerificador('300000000')).toBeDefined();
    for (const p of ['00', '25', '29']) expect(conVerificador(`${p}0000000`)).toBeUndefined();
  });

  it('tercer dígito: 5 permitido (borde), 6 rechazado', () => {
    const valida = (nueve: string) =>
      [...Array(10).keys()].some((d) => esCedulaValida(`${nueve}${d}`));
    expect(valida('025000000')).toBe(true);
    expect(valida('026000000')).toBe(false);
  });

  it('producto mayor que 9 (resta 9) y verificador 0 cuando la suma es múltiplo de 10', () => {
    // 1710034065: el coeficiente 2 sobre el 7 da 14 → 5; verificador 5
    expect(esCedulaValida('1710034065')).toBe(true);
    // 0102030400: suma múltiplo de 10 → verificador 0
    expect(esCedulaValida('0102030400')).toBe(true);
  });
});

describe('Caja blanca · nuevaAtencionSchema — conversión de campos vacíos y receta', () => {
  const base = {
    idPaciente: 1,
    tipoAtencion: 'primera',
    fecha: '2026-11-20T08:00',
    motivo: 'm',
    enfermedadActual: 'e',
    idCie10: 'M54.5',
    tipoEvento: 'enfermedad_comun',
  };
  const parse = (cambios: object) => nuevaAtencionSchema.safeParse({ ...base, ...cambios });

  it('vacioAIndefinido: null y NaN se ignoran; un texto no numérico da "escribe un número"', () => {
    expect(
      parse({ signosVitales: { frecuenciaCardiaca: null, saturacionO2: Number.NaN } }).data
        ?.signosVitales,
    ).toEqual({});
    const r = parse({ signosVitales: { frecuenciaCardiaca: 'ochenta' } });
    expect(r.error?.issues[0]?.message).toBe('FC: escribe un número');
  });

  it('próxima cita null se toma como "sin cita"; ocurrioEnTrabajo null se mantiene null', () => {
    const r = parse({ proximaCita: null, ocurrioEnTrabajo: null });
    expect(r.data).toMatchObject({ proximaCita: undefined, ocurrioEnTrabajo: null });
  });

  it('receta: se conserva con solo medicamentos o solo recomendaciones; vacía se descarta', () => {
    const med = { idMedicamento: 1, cantidad: '2', dosis: 'd', frecuencia: 'f', duracion: 'u' };
    expect(parse({ receta: { medicamentos: [med] } }).data?.receta?.medicamentos[0]?.cantidad).toBe(
      2,
    );
    expect(
      parse({ receta: { medicamentos: [], recomendaciones: 'Reposo' } }).data?.receta,
    ).toMatchObject({
      recomendaciones: 'Reposo',
      recetarDeTodosModos: false,
    });
    expect(
      parse({ receta: { medicamentos: [], recomendaciones: '   ' } }).data?.receta,
    ).toBeUndefined();
  });
});

describe('Caja blanca · actualizarMetaSstSchema — porcentaje mayor que 100', () => {
  it('un límite de porcentaje sobre 100 se rechaza; en casos máximos sí se admite', async () => {
    const { actualizarMetaSstSchema } = await import('./reportes/reportes.schema.js');
    expect(
      actualizarMetaSstSchema.safeParse({ texto: 'x', tipo: 'porcentaje_maximo', limite: 120 })
        .error?.issues[0]?.message,
    ).toBe('Un porcentaje no puede pasar de 100');
    expect(
      actualizarMetaSstSchema.safeParse({ texto: 'x', tipo: 'casos_maximo', limite: 120 }).success,
    ).toBe(true);
  });
});

describe('Caja blanca · filtros de reportes — valores vacíos', () => {
  it('base y cargo vacíos o null se toman como "todos"; un mes fuera de rango se rechaza', async () => {
    const { filtrosRegistroSchema } = await import('./reportes/reportes.schema.js');
    expect(
      filtrosRegistroSchema.parse({ anio: '2026', base: '', cargo: null, mes: undefined }),
    ).toEqual({
      anio: 2026,
      base: undefined,
      cargo: undefined,
      mes: undefined,
    });
    expect(filtrosRegistroSchema.safeParse({ anio: 2026, mes: 13 }).error?.issues[0]?.message).toBe(
      'El mes debe estar entre 1 y 12',
    );
  });
});

describe('Caja blanca · filtros de morbilidad — límite', () => {
  it('límite vacío toma el valor por defecto (20); un número se respeta; fuera de 1–100 se rechaza', async () => {
    const { filtrosMorbilidadSchema } = await import('./reportes/reportes.schema.js');
    expect(filtrosMorbilidadSchema.parse({ anio: 2026, limite: '' }).limite).toBe(20);
    expect(filtrosMorbilidadSchema.parse({ anio: 2026, limite: '5' }).limite).toBe(5);
    expect(filtrosMorbilidadSchema.safeParse({ anio: 2026, limite: 101 }).success).toBe(false);
  });
});
