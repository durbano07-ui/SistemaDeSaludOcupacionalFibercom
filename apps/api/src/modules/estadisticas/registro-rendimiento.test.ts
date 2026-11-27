import { describe, expect, it } from 'vitest';

import { percentil, RegistroRendimiento } from './registro-rendimiento.js';

describe('percentil', () => {
  it('rango más cercano', () => {
    const valores = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentil(valores, 95)).toBe(95);
    expect(percentil([10], 95)).toBe(10);
    expect(percentil([], 95)).toBeNull();
  });
});

describe('RegistroRendimiento', () => {
  const ahora = Date.UTC(2026, 10, 26, 15, 30, 30);

  it('acumula por minuto: cantidad, promedio y p95; la serie de 1h tiene 60 puntos', () => {
    const registro = new RegistroRendimiento();
    for (const ms of [10, 20, 30, 40]) registro.registrar(ms, ahora);
    registro.registrar(100, ahora - 60_000);

    const r = registro.resumen('1h', ahora);
    expect(r).toMatchObject({ rango: '1h', peticiones: 5, promedioMs: 40, p95Ms: 100 });
    expect(r.serie).toHaveLength(60);
    expect(r.serie.at(-1)).toMatchObject({ peticiones: 4, promedioMs: 25, p95Ms: 40 });
    expect(r.serie.at(-2)).toMatchObject({ peticiones: 1, promedioMs: 100 });
    expect(r.serie[0]).toMatchObject({ peticiones: 0, promedioMs: null, p95Ms: null });
  });

  it('24h agrupa en 96 puntos de 15 minutos y descarta lo de hace más de 24 h', () => {
    const registro = new RegistroRendimiento();
    registro.registrar(50, ahora - 25 * 3_600_000);
    registro.registrar(70, ahora - 2 * 3_600_000);
    registro.registrar(90, ahora);

    const r = registro.resumen('24h', ahora);
    expect(r.serie).toHaveLength(96);
    expect(r.peticiones).toBe(2);
    expect(r.promedioMs).toBe(80);
  });
});

describe('Caja blanca · RegistroRendimiento.registrar — muestreo de reservorio', () => {
  it('pasadas las 2000 muestras del minuto sigue contando todo, pero guarda como máximo 2000', () => {
    const registro = new RegistroRendimiento();
    const ahora = Date.UTC(2026, 10, 26, 15, 0, 10);
    for (let i = 0; i < 2_500; i++) registro.registrar(i < 2_000 ? 10 : 1_000, ahora);

    const r = registro.resumen('1h', ahora);
    // Cantidad y promedio son exactos aunque se muestree para el percentil
    expect(r.peticiones).toBe(2_500);
    expect(r.promedioMs).toBe(208);
    expect(r.p95Ms === 10 || r.p95Ms === 1_000).toBe(true);
  });
});

describe('Caja blanca · RegistroRendimiento.resumen — sin peticiones', () => {
  it('sin datos el promedio y el p95 son null (no 0)', () => {
    const r = new RegistroRendimiento().resumen('24h');
    expect(r).toMatchObject({ peticiones: 0, promedioMs: null, p95Ms: null });
  });
});
