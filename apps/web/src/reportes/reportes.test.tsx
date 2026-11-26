import type { MetaSst } from '@smo/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dayjs, ZONA_HORARIA } from '../lib/fecha';
import { problema, renderizarEn, USUARIO_MEDICO } from '../test/renderizar';

afterEach(() => {
  vi.unstubAllGlobals();
});

const hoy = dayjs().tz(ZONA_HORARIA);
const ANIO = hoy.year();
const MES = hoy.month() + 1;

const OPCIONES = {
  bases: [
    { id: 1, nombre: 'Guaranda' },
    { id: 2, nombre: 'San Miguel' },
  ],
  cargos: [{ id: 7, nombre: 'Chofer' }],
};

const totales = (total: number) => ({
  total,
  enfermedadComun: total,
  enfermedadProfesional: 0,
  incidentes: 0,
  accidentes: 0,
  primera: total,
  subsecuente: 0,
});

const registro = (mes: number, total: number) => ({
  anio: ANIO,
  meses: [
    {
      mes,
      totales: totales(total),
      filas: Array.from({ length: total }, (_, i) => ({
        id: i + 1,
        fecha: `${ANIO}-${String(mes).padStart(2, '0')}-10T15:00:00.000Z`,
        paciente: `Paciente ${i + 1}`,
        tipoEvento: 'Enfermedad común',
        cedula: '0250010014',
        cargo: 'Chofer',
        cie10: 'J06.9',
        tipoAtencion: 'Primera vez',
        medicamentos: 'Paracetamol 500 mg – 1 t c/8 h',
        observaciones: '—',
      })),
    },
  ],
});

const METAS: MetaSst[] = [
  {
    indicador: 'enfermedad_comun',
    texto: '< 15%',
    tipo: 'porcentaje_maximo',
    limite: 15,
    actualizadoEn: '2026-11-26T15:00:00Z',
  },
  {
    indicador: 'enfermedad_profesional',
    texto: '0 casos',
    tipo: 'casos_maximo',
    limite: 0,
    actualizadoEn: '2026-11-26T15:00:00Z',
  },
  {
    indicador: 'accidente_trabajo',
    texto: '0 accidentes',
    tipo: 'casos_maximo',
    limite: 0,
    actualizadoEn: '2026-11-26T15:00:00Z',
  },
  {
    indicador: 'incidente_trabajo',
    texto: 'Prevención 100%',
    tipo: 'informativa',
    limite: null,
    actualizadoEn: '2026-11-26T15:00:00Z',
  },
  {
    indicador: 'total_atenciones',
    texto: 'Monitoreo',
    tipo: 'informativa',
    limite: null,
    actualizadoEn: '2026-11-26T15:00:00Z',
  },
];

const TRIMESTRAL = {
  anio: ANIO,
  trimestres: [
    {
      trimestre: 4,
      meses: [10, 11, 12],
      filas: [
        {
          indicador: 'enfermedad_comun',
          valores: [8, 13, 0],
          total: 21,
          porcentaje: 72.41,
          meta: '< 15%',
          cumple: 'no',
        },
        {
          indicador: 'enfermedad_profesional',
          valores: [0, 0, 0],
          total: 0,
          porcentaje: 0,
          meta: '0 casos',
          cumple: 'si',
        },
        {
          indicador: 'accidente_trabajo',
          valores: [3, 5, 0],
          total: 8,
          porcentaje: 27.59,
          meta: '0 accidentes',
          cumple: 'no',
        },
        {
          indicador: 'incidente_trabajo',
          valores: [0, 0, 0],
          total: 0,
          porcentaje: 0,
          meta: 'Prevención 100%',
          cumple: null,
        },
        {
          indicador: 'total_atenciones',
          valores: [11, 18, 0],
          total: 29,
          porcentaje: 100,
          meta: 'Monitoreo',
          cumple: null,
        },
      ],
    },
  ],
};

function abrirReportes(respuestas = {}) {
  return renderizarEn('/medico/reportes', {
    usuario: USUARIO_MEDICO,
    respuestas: {
      '/api/v1/reportes/opciones': () => Response.json(OPCIONES),
      [`/api/v1/reportes/registro-mensual?anio=${ANIO}&mes=${MES}`]: () =>
        Response.json(registro(MES, 25)),
      ...respuestas,
    },
  });
}

describe('Pantalla Reportes', () => {
  it('muestra las 5 pestañas, los 6 totales y la tabla paginada de 20', async () => {
    abrirReportes();

    // La primera vez se descarga el bloque perezoso de la pantalla
    await screen.findByRole('tab', { name: 'Registro mensual' }, { timeout: 5_000 });
    for (const p of [
      'Registro mensual',
      'Consolidado anual',
      'Informe trimestral SST',
      'Morbilidad CIE-10',
      'Estadísticas de gestión',
    ]) {
      expect(await screen.findByRole('tab', { name: p })).toBeInTheDocument();
    }
    const tabla = await screen.findByRole('table', { name: 'Registro de atenciones del mes' });
    expect(screen.getByText('Total atenciones').nextElementSibling).toHaveTextContent('25');
    expect(within(tabla).getAllByRole('row')).toHaveLength(21);
    expect(within(tabla).queryByText('Firma/Conformidad')).not.toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Paginación del registro mensual' }),
    ).toHaveTextContent('1–20 de 25');
  });

  it('los filtros solo se aplican al pulsar "Aplicar"', async () => {
    const usuario = userEvent.setup();
    const { fetchSimulado } = abrirReportes({
      [`/api/v1/reportes/registro-mensual?anio=${ANIO}&mes=3&base=2&cargo=7`]: () =>
        Response.json(registro(3, 2)),
    });
    await screen.findByRole('table', { name: 'Registro de atenciones del mes' });
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'San Miguel' })).toBeInTheDocument(),
    );

    await usuario.selectOptions(screen.getByLabelText('Mes'), 'Marzo');
    await usuario.selectOptions(screen.getByLabelText('Base'), 'San Miguel');
    await usuario.selectOptions(screen.getByLabelText('Cargo'), 'Chofer');
    const urlFiltrada = `/api/v1/reportes/registro-mensual?anio=${ANIO}&mes=3&base=2&cargo=7`;
    expect(fetchSimulado).not.toHaveBeenCalledWith(urlFiltrada, expect.anything());

    await usuario.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledWith(urlFiltrada, expect.anything()));
    expect(await screen.findByRole('heading', { name: /Marzo/ })).toBeInTheDocument();
  });

  it('sin atenciones muestra "Sin atenciones en el período"', async () => {
    abrirReportes({
      [`/api/v1/reportes/registro-mensual?anio=${ANIO}&mes=${MES}`]: () =>
        Response.json(registro(MES, 0)),
    });

    expect(await screen.findByText('Sin atenciones en el período')).toBeInTheDocument();
  });

  it('si falla la API muestra el error y permite reintentar', async () => {
    const usuario = userEvent.setup();
    let llamadas = 0;
    abrirReportes({
      [`/api/v1/reportes/registro-mensual?anio=${ANIO}&mes=${MES}`]: () =>
        ++llamadas === 1 ? problema(500, 'Error interno') : Response.json(registro(MES, 3)),
    });

    expect(await screen.findByText('No se pudo cargar el reporte')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('table', { name: 'Registro de atenciones del mes' }),
    ).toBeInTheDocument();
  });

  it('el informe trimestral muestra Cumple con ícono y texto, y el modal edita las metas', async () => {
    const usuario = userEvent.setup();
    const cuerpos: unknown[] = [];
    abrirReportes({
      [`/api/v1/reportes/informe-trimestral?anio=${ANIO}`]: () => Response.json(TRIMESTRAL),
      '/api/v1/metas-sst': () => Response.json(METAS),
      'PUT /api/v1/metas-sst/enfermedad_comun': (init?: RequestInit) => {
        cuerpos.push(JSON.parse(String(init?.body)));
        return Response.json({ ...METAS[0], texto: '< 20%', limite: 20 });
      },
    });

    await usuario.click(await screen.findByRole('tab', { name: 'Informe trimestral SST' }));
    const tabla = await screen.findByRole('table', { name: 'Trimestre 4' });
    const filaComun = within(tabla).getByRole('row', { name: /Enfermedades comunes/ });
    expect(filaComun).toHaveTextContent('72,41 %');
    expect(
      within(filaComun).getByText('No').closest('.smo-cumple')?.querySelector('svg'),
    ).not.toBeNull();
    expect(
      within(tabla).getByRole('row', { name: /Enfermedades profesionales/ }),
    ).toHaveTextContent('Sí');

    await usuario.click(screen.getByRole('button', { name: 'Editar metas' }));
    const modal = await screen.findByRole('dialog', { name: 'Metas SST' });
    expect(within(modal).getAllByRole('group')).toHaveLength(5);
    expect(
      within(modal).getByLabelText('Límite (casos)', {
        selector: '#meta-limite-incidente_trabajo',
      }),
    ).toBeDisabled();

    const limite = within(modal).getByLabelText('Límite (%)');
    await usuario.clear(limite);
    await usuario.click(within(modal).getByRole('button', { name: 'Guardar metas' }));
    expect(await within(modal).findByText('Indica el límite de la meta')).toBeInTheDocument();

    await usuario.type(limite, '20');
    const texto = within(modal).getByLabelText('Texto (columna Meta SST)', {
      selector: '#meta-texto-enfermedad_comun',
    });
    await usuario.clear(texto);
    await usuario.type(texto, '< 20%');
    await usuario.click(within(modal).getByRole('button', { name: 'Guardar metas' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Metas SST' })).not.toBeInTheDocument(),
    );
    expect(cuerpos).toEqual([{ texto: '< 20%', tipo: 'porcentaje_maximo', limite: 20 }]);
  });
});
