import { describe, expect, it } from 'vitest';

import { type NuevaAtencionEntrada, nuevaAtencionSchema } from './atencion.schema.js';

const base: NuevaAtencionEntrada = {
  idPaciente: 1,
  tipoAtencion: 'primera',
  fecha: '2026-11-26T09:30',
  motivo: 'Dolor lumbar',
  enfermedadActual: 'Dolor de 3 días al levantar carga',
  idCie10: 'M54.5',
  tipoEvento: 'enfermedad_comun',
};

function errores(datos: Partial<NuevaAtencionEntrada>) {
  const resultado = nuevaAtencionSchema.safeParse({ ...base, ...datos });
  return resultado.success
    ? {}
    : Object.fromEntries(resultado.error.issues.map((i) => [i.path.join('.'), i.message]));
}

describe('nuevaAtencionSchema', () => {
  it('acepta una atención mínima y convierte la hora local a UTC', () => {
    const datos = nuevaAtencionSchema.parse(base);
    expect(datos.fecha).toBe('2026-11-26T14:30:00.000Z');
    expect(datos.receta).toBeUndefined();
    expect(datos.ocurrioEnTrabajo).toBeNull();
  });

  it('RN-04: rechaza fechas futuras y próximas citas que no son posteriores', () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString();
    expect(errores({ fecha: manana }).fecha).toBe('La fecha de la atención no puede ser futura');
    expect(errores({ proximaCita: '2026-11-26' }).proximaCita).toBe(
      'La próxima cita debe ser posterior a la fecha de la atención',
    );
    expect(errores({ proximaCita: '2026-11-27' })).toEqual({});
  });

  it('RN-05: S/T exige "¿Ocurrió en el trabajo?" y accidente de trabajo exige "Sí"', () => {
    expect(errores({ idCie10: 'S61.0' }).ocurrioEnTrabajo).toBe('Indica si ocurrió en el trabajo');
    expect(errores({ idCie10: 'S61.0', ocurrioEnTrabajo: false })).toEqual({});
    expect(
      errores({ idCie10: 'S61.0', ocurrioEnTrabajo: false, tipoEvento: 'accidente_trabajo' })
        .ocurrioEnTrabajo,
    ).toBe('Un accidente de trabajo debe haber ocurrido en el trabajo');
    expect(
      errores({ idCie10: 'S61.0', ocurrioEnTrabajo: true, tipoEvento: 'accidente_trabajo' }),
    ).toEqual({});
  });

  it('RN-09: sistólica > diastólica, SatO2 50–100, temperatura 30–45 (los vacíos se ignoran)', () => {
    expect(
      errores({ signosVitales: { presionSistolica: 80, presionDiastolica: 90 } })[
        'signosVitales.presionSistolica'
      ],
    ).toBe('La sistólica debe ser mayor que la diastólica');
    expect(errores({ signosVitales: { saturacionO2: 101 } })['signosVitales.saturacionO2']).toBe(
      'SatO2: el valor máximo es 100',
    );
    expect(errores({ signosVitales: { temperatura: '29,9' } })['signosVitales.temperatura']).toBe(
      'Temperatura: el valor mínimo es 30,0',
    );
    const datos = nuevaAtencionSchema.parse({
      ...base,
      signosVitales: { presionSistolica: '', temperatura: '37,45', frecuenciaCardiaca: '72' },
    });
    expect(datos.signosVitales).toEqual({ temperatura: 37.5, frecuenciaCardiaca: 72 });
  });

  it('RN-07: receta con medicamento o recomendación, sin repetir y con cantidad > 0', () => {
    const detalle = {
      idMedicamento: 5,
      cantidad: 10,
      dosis: '1 tableta',
      frecuencia: 'c/8 h',
      duracion: '3 días',
    };
    expect(
      errores({ receta: { medicamentos: [], signosAlarma: 'Fiebre alta' } })[
        'receta.recomendaciones'
      ],
    ).toBe('La receta necesita al menos un medicamento o una recomendación');
    expect(
      errores({ receta: { medicamentos: [detalle, detalle] } })[
        'receta.medicamentos.1.idMedicamento'
      ],
    ).toBe('Este medicamento ya está en la receta');
    expect(
      errores({ receta: { medicamentos: [{ ...detalle, cantidad: 0 }] } })[
        'receta.medicamentos.0.cantidad'
      ],
    ).toBe('La cantidad debe ser mayor que 0');
    expect(
      nuevaAtencionSchema.parse({ ...base, receta: { medicamentos: [], recomendaciones: '' } })
        .receta,
    ).toBeUndefined();
  });

  it('RN-08: certificado de 1 a 365 días', () => {
    expect(
      errores({ certificado: { dias: 0, fechaInicio: '2026-11-26' } })['certificado.dias'],
    ).toBe('El reposo es de 1 a 365 días');
    expect(
      errores({ certificado: { dias: 366, fechaInicio: '2026-11-26' } })['certificado.dias'],
    ).toBe('El reposo es de 1 a 365 días');
  });
});
