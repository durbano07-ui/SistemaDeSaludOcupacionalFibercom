import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { dayjs, ZONA_HORARIA } from '../lib/fecha';
import {
  problema,
  renderizarEn,
  sesionDe,
  USUARIO_ADMIN,
  USUARIO_MEDICO,
} from '../test/renderizar';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function abrirLogin(respuestaLogin: () => Response | Promise<Response>) {
  const vista = renderizarEn('/login', {
    respuestas: { 'POST /api/v1/auth/login': respuestaLogin },
  });
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  return { ...vista, usuario: userEvent.setup() };
}

const campoUsuario = () => screen.getByLabelText('Usuario');
const campoContrasena = () => screen.getByLabelText('Contraseña', { selector: 'input' });
const botonEntrar = () => screen.getByRole('button', { name: 'Iniciar sesión' });

/** Notificación de error (Carbon también pone role="alert", vacío, en el contador del campo). */
async function notificacion(): Promise<HTMLElement> {
  const alertas = await screen.findAllByRole('alert');
  const aviso = alertas.find((a) => a.classList.contains('cds--inline-notification'));
  if (!aviso) throw new Error('No se mostró la notificación de error');
  return aviso;
}

describe('Pantalla de login', () => {
  it('muestra la tarjeta, el panel informativo y la ayuda, sin usuarios de prueba', async () => {
    await abrirLogin(() => sesionDe(USUARIO_MEDICO));

    expect(screen.getByText('Sistema de Medicina Ocupacional')).toBeInTheDocument();
    expect(
      screen.getByText('¿Olvidaste tu contraseña? Pide al administrador que la restablezca.'),
    ).toBeInTheDocument();
    const panel = screen.getByRole('complementary', { name: 'Acerca del sistema' });
    expect(
      within(panel).getByRole('heading', {
        name: 'Salud ocupacional de FIBERCOM, en un solo lugar',
      }),
    ).toBeInTheDocument();
    expect(within(panel).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText(/usuarios de prueba/i)).not.toBeInTheDocument();
  });

  it('el botón de ojo muestra y oculta la contraseña', async () => {
    const { usuario } = await abrirLogin(() => sesionDe(USUARIO_MEDICO));

    expect(campoContrasena()).toHaveAttribute('type', 'password');
    await usuario.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campoContrasena()).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeInTheDocument();
  });

  it('sin datos muestra "Faltan datos" y no llama a la API', async () => {
    const { usuario, fetchSimulado } = await abrirLogin(() => sesionDe(USUARIO_MEDICO));

    await usuario.click(botonEntrar());

    const alerta = await notificacion();
    expect(alerta).toHaveTextContent('Faltan datos');
    expect(alerta).toHaveTextContent('Ingresa tu usuario y contraseña.');
    expect(screen.getByText('Ingresa tu usuario')).toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalledWith('/api/v1/auth/login', expect.anything());
  });

  it('con credenciales incorrectas muestra el error y los intentos restantes', async () => {
    const { usuario } = await abrirLogin(() =>
      problema(401, 'Usuario o contraseña incorrectos', { intentosRestantes: 3 }),
    );

    await usuario.type(campoUsuario(), 'medico');
    await usuario.type(campoContrasena(), 'mala{Enter}');

    const alerta = await notificacion();
    expect(alerta).toHaveTextContent('Usuario o contraseña incorrectos');
    expect(alerta).toHaveTextContent('Te quedan 3 intentos antes de que la cuenta se bloquee.');
    expect(campoUsuario()).toBeEnabled();
  });

  it('con la cuenta bloqueada muestra la hora de desbloqueo y deshabilita los campos', async () => {
    const hasta = new Date(Date.now() + 15 * 60_000);
    const { usuario } = await abrirLogin(() =>
      problema(423, 'Cuenta bloqueada.', { bloqueadoHasta: hasta.toISOString() }),
    );

    await usuario.type(campoUsuario(), 'medico');
    await usuario.type(campoContrasena(), 'mala');
    await usuario.click(botonEntrar());

    const alerta = await notificacion();
    expect(alerta).toHaveTextContent('Cuenta bloqueada');
    expect(alerta).toHaveTextContent(dayjs(hasta).tz(ZONA_HORARIA).format('HH:mm'));
    expect(campoUsuario()).toBeDisabled();
    expect(campoContrasena()).toBeDisabled();
    expect(botonEntrar()).toBeDisabled();
  });

  it('no permite doble envío mientras espera la respuesta', async () => {
    let responder: (r: Response) => void = () => undefined;
    const { usuario, fetchSimulado } = await abrirLogin(
      () => new Promise<Response>((resolver) => (responder = resolver)),
    );

    await usuario.type(campoUsuario(), 'medico');
    await usuario.type(campoContrasena(), 'Correcta.2026');
    await usuario.click(botonEntrar());

    const boton = await screen.findByRole('button', { name: /Verificando/ });
    expect(boton).toBeDisabled();
    await usuario.click(boton);
    await usuario.keyboard('{Enter}');
    const llamadas = fetchSimulado.mock.calls.filter(([url]) => url === '/api/v1/auth/login');
    expect(llamadas).toHaveLength(1);

    responder(sesionDe(USUARIO_MEDICO));
    expect(await screen.findByRole('button', { name: 'Pacientes' })).toBeInTheDocument();
  });

  it('el médico entra a su layout y el administrador al suyo', async () => {
    const { usuario, router } = await abrirLogin(() => sesionDe(USUARIO_ADMIN));

    await usuario.type(campoUsuario(), 'admin');
    await usuario.type(campoContrasena(), 'Correcta.2026{Enter}');

    expect(await screen.findByRole('heading', { name: 'Estadísticas' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/estadisticas');
  });
});
