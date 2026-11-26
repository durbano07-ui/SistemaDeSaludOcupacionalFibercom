import { describe, expect, it } from 'vitest';

import { fechaEcuador, rangoUtc } from './hora-ecuador.js';

describe('hora de Ecuador (UTC−05:00 fijo)', () => {
  it('una atención del 31-dic 22:00 de Ecuador cuenta en diciembre, no en enero', () => {
    // 31/12/2025 22:00 en Ecuador = 01/01/2026 03:00 UTC
    expect(fechaEcuador(new Date('2026-01-01T03:00:00Z'))).toEqual({
      anio: 2025,
      mes: 12,
      dia: 31,
    });
    expect(fechaEcuador(new Date('2026-01-01T05:00:00Z'))).toEqual({ anio: 2026, mes: 1, dia: 1 });
  });

  it('el rango del año y de un mes empieza a las 05:00 UTC', () => {
    expect(rangoUtc(2025)).toEqual({
      desde: new Date('2025-01-01T05:00:00Z'),
      hasta: new Date('2026-01-01T05:00:00Z'),
    });
    expect(rangoUtc(2026, 12, 12)).toEqual({
      desde: new Date('2026-12-01T05:00:00Z'),
      hasta: new Date('2027-01-01T05:00:00Z'),
    });
    expect(rangoUtc(2026, 4, 6).hasta).toEqual(new Date('2026-07-01T05:00:00Z'));
  });
});
