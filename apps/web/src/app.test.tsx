import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderizarEn, USUARIO_ADMIN, USUARIO_MEDICO } from './test/renderizar';

afterEach(() => {
  vi.unstubAllGlobals();
});

const salud = (baseDatos: 'ok' | 'error') => () =>
  Response.json({ estado: 'ok', baseDatos, hora: '2026-11-23T20:00:00.000Z' });

describe('Página de estado', () => {
  it('muestra que la API y la base de datos responden', async () => {
    const { fetchSimulado } = renderizarEn('/estado', {
      respuestas: { '/api/v1/salud': salud('ok') },
    });

    expect(await screen.findByText('La API responde')).toBeInTheDocument();
    expect(screen.getByText('La base de datos responde')).toBeInTheDocument();
    expect(screen.getByText(/23\/11\/2026 15:00:00/)).toBeInTheDocument();
    expect(fetchSimulado).toHaveBeenCalledWith('/api/v1/salud', expect.anything());
  });

  it('avisa con ícono y texto cuando la base de datos no responde', async () => {
    renderizarEn('/estado', { respuestas: { '/api/v1/salud': salud('error') } });

    expect(await screen.findByRole('alert')).toHaveTextContent('La base de datos no responde');
    expect(screen.getByText('La API responde')).toBeInTheDocument();
  });

  it('avisa cuando la API no responde', async () => {
    renderizarEn('/estado', {
      respuestas: { '/api/v1/salud': () => Promise.reject(new TypeError('Failed to fetch')) },
    });

    const alertas = await screen.findAllByRole('alert');
    expect(alertas.map((a) => a.textContent)).toEqual([
      'La API no responde',
      'La base de datos no responde',
    ]);
  });
});

describe('Rutas protegidas', () => {
  it('sin sesión lleva a /login', async () => {
    const { router } = renderizarEn('/medico/pacientes');

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('el médico que entra a /admin vuelve a su layout', async () => {
    const { router } = renderizarEn('/admin/usuarios', { usuario: USUARIO_MEDICO });

    expect(await screen.findByRole('button', { name: 'Pacientes' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/medico');
  });

  it('con sesión, /login lleva al inicio del rol', async () => {
    const { router } = renderizarEn('/login', { usuario: USUARIO_ADMIN });

    expect(await screen.findByRole('heading', { name: 'Estadísticas' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/estadisticas');
  });
});

describe('Layout de administrador', () => {
  it('tiene 7 opciones laterales y marca la activa', async () => {
    renderizarEn('/admin/usuarios', { usuario: USUARIO_ADMIN });

    const navegacion = await screen.findByRole('navigation', {
      name: 'Navegación del administrador',
    });
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

  it('el perfil muestra el nombre y el rol reales y "Cerrar sesión" vuelve a /login', async () => {
    const usuario = userEvent.setup();
    const { router, fetchSimulado } = renderizarEn('/admin', { usuario: USUARIO_ADMIN });

    await usuario.click(await screen.findByRole('button', { name: 'Perfil' }));
    expect(screen.getByText('Andrea Sofía Prueba Administradora')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(fetchSimulado).toHaveBeenCalledWith(
      '/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('Pantalla del médico', () => {
  it('muestra la tarjeta vacía, los botones Pacientes y Reportes y las acciones del encabezado', async () => {
    renderizarEn('/medico', { usuario: USUARIO_MEDICO });

    expect(await screen.findByRole('button', { name: 'Pacientes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByText('No se ha seleccionado ningún paciente')).toBeInTheDocument();
    // Sin paciente seleccionado no hay pestañas
    expect(screen.queryByRole('tab', { name: 'Atenciones' })).not.toBeInTheDocument();
    for (const accion of ['Otras funciones', 'Configuración', 'Perfil', 'Salir']) {
      expect(screen.getByRole('button', { name: accion })).toBeInTheDocument();
    }
  });

  it('"Reportes" abre la pantalla de reportes sin la tarjeta del paciente', async () => {
    const usuario = userEvent.setup();
    const { router } = renderizarEn('/medico', { usuario: USUARIO_MEDICO });

    await usuario.click(await screen.findByRole('button', { name: 'Reportes' }));

    expect(await screen.findByRole('tab', { name: 'Registro mensual' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/medico/reportes');
    expect(screen.queryByText('No se ha seleccionado ningún paciente')).not.toBeInTheDocument();
  });

  it('los enlaces anteriores (/medico/pacientes) llevan a la pantalla del médico', async () => {
    const { router } = renderizarEn('/medico/pacientes', { usuario: USUARIO_MEDICO });

    expect(await screen.findByRole('button', { name: 'Pacientes' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/medico');
  });

  it('el personal de apoyo solo ve lo que sus permisos permiten', async () => {
    const apoyo = {
      ...USUARIO_MEDICO,
      id: 3,
      rol: { codigo: 'apoyo' as const, nombre: 'Personal de apoyo' },
      permisos: ['reportes' as const],
    };
    renderizarEn('/medico', { usuario: apoyo });

    expect(await screen.findByRole('button', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pacientes' })).not.toBeInTheDocument();
    expect(screen.queryByText('No se ha seleccionado ningún paciente')).not.toBeInTheDocument();
  });

  it('sin permisos clínicos ni de reportes avisa que no hay opciones', async () => {
    const sinPermisos = { ...USUARIO_MEDICO, id: 4, permisos: [] };
    renderizarEn('/medico', { usuario: sinPermisos });

    expect(await screen.findByRole('heading', { name: 'Sin acceso' })).toBeInTheDocument();
  });

  it('"Salir" cierra la sesión y vuelve a /login', async () => {
    const usuario = userEvent.setup();
    const { router, fetchSimulado } = renderizarEn('/medico', { usuario: USUARIO_MEDICO });

    await usuario.click(await screen.findByRole('button', { name: 'Salir' }));

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(fetchSimulado).toHaveBeenCalledWith(
      '/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
