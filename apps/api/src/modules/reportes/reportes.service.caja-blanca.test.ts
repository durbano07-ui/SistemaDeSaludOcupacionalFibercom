/**
 * PRUEBAS DE CAJA BLANCA — ReportesService (cálculos sobre las consultas agregadas).
 * El repositorio SQL se reemplaza por uno falso para recorrer cada decisión.
 *
 *   valorIndicador (switch) ... V(G) = 5   (un camino por indicador SST)
 *   registroMensual ........... V(G) = 5   (mes/año, receta, observaciones, tipo de evento, primera)
 *   informeTrimestral ......... V(G) = 4   (uno o 4 trimestres, meta presente/ausente, límite nulo)
 *   morbilidad ................ V(G) = 4   (mes / trimestre / año, con o sin receta)
 */
import { describe, expect, it, vi } from 'vitest';

import type { ConteoMes, FilaRegistroSql, ReportesRepositorio } from './reportes.repositorio.js';
import { ReportesService } from './reportes.service.js';

const conteo = (mes: number, c: Partial<ConteoMes> = {}): ConteoMes => ({
  mes,
  total: 0,
  enfermedadComun: 0,
  enfermedadProfesional: 0,
  incidentes: 0,
  accidentes: 0,
  primera: 0,
  subsecuente: 0,
  ...c,
});

const fila = (id: number, fecha: string, c: Partial<FilaRegistroSql> = {}): FilaRegistroSql => ({
  id,
  fecha: new Date(fecha),
  apellidos: 'Prueba',
  nombres: 'Ana',
  cedula: '0250010014',
  cargo: 'Chofer',
  tipoEvento: 'enfermedad_comun',
  tipoAtencion: 'primera',
  cie10: 'J06.9',
  observaciones: null,
  ...c,
});

function servicio(datos: {
  conteos?: ConteoMes[];
  filas?: FilaRegistroSql[];
  detalles?: {
    idAtencion: number;
    nombre: string;
    concentracion: string;
    dosis: string;
    frecuencia: string;
  }[];
  metas?: { indicador: string; texto: string; tipo: string; limite: string | null }[];
  morbilidad?: {
    totalPrimeras: number;
    filas: { codigo: string; descripcion: string; casos: number }[];
  };
  recetados?: { codigo: string; nombre: string; concentracion: string; veces: number }[];
}) {
  const repo = {
    conteosPorMes: vi.fn(() => Promise.resolve(datos.conteos ?? [])),
    filasRegistro: vi.fn(() => Promise.resolve(datos.filas ?? [])),
    medicamentosDe: vi.fn(() =>
      Promise.resolve(
        (datos.detalles ?? []).map((d) => ({
          dosis: d.dosis,
          frecuencia: d.frecuencia,
          recetaMedica: { idAtencion: d.idAtencion },
          medicamento: { nombre: d.nombre, concentracion: d.concentracion },
        })),
      ),
    ),
    metas: vi.fn(() => Promise.resolve(datos.metas ?? [])),
    morbilidad: vi.fn(() => Promise.resolve(datos.morbilidad ?? { totalPrimeras: 0, filas: [] })),
    medicamentosPorCie10: vi.fn(() => Promise.resolve(datos.recetados ?? [])),
    conteoPor: vi.fn(() => Promise.resolve([])),
  };
  return { s: new ReportesService(repo as unknown as ReportesRepositorio), repo };
}

const METAS = [
  { indicador: 'enfermedad_comun', texto: '< 15%', tipo: 'porcentaje_maximo', limite: '15.00' },
  { indicador: 'enfermedad_profesional', texto: '0 casos', tipo: 'casos_maximo', limite: '0.00' },
  { indicador: 'accidente_trabajo', texto: '0 accidentes', tipo: 'casos_maximo', limite: '0.00' },
  { indicador: 'incidente_trabajo', texto: 'Prevención 100%', tipo: 'informativa', limite: null },
  // total_atenciones sin meta configurada: camino "meta ausente"
];

describe('Caja blanca · ReportesService.informeTrimestral + valorIndicador', () => {
  const conteos = [
    conteo(10, {
      total: 10,
      enfermedadComun: 4,
      enfermedadProfesional: 1,
      accidentes: 3,
      incidentes: 2,
    }),
    conteo(11, { total: 10, enfermedadComun: 6, accidentes: 2, incidentes: 2 }),
  ];

  it('T1 · trimestre indicado: cada caso del switch toma su columna y Cumple sigue su meta', async () => {
    const { s } = servicio({ conteos, metas: METAS });
    const r = await s.informeTrimestral({ anio: 2026, trimestre: 4 });

    expect(r.trimestres).toHaveLength(1);
    const porIndicador = Object.fromEntries(r.trimestres[0]!.filas.map((f) => [f.indicador, f]));
    expect(porIndicador.enfermedad_comun).toMatchObject({
      valores: [4, 6, 0],
      total: 10,
      porcentaje: 50,
      cumple: 'no',
    });
    expect(porIndicador.enfermedad_profesional).toMatchObject({
      valores: [1, 0, 0],
      total: 1,
      cumple: 'no',
    });
    expect(porIndicador.accidente_trabajo).toMatchObject({
      valores: [3, 2, 0],
      total: 5,
      porcentaje: 25,
    });
    expect(porIndicador.incidente_trabajo).toMatchObject({
      valores: [2, 2, 0],
      meta: 'Prevención 100%',
      cumple: null,
    });
    // meta ausente: sin texto y sin evaluar
    expect(porIndicador.total_atenciones).toMatchObject({
      valores: [10, 10, 0],
      total: 20,
      meta: null,
      cumple: null,
    });
  });

  it('T2 · sin trimestre: devuelve los 4, con meses completados en cero', async () => {
    const { s } = servicio({ conteos, metas: METAS });
    const r = await s.informeTrimestral({ anio: 2026 });
    expect(r.trimestres.map((t) => t.meses)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
    ]);
    expect(r.trimestres[0]!.filas.every((f) => f.total === 0 && f.porcentaje === null)).toBe(true);
  });
});

describe('Caja blanca · ReportesService.registroMensual', () => {
  it('M1 · con mes: un solo mes, observación vacía → "—", primera vez y sin receta → "—"', async () => {
    const { s, repo } = servicio({
      conteos: [conteo(2, { total: 1, primera: 1 })],
      filas: [fila(1, '2025-02-10T15:00:00Z', { observaciones: '   ' })],
    });
    const r = await s.registroMensual({ anio: 2025, mes: 2 });

    expect(repo.conteosPorMes.mock.calls[0]).toMatchObject([
      { desde: new Date('2025-02-01T05:00:00Z'), hasta: new Date('2025-03-01T05:00:00Z') },
    ]);
    expect(r.meses).toHaveLength(1);
    expect(r.meses[0]!.filas[0]).toMatchObject({
      paciente: 'Prueba Ana',
      tipoEvento: 'Enfermedad común',
      tipoAtencion: 'Primera vez',
      medicamentos: '—',
      observaciones: '—',
    });
  });

  it('M2 · sin mes: 12 meses; cada fila va a su mes de Ecuador; varios medicamentos por atención', async () => {
    const { s } = servicio({
      filas: [
        // 31-dic 22:00 de Ecuador (01-ene 03:00 UTC) cae en diciembre
        fila(1, '2026-01-01T03:00:00Z', {
          tipoAtencion: 'subsecuente',
          observaciones: ' Control ',
        }),
        fila(2, '2025-03-05T16:00:00Z', { tipoEvento: 'evento_desconocido' }),
      ],
      detalles: [
        {
          idAtencion: 1,
          nombre: 'Ibuprofeno',
          concentracion: '400 mg',
          dosis: '1 tableta',
          frecuencia: 'cada 8 horas',
        },
        {
          idAtencion: 1,
          nombre: 'Omeprazol',
          concentracion: '20 mg',
          dosis: '1 cápsula',
          frecuencia: 'cada 24 horas',
        },
      ],
    });
    const r = await s.registroMensual({ anio: 2025 });

    expect(r.meses).toHaveLength(12);
    expect(r.meses[11]!.filas[0]).toMatchObject({
      tipoAtencion: 'Subsecuente',
      observaciones: 'Control',
      medicamentos: 'Ibuprofeno 400 mg – 1 t c/8 h; Omeprazol 20 mg – 1 c c/24 h',
    });
    // tipo de evento sin nombre conocido: se muestra tal cual
    expect(r.meses[2]!.filas[0]).toMatchObject({ tipoEvento: 'evento_desconocido' });
    expect(r.meses[0]!.filas).toEqual([]);
  });
});

describe('Caja blanca · ReportesService.morbilidad (V(G) = 4)', () => {
  const morbilidad = {
    totalPrimeras: 4,
    filas: [
      { codigo: 'J06.9', descripcion: 'Infección', casos: 3 },
      { codigo: 'S61.0', descripcion: 'Herida', casos: 1 },
    ],
  };
  const recetados = [
    { codigo: 'J06.9', nombre: 'Paracetamol', concentracion: '500 mg', veces: 5 },
    { codigo: 'J06.9', nombre: 'Loratadina', concentracion: '10 mg', veces: 2 },
    { codigo: 'J06.9', nombre: 'Amoxicilina', concentracion: '500 mg', veces: 1 },
  ];

  it.each([
    ['mes', { mes: 3 }, 'Marzo 2026', ['2026-03-01T05:00:00Z', '2026-04-01T05:00:00Z']],
    [
      'trimestre',
      { trimestre: 2 },
      'Trimestre 2 de 2026',
      ['2026-04-01T05:00:00Z', '2026-07-01T05:00:00Z'],
    ],
    ['año', {}, 'Año 2026', ['2026-01-01T05:00:00Z', '2027-01-01T05:00:00Z']],
  ])(
    'O · período por %s: rango UTC y texto del período',
    async (_c, periodo, texto, [desde, hasta]) => {
      const { s, repo } = servicio({ morbilidad, recetados });
      const r = await s.morbilidad({ anio: 2026, limite: 20, ...periodo });
      expect(r.periodo).toBe(texto);
      expect(repo.morbilidad.mock.calls[0]).toMatchObject([
        { desde: new Date(desde!), hasta: new Date(hasta!) },
        20,
      ]);
    },
  );

  it('O · tratamiento: los 2 más recetados; sin recetas "Sin receta"; % sobre las primeras', async () => {
    const { s } = servicio({ morbilidad, recetados });
    const r = await s.morbilidad({ anio: 2026, limite: 20 });
    expect(r.filas).toEqual([
      {
        codigo: 'J06.9',
        descripcion: 'Infección',
        casos: 3,
        porcentaje: 75,
        tratamiento: 'Paracetamol 500 mg, Loratadina 10 mg',
      },
      {
        codigo: 'S61.0',
        descripcion: 'Herida',
        casos: 1,
        porcentaje: 25,
        tratamiento: 'Sin receta',
      },
    ]);
  });
});

describe('Caja blanca · ReportesService.consolidadoAnual y gestion', () => {
  it('suma los 12 meses y arma los totales por tipo de evento y de atención', async () => {
    const conteos = [
      conteo(1, { total: 2, enfermedadComun: 1, accidentes: 1, primera: 2 }),
      conteo(7, { total: 1, incidentes: 1, subsecuente: 1 }),
    ];
    const { s } = servicio({ conteos });
    const c = await s.consolidadoAnual({ anio: 2026 });
    expect(c.totales).toEqual({
      total: 3,
      enfermedadComun: 1,
      enfermedadProfesional: 0,
      incidentes: 1,
      accidentes: 1,
      primera: 2,
      subsecuente: 1,
    });

    const g = await s.gestion({ anio: 2026 });
    expect(g.total).toBe(3);
    expect(g.porTipoAtencion).toEqual([
      { nombre: 'Primera vez', total: 2 },
      { nombre: 'Subsecuente', total: 1 },
    ]);
    expect(g.porMes[6]).toEqual({ mes: 7, nombre: 'Julio', total: 1 });
  });
});

describe('Caja blanca · ReportesService.opciones', () => {
  it('delega en el repositorio las bases y cargos de los filtros', async () => {
    const { s, repo } = servicio({});
    const opciones = { bases: [{ id: 1, nombre: 'Guaranda' }], cargos: [] };
    (repo as unknown as { opciones: () => Promise<typeof opciones> }).opciones = vi.fn(() =>
      Promise.resolve(opciones),
    );
    expect(await s.opciones()).toBe(opciones);
  });
});
