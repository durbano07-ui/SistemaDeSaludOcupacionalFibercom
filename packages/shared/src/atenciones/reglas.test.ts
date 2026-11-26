import { describe, expect, it } from 'vitest';

import {
  alertasSignosVitales,
  algunoRequierePreguntaTrabajo,
  calcularFechaFin,
  coincidenciasAlergia,
  normalizarTexto,
  requierePreguntaTrabajo,
} from './reglas.js';

describe('calcularFechaFin (RN-08)', () => {
  it('cuenta el primer día: 1 día termina el mismo día', () => {
    expect(calcularFechaFin('2026-11-26', 1)).toBe('2026-11-26');
  });

  it('3 días desde el 26 terminan el 28', () => {
    expect(calcularFechaFin('2026-11-26', 3)).toBe('2026-11-28');
  });

  it('cruza meses, años y años bisiestos', () => {
    expect(calcularFechaFin('2026-12-30', 5)).toBe('2027-01-03');
    expect(calcularFechaFin('2028-02-28', 2)).toBe('2028-02-29');
    expect(calcularFechaFin('2026-01-01', 365)).toBe('2026-12-31');
  });
});

describe('requierePreguntaTrabajo (RN-05)', () => {
  it('los diagnósticos S y T exigen la pregunta', () => {
    expect(requierePreguntaTrabajo('S61.0')).toBe(true);
    expect(requierePreguntaTrabajo('t15.1')).toBe(true);
  });

  it('el resto no', () => {
    expect(requierePreguntaTrabajo('M54.5')).toBe(false);
    expect(requierePreguntaTrabajo('')).toBe(false);
    expect(requierePreguntaTrabajo(undefined)).toBe(false);
  });
});

describe('coincidenciasAlergia (RN-06)', () => {
  const amoxicilina = {
    idMedicamento: 1,
    nombre: 'Amoxicilina',
    grupoFarmacologico: 'Penicilinas',
  };
  const ibuprofeno = { idMedicamento: 2, nombre: 'Ibuprofeno', grupoFarmacologico: 'AINE' };
  const paracetamol = {
    idMedicamento: 3,
    nombre: 'Paracetamol',
    grupoFarmacologico: 'Analgésicos',
  };
  const cotrimoxazol = {
    idMedicamento: 4,
    nombre: 'Cotrimoxazol',
    grupoFarmacologico: 'Sulfonamidas',
  };

  it('normaliza tildes y mayúsculas', () => {
    expect(normalizarTexto('PENICILÍNA Ñandú')).toBe('penicilina nandu');
  });

  it('coincide por grupo farmacológico (singular/plural, sin tildes)', () => {
    expect(coincidenciasAlergia('Penicilína', [amoxicilina, paracetamol])).toEqual([
      { idMedicamento: 1, medicamento: 'Amoxicilina', alergia: 'penicilina', por: 'grupo' },
    ]);
  });

  it('coincide por nombre del medicamento', () => {
    expect(coincidenciasAlergia('ibuprofeno, polvo', [ibuprofeno])).toEqual([
      { idMedicamento: 2, medicamento: 'Ibuprofeno', alergia: 'ibuprofeno', por: 'nombre' },
    ]);
  });

  it('reconoce "AINE" y "Sulfas" escritos en la historia clínica', () => {
    expect(
      coincidenciasAlergia('aines', [ibuprofeno, paracetamol]).map((c) => c.medicamento),
    ).toEqual(['Ibuprofeno']);
    expect(coincidenciasAlergia('Sulfas', [cotrimoxazol]).map((c) => c.medicamento)).toEqual([
      'Cotrimoxazol',
    ]);
  });

  it('sin alergias o sin coincidencias no hay alerta', () => {
    expect(coincidenciasAlergia(null, [amoxicilina])).toEqual([]);
    expect(coincidenciasAlergia('Polvo, mariscos', [amoxicilina, ibuprofeno])).toEqual([]);
  });
});

describe('alertasSignosVitales (RN-09)', () => {
  it('valores normales no generan alertas', () => {
    expect(
      alertasSignosVitales({
        presionSistolica: 120,
        presionDiastolica: 80,
        frecuenciaCardiaca: 72,
        frecuenciaRespiratoria: 16,
        saturacionO2: 97,
        temperatura: 36.8,
      }),
    ).toEqual([]);
    expect(alertasSignosVitales(undefined)).toEqual([]);
  });

  it('alerta en los límites: TA 140/90, SatO2 93, T 38,0', () => {
    expect(alertasSignosVitales({ presionSistolica: 140, presionDiastolica: 85 })[0]?.mensaje).toBe(
      'Presión arterial elevada (140/85 mmHg)',
    );
    expect(alertasSignosVitales({ presionSistolica: 130, presionDiastolica: 90 })).toHaveLength(1);
    expect(alertasSignosVitales({ saturacionO2: 93 })[0]?.mensaje).toBe(
      'Saturación de oxígeno baja (93 %)',
    );
    expect(alertasSignosVitales({ temperatura: 38 })[0]?.mensaje).toBe('Fiebre (38,0 °C)');
  });

  it('frecuencias bajas y altas', () => {
    const mensajes = (s: Parameters<typeof alertasSignosVitales>[0]) =>
      alertasSignosVitales(s).map((a) => a.mensaje);
    expect(mensajes({ frecuenciaCardiaca: 49 })).toEqual(['Frecuencia cardiaca baja (49 lpm)']);
    expect(mensajes({ frecuenciaCardiaca: 101 })).toEqual(['Frecuencia cardiaca alta (101 lpm)']);
    expect(mensajes({ frecuenciaCardiaca: 50, frecuenciaRespiratoria: 12 })).toEqual([]);
    expect(mensajes({ frecuenciaRespiratoria: 11 })).toEqual([
      'Frecuencia respiratoria baja (11 rpm)',
    ]);
    expect(mensajes({ frecuenciaRespiratoria: 21 })).toEqual([
      'Frecuencia respiratoria alta (21 rpm)',
    ]);
  });
});

describe('algunoRequierePreguntaTrabajo (RN-05 con varios diagnósticos)', () => {
  it('basta con que un diagnóstico sea S o T', () => {
    expect(algunoRequierePreguntaTrabajo(['M54.5', 'S93.4'])).toBe(true);
    expect(algunoRequierePreguntaTrabajo(['M54.5', 'J06.9'])).toBe(false);
    expect(algunoRequierePreguntaTrabajo([])).toBe(false);
  });
});
