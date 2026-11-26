import { DocumentTasks, Locked, Stethoscope } from '@carbon/icons-react';
import {
  Button,
  Form,
  Heading,
  InlineLoading,
  InlineNotification,
  PasswordInput,
  Section,
  Stack,
  TextInput,
} from '@carbon/react';
import { type DatosLogin, loginSchema } from '@smo/shared';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { inicioDeRol } from '../auth/contexto';
import { useAuth } from '../auth/useAuth';
import { Logo } from '../componentes/Logo';
import { ErrorApi } from '../lib/api';
import { dayjs, ZONA_HORARIA } from '../lib/fecha';
import { useFormulario } from '../lib/formulario';

interface Aviso {
  titulo: string;
  detalle: string;
}

const PUNTOS = [
  { icono: Stethoscope, texto: 'Atenciones, historia clínica y recetas de cada trabajador.' },
  { icono: DocumentTasks, texto: 'Fichas de evaluación, matrices y reportes al día.' },
  { icono: Locked, texto: 'Acceso según tu rol, con registro de cada acción.' },
] as const;

function textoIntentos(restantes: unknown): string {
  if (typeof restantes !== 'number') return 'Revisa los datos e inténtalo de nuevo.';
  return restantes === 1
    ? 'Te queda 1 intento antes de que la cuenta se bloquee.'
    : `Te quedan ${restantes} intentos antes de que la cuenta se bloquee.`;
}

function avisoDeError(error: unknown): { aviso: Aviso; bloqueadoHasta?: Date } {
  if (!(error instanceof ErrorApi)) {
    return {
      aviso: {
        titulo: 'No se pudo conectar',
        detalle: 'Revisa tu conexión e inténtalo de nuevo.',
      },
    };
  }
  switch (error.status) {
    case 401:
      return {
        aviso: {
          titulo: 'Usuario o contraseña incorrectos',
          detalle: textoIntentos(error.extensiones.intentosRestantes),
        },
      };
    case 423: {
      const valor = error.extensiones.bloqueadoHasta;
      const hasta = typeof valor === 'string' ? new Date(valor) : undefined;
      return {
        aviso: {
          titulo: 'Cuenta bloqueada',
          detalle: hasta
            ? `Por seguridad, podrás intentarlo de nuevo a las ${dayjs(hasta).tz(ZONA_HORARIA).format('HH:mm')}.`
            : 'Por seguridad, espera unos minutos antes de intentarlo de nuevo.',
        },
        bloqueadoHasta: hasta,
      };
    }
    case 400:
      return { aviso: { titulo: 'Faltan datos', detalle: 'Ingresa tu usuario y contraseña.' } };
    case 429:
      return {
        aviso: {
          titulo: 'Demasiados intentos',
          detalle: error.detalle ?? 'Espera un minuto y vuelve a intentarlo.',
        },
      };
    default:
      return {
        aviso: {
          titulo: 'No se pudo iniciar sesión',
          detalle: 'Ocurrió un problema en el servidor. Inténtalo de nuevo en unos minutos.',
        },
      };
  }
}

/** Pantalla de inicio de sesión. */
export function Login() {
  const { iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [bloqueadoHasta, setBloqueadoHasta] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useFormulario(loginSchema, {
    mode: 'onSubmit',
    defaultValues: { usuario: '', contrasena: '' },
  });

  // Al llegar la hora de desbloqueo se vuelven a habilitar los campos.
  useEffect(() => {
    if (!bloqueadoHasta) return;
    const espera = Math.max(bloqueadoHasta.getTime() - Date.now(), 0);
    const temporizador = setTimeout(() => {
      setBloqueadoHasta(null);
      setAviso(null);
    }, espera);
    return () => clearTimeout(temporizador);
  }, [bloqueadoHasta]);

  const bloqueado = bloqueadoHasta !== null;

  const entrar = async (datos: DatosLogin) => {
    setAviso(null);
    try {
      const usuario = await iniciarSesion(datos);
      const desde = (ubicacion.state as { desde?: string } | null)?.desde;
      await navegar(desde && desde !== '/' ? desde : inicioDeRol(usuario.rol.codigo), {
        replace: true,
      });
    } catch (error) {
      const resultado = avisoDeError(error);
      setAviso(resultado.aviso);
      if (resultado.bloqueadoHasta) setBloqueadoHasta(resultado.bloqueadoHasta);
    }
  };

  const faltanDatos = () =>
    setAviso({ titulo: 'Faltan datos', detalle: 'Ingresa tu usuario y contraseña.' });

  return (
    <div className="smo-login">
      <main className="smo-login__principal">
        <Section as="div" className="smo-login__tarjeta">
          <Logo />
          <Heading className="smo-login__titulo">Iniciar sesión</Heading>
          <p className="smo-login__subtitulo">Sistema de Medicina Ocupacional</p>

          <Form noValidate onSubmit={handleSubmit(entrar, faltanDatos)} aria-label="Iniciar sesión">
            <Stack gap={6}>
              {aviso && (
                <InlineNotification
                  kind="error"
                  role="alert"
                  title={aviso.titulo}
                  subtitle={aviso.detalle}
                  hideCloseButton
                  lowContrast
                />
              )}
              <TextInput
                id="login-usuario"
                labelText="Usuario"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={bloqueado}
                invalid={Boolean(errors.usuario)}
                invalidText={errors.usuario?.message}
                {...register('usuario')}
              />
              <PasswordInput
                id="login-contrasena"
                labelText="Contraseña"
                autoComplete="current-password"
                showPasswordLabel="Mostrar contraseña"
                hidePasswordLabel="Ocultar contraseña"
                disabled={bloqueado}
                invalid={Boolean(errors.contrasena)}
                invalidText={errors.contrasena?.message}
                {...register('contrasena')}
              />
              <Button
                type="submit"
                className="smo-login__boton"
                disabled={isSubmitting || bloqueado}
              >
                {isSubmitting ? <InlineLoading description="Verificando…" /> : 'Iniciar sesión'}
              </Button>
              <p className="smo-login__ayuda">
                ¿Olvidaste tu contraseña? Pide al administrador que la restablezca.
              </p>
            </Stack>
          </Form>
        </Section>
      </main>

      <aside className="smo-login__panel" aria-label="Acerca del sistema">
        <span className="smo-login__barra" aria-hidden="true" />
        <h2 className="smo-login__panel-titulo">Salud ocupacional de FIBERCOM, en un solo lugar</h2>
        <p className="smo-login__panel-texto">
          El consultorio médico de la empresa trabaja aquí: la información de salud de cada
          trabajador, ordenada, segura y disponible cuando se necesita.
        </p>
        <ul className="smo-login__puntos">
          {PUNTOS.map(({ icono: Icono, texto }) => (
            <li key={texto}>
              <Icono size={24} aria-hidden="true" />
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
