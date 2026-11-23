import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderizarEn } from './test/renderizar';

function simularApi(respuesta: Response | Promise<never>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (respuesta instanceof Response ? Promise.resolve(respuesta) : respuesta)),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Página de inicio', () => {
  it('muestra que la API y la base de datos responden', async () => {
    simularApi(Response.json({ estado: 'ok', baseDatos: 'ok', hora: '2026-11-23T20:00:00.000Z' }));

    renderizarEn('/');

    expect(await screen.findByText('La API responde')).toBeInTheDocument();
    expect(screen.getByText('La base de datos responde')).toBeInTheDocument();
    expect(screen.getByText(/23\/11\/2026 15:00:00/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/v1/salud', expect.anything());
  });

  it('avisa con ícono y texto cuando la base de datos no responde', async () => {
    simularApi(
      Response.json({ estado: 'ok', baseDatos: 'error', hora: '2026-11-23T20:00:00.000Z' }),
    );

    renderizarEn('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('La base de datos no responde');
    expect(screen.getByText('La API responde')).toBeInTheDocument();
  });

  it('avisa cuando la API no responde', async () => {
    simularApi(Promise.reject(new TypeError('Failed to fetch')));

    renderizarEn('/');

    const alertas = await screen.findAllByRole('alert');
    expect(alertas.map((a) => a.textContent)).toEqual([
      'La API no responde',
      'La base de datos no responde',
    ]);
  });
});

describe('Layout de administrador', () => {
  it('tiene 7 opciones laterales y marca la activa', async () => {
    renderizarEn('/admin/usuarios');

    const navegacion = screen.getByRole('navigation', { name: 'Navegación del administrador' });
    const enlaces = within(navegacion).getAllByRole('link');
    expect(enlaces.map((e) => e.textContent)).toEqual([
      'Estadísticas',
      'Usuarios',
      'Departamentos y cargos',
      'Bases',
      'Rendimiento',
      'Base de datos',
      'Logs',
    ]);
    expect(within(navegacion).getByRole('link', { name: 'Usuarios' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configuración' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeInTheDocument();
  });
});

describe('Layout de médico', () => {
  it('muestra la navegación superior, las acciones y la tarjeta de paciente', async () => {
    renderizarEn('/medico');

    const navegacion = screen.getByRole('navigation', { name: 'Navegación del médico' });
    expect(
      within(navegacion)
        .getAllByRole('link')
        .map((e) => e.textContent),
    ).toEqual(['Pacientes', 'Reportes']);
    expect(await screen.findByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
    expect(within(navegacion).getByRole('link', { name: 'Pacientes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('No se ha seleccionado ningún paciente')).toBeInTheDocument();
    for (const accion of ['Otras funciones', 'Configuración', 'Perfil', 'Salir']) {
      expect(screen.getByRole('button', { name: accion })).toBeInTheDocument();
    }
  });
});
