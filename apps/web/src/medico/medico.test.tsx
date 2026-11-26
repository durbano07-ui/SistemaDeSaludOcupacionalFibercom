import type { AtencionListada, ResumenPaciente } from '@smo/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ultimosMeses } from '../lib/fecha';
import { renderizarEn, USUARIO_MEDICO } from '../test/renderizar';

afterEach(() => {
  vi.unstubAllGlobals();
});

const MES = ultimosMeses(1)[0]!;

function resumen(cambios: Partial<ResumenPaciente> = {}): ResumenPaciente {
  return {
    id: 5,
    apellidos: 'Chimbo Guamán',
    nombres: 'Luis Alberto',
    cedula: '0250010015',
    edad: 41,
    sexo: 'hombre',
    cargo: 'Técnico instalador',
    departamento: 'Operaciones técnicas',
    base: 'Guaranda',
    alergias: 'Penicilina',
    condiciones: [{ tipo: 'discapacidad', nombre: 'Discapacidad física', detalle: '40 %' }],
    casoAbierto: {
      id: 9,
      cie10: { codigo: 'M54.5', descripcion: 'Lumbago no especificado' },
      fechaApertura: '2026-11-02',
    },
    ...cambios,
  };
}

function atencionListada(n: number): AtencionListada {
  return {
    id: n,
    codigo: `ATE-2026-${String(n).padStart(4, '0')}`,
    fecha: `2026-${n > 6 ? '10' : '11'}-${String(10 + (n % 15)).padStart(2, '0')}T14:00:00.000Z`,
    tipoAtencion: n === 1 ? 'primera' : 'subsecuente',
    paciente: { id: 5, apellidos: 'Chimbo Guamán', nombres: 'Luis Alberto', cedula: '0250010015' },
    cargo: 'Técnico instalador',
    motivo: `Motivo ${n}`,
    diagnostico: { codigo: 'M54.5', descripcion: 'Lumbago no especificado' },
    tieneReceta: n % 2 === 0,
    tieneCertificado: n === 3,
  };
}

/** Pantalla del médico con el paciente 5 ya seleccionado (?paciente=5). */
function abrirPaciente(paciente: ResumenPaciente, respuestas = {}) {
  return renderizarEn('/medico?paciente=5', {
    usuario: USUARIO_MEDICO,
    respuestas: {
      '/api/v1/pacientes/5': () => Response.json(paciente),
      [`/api/v1/pacientes/5/atenciones?mes=${MES}`]: () =>
        Response.json({ mes: MES, atenciones: [atencionListada(1), atencionListada(3)] }),
      '/api/v1/cie10?q=S61': () =>
        Response.json([{ codigo: 'S61.0', descripcion: 'Herida de dedo(s) de la mano' }]),
      '/api/v1/cie10?q=M54': () =>
        Response.json([{ codigo: 'M54.5', descripcion: 'Lumbago no especificado' }]),
      '/api/v1/medicamentos?q=amox': () =>
        Response.json([
          {
            id: 1,
            nombre: 'Amoxicilina',
            presentacion: 'Cápsula',
            concentracion: '500 mg',
            grupoFarmacologico: 'Penicilinas',
          },
        ]),
      ...respuestas,
    },
  });
}

async function abrirNuevaAtencion() {
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole('button', { name: 'Nueva atención' }));
  const modal = await screen.findByRole('dialog', { name: 'Nueva atención' });
  return { usuario, modal };
}

async function elegirEnCombo(
  usuario: ReturnType<typeof userEvent.setup>,
  nombre: string,
  texto: string,
  opcion: RegExp,
) {
  await usuario.type(screen.getByRole('combobox', { name: nombre }), texto);
  await usuario.click(await screen.findByRole('option', { name: opcion }, { timeout: 2000 }));
}

describe('Búsqueda y tarjeta del paciente', () => {
  it('busca desde 2 caracteres, selecciona y muestra la tarjeta con alergias en rojo', async () => {
    const usuario = userEvent.setup();
    renderizarEn('/medico', {
      usuario: USUARIO_MEDICO,
      respuestas: {
        '/api/v1/pacientes?q=chim': () =>
          Response.json([
            {
              id: 5,
              apellidos: 'Chimbo Guamán',
              nombres: 'Luis Alberto',
              cedula: '0250010015',
              base: 'Guaranda',
            },
          ]),
        '/api/v1/pacientes/5': () => Response.json(resumen()),
        [`/api/v1/pacientes/5/atenciones?mes=${MES}`]: () =>
          Response.json({ mes: MES, atenciones: [] }),
      },
    });

    await usuario.click(await screen.findByRole('button', { name: 'Pacientes' }));
    const campo = screen.getByLabelText('Buscar por cédula, nombres o apellidos');
    await usuario.type(campo, 'c');
    expect(screen.getByText('Escribe al menos 2 caracteres para buscar.')).toBeInTheDocument();
    await usuario.type(campo, 'him');

    const tabla = await screen.findByRole('table', { name: 'Pacientes encontrados' });
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Apellidos y nombres', 'Base', 'Acción']);
    // La cédula no se muestra en la tabla
    expect(within(tabla).queryByText('0250010015')).not.toBeInTheDocument();
    await usuario.click(within(tabla).getByRole('button', { name: /Seleccionar a Chimbo/ }));

    const tarjeta = await screen.findByRole('region', { name: 'Paciente seleccionado' });
    expect(within(tarjeta).getByText('Chimbo Guamán Luis Alberto')).toBeInTheDocument();
    expect(within(tarjeta).getByRole('note')).toHaveTextContent('Alergias: Penicilina');
    expect(within(tarjeta).getByText('Discapacidad física (40 %)')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/M54\.5/)).toBeInTheDocument();
    expect(await screen.findByText(/Sin atenciones en/)).toBeInTheDocument();
    for (const pestana of [
      'Atenciones',
      'Historia clínica',
      'Fichas y matrices',
      'Consultas anteriores',
    ]) {
      expect(screen.getByRole('tab', { name: pestana })).toBeInTheDocument();
    }
  });

  it('muestra "Sin resultados" cuando la búsqueda no encuentra a nadie', async () => {
    const usuario = userEvent.setup();
    renderizarEn('/medico', {
      usuario: USUARIO_MEDICO,
      respuestas: { '/api/v1/pacientes?q=zz': () => Response.json([]) },
    });

    await usuario.click(await screen.findByRole('button', { name: 'Pacientes' }));
    await usuario.type(
      screen.getByLabelText('Buscar por cédula, nombres o apellidos'),
      'zz{Enter}',
    );

    expect(await screen.findByText('Sin resultados para «zz».')).toBeInTheDocument();
  });
});

describe('Pestaña Atenciones', () => {
  it('lista las atenciones del mes con "Ver receta" y "Ver certificado"', async () => {
    abrirPaciente(resumen());

    const tabla = await screen.findByRole('table', { name: /Atenciones de/ });
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual([
      'Nombre del paciente',
      'Cédula',
      'Cargo',
      'Motivo',
      'Diagnóstico',
      'Receta',
      'Certificado',
    ]);
    expect(within(tabla).getByRole('link', { name: 'Ver certificado' })).toBeInTheDocument();
  });

  it('sin el permiso "atenciones" no aparece "Nueva atención"', async () => {
    renderizarEn('/medico?paciente=5', {
      usuario: { ...USUARIO_MEDICO, permisos: ['datos_clinicos'] },
      respuestas: {
        '/api/v1/pacientes/5': () => Response.json(resumen()),
        [`/api/v1/pacientes/5/atenciones?mes=${MES}`]: () =>
          Response.json({ mes: MES, atenciones: [] }),
      },
    });

    expect(await screen.findByText(/Sin atenciones en/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva atención' })).not.toBeInTheDocument();
  });
});

describe('Modal Nueva atención', () => {
  it('sin caso abierto, "Subsecuente" está deshabilitada y avisa que se abrirá un caso', async () => {
    abrirPaciente(resumen({ casoAbierto: null }));
    const { modal } = await abrirNuevaAtencion();

    expect(within(modal).getByRole('radio', { name: 'Subsecuente' })).toBeDisabled();
    expect(within(modal).getByRole('radio', { name: 'Primera' })).toBeChecked();
    expect(
      within(modal).getByText('Se abrirá un caso nuevo con el diagnóstico elegido.'),
    ).toBeInTheDocument();
  });

  it('con caso abierto explica qué pasará y sugiere Subsecuente si el CIE-10 coincide', async () => {
    abrirPaciente(resumen());
    const { usuario, modal } = await abrirNuevaAtencion();

    expect(within(modal).getByRole('radio', { name: 'Subsecuente' })).toBeEnabled();
    expect(
      within(modal).getByText(
        'Se cerrará el caso abierto M54.5 y se abrirá uno nuevo con el diagnóstico elegido.',
      ),
    ).toBeInTheDocument();

    await elegirEnCombo(usuario, 'Diagnóstico CIE-10', 'M54', /M54\.5/);
    await usuario.click(within(modal).getByRole('button', { name: 'Cambiar a Subsecuente' }));

    expect(within(modal).getByRole('radio', { name: 'Subsecuente' })).toBeChecked();
    expect(within(modal).getByText(/Se sumará al caso abierto M54\.5/)).toBeInTheDocument();
  });

  it('con un CIE-10 S o T aparece "¿Ocurrió en el trabajo?" y es obligatoria', async () => {
    abrirPaciente(resumen());
    const { usuario, modal } = await abrirNuevaAtencion();
    expect(within(modal).queryByText('¿Ocurrió en el trabajo?')).not.toBeInTheDocument();

    await elegirEnCombo(usuario, 'Diagnóstico CIE-10', 'S61', /S61\.0/);

    const pregunta = await within(modal).findByRole('group', { name: '¿Ocurrió en el trabajo?' });
    expect(within(pregunta).getByRole('radio', { name: 'Sí' })).toBeInTheDocument();
    await usuario.type(within(modal).getByLabelText('Motivo'), 'Corte en un dedo');
    await usuario.type(within(modal).getByLabelText('Enfermedad actual'), 'Herida con herramienta');
    await usuario.click(screen.getByRole('button', { name: 'Guardar atención' }));
    expect(await within(modal).findByText('Indica si ocurrió en el trabajo')).toBeInTheDocument();
  });

  it('alerta en rojo si un medicamento coincide con las alergias, con "Recetar de todos modos"', async () => {
    abrirPaciente(resumen({ alergias: 'Penicilína' }));
    const { usuario, modal } = await abrirNuevaAtencion();

    await usuario.click(within(modal).getByRole('button', { name: 'Agregar medicamento' }));
    await elegirEnCombo(usuario, 'Medicamento', 'amox', /Amoxicilina/);

    const alerta = await within(modal).findByText('Alerta de alergia');
    const notificacion = alerta.closest('.cds--inline-notification')!;
    expect(notificacion).toHaveClass('cds--inline-notification--error');
    expect(notificacion).toHaveTextContent('Coincide con: Amoxicilina (grupo farmacológico)');
    expect(notificacion.querySelector('svg')).not.toBeNull();
    expect(
      within(modal).getByRole('checkbox', { name: 'Recetar de todos modos' }),
    ).not.toBeChecked();
  });

  it('valores de signos vitales fuera de lo normal muestran una alerta (sin bloquear)', async () => {
    abrirPaciente(resumen());
    const { usuario, modal } = await abrirNuevaAtencion();

    await usuario.click(within(modal).getByRole('button', { name: 'Signos vitales (opcional)' }));
    await usuario.type(within(modal).getByLabelText('Temperatura (°C)'), '38,5');

    expect(await within(modal).findByText('Fiebre (38,5 °C)')).toBeInTheDocument();
  });

  it('el certificado muestra la fecha de fin calculada', async () => {
    abrirPaciente(resumen());
    const { usuario, modal } = await abrirNuevaAtencion();

    await usuario.click(
      within(modal).getByRole('checkbox', { name: 'Emitir certificado de reposo' }),
    );
    const dias = within(modal).getByLabelText('Días de reposo');
    await usuario.clear(dias);
    await usuario.type(dias, '3');
    const inicio = within(modal).getByLabelText('Fecha de inicio');
    await usuario.clear(inicio);
    await usuario.type(inicio, '2026-11-26');

    expect(within(modal).getByText('28/11/2026')).toBeInTheDocument();
  });
});

describe('Pestaña Consultas anteriores', () => {
  it('pagina de 10 en 10 con "1–10 de 12" y Anterior/Siguiente', async () => {
    const usuario = userEvent.setup();
    const todas = Array.from({ length: 12 }, (_, i) => atencionListada(12 - i));
    abrirPaciente(resumen(), {
      '/api/v1/pacientes/5/atenciones/historial?pagina=1&tamano=10': () =>
        Response.json({ pagina: 1, tamano: 10, total: 12, atenciones: todas.slice(0, 10) }),
      '/api/v1/pacientes/5/atenciones/historial?pagina=2&tamano=10': () =>
        Response.json({ pagina: 2, tamano: 10, total: 12, atenciones: todas.slice(10) }),
    });

    await usuario.click(await screen.findByRole('tab', { name: 'Consultas anteriores' }));

    const tabla = await screen.findByRole('table', { name: 'Consultas anteriores' });
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Paciente', 'Cédula', 'Fecha', 'Motivo', 'Diagnóstico', 'Receta', 'Certificado']);
    expect(within(tabla).getAllByRole('row')).toHaveLength(11);
    expect(within(tabla).queryByRole('button')).not.toBeInTheDocument();
    const paginacion = screen.getByRole('navigation', {
      name: 'Paginación de consultas anteriores',
    });
    expect(paginacion).toHaveTextContent('1–10 de 12');
    expect(within(paginacion).getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await usuario.click(within(paginacion).getByRole('button', { name: 'Siguiente' }));

    expect(await within(paginacion).findByText('11–12 de 12')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Consultas anteriores' })).getAllByRole('row'),
    ).toHaveLength(3);
    expect(within(paginacion).getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(within(paginacion).getByRole('button', { name: 'Anterior' })).toBeEnabled();
    // Solo la fecha (sin hora)
    expect(screen.getByText('12/11/2026')).toBeInTheDocument();
  });
});
