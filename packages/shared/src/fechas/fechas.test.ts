import { describe, expect, it } from 'vitest';

import {
  calcularEdad,
  fechaLocal,
  fechaSchema,
  horaLocalDeInstante,
  instanteDeHoraLocal,
} from './fechas.js';

describe('fechas en hora de Ecuador', () => {
  it('el día local de un instante UTC nocturno es el día anterior', () => {
    expect(fechaLocal('2026-11-27T02:30:00Z')).toBe('2026-11-26');
    expect(fechaLocal('2026-11-26T15:00:00Z')).toBe('2026-11-26');
  });

  it('convierte la hora local del formulario a UTC y de vuelta', () => {
    expect(instanteDeHoraLocal('2026-11-26T09:30').toISOString()).toBe('2026-11-26T14:30:00.000Z');
    expect(horaLocalDeInstante('2026-11-26T14:30:00Z')).toBe('2026-11-26T09:30');
  });

  it('calcula la edad cumplida', () => {
    expect(calcularEdad('1990-11-26', '2026-11-26')).toBe(36);
    expect(calcularEdad('1990-11-27', '2026-11-26')).toBe(35);
  });

  it('rechaza fechas que no existen', () => {
    expect(fechaSchema.safeParse('2026-02-30').success).toBe(false);
    expect(fechaSchema.safeParse('2028-02-29').success).toBe(true);
  });
});
