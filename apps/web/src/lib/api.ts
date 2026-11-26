import { type RespuestaLogin, respuestaLoginSchema } from '@smo/shared';
import type { z } from 'zod';

const PREFIJO = '/api/v1';

/** Error devuelto por la API en formato Problem Details (RFC 9457). */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly titulo: string,
    readonly detalle?: string,
    readonly errores?: { campo: string; mensaje: string }[],
    /** Miembros extra del Problem Details (por ejemplo `intentosRestantes`, `bloqueadoHasta`). */
    readonly extensiones: Record<string, unknown> = {},
  ) {
    super(detalle ?? titulo);
    this.name = 'ErrorApi';
  }
}

// ------------------------------------------------------------------ sesión
// El access token vive SOLO en memoria (nunca en localStorage). El refresh token va en una
// cookie HttpOnly que el navegador envía solo a /api/v1/auth.

let accessToken: string | null = null;
let renovacionEnCurso: Promise<RespuestaLogin | null> | null = null;
let alExpirar: (() => void) | null = null;

export function establecerAccessToken(token: string | null): void {
  accessToken = token;
}

export function obtenerAccessToken(): string | null {
  return accessToken;
}

/** Función que se llama cuando la sesión venció y no se pudo renovar (va a /login). */
export function alExpirarSesion(funcion: (() => void) | null): void {
  alExpirar = funcion;
}

async function pedirRenovacion(): Promise<Response> {
  const hacer = () =>
    fetch(`${PREFIJO}/auth/refresh`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  // Web Locks: si hay varias pestañas, renuevan de una en una (cada una con la cookie vigente).
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('smo-renovar-sesion', hacer)
    : hacer();
}

/**
 * Renueva la sesión con la cookie. Si varias peticiones fallan a la vez, todas esperan la
 * MISMA petición de refresh (enviar dos con la misma cookie revocaría la sesión).
 */
export function renovarSesion(): Promise<RespuestaLogin | null> {
  renovacionEnCurso ??= (async () => {
    try {
      const respuesta = await pedirRenovacion();
      if (!respuesta.ok) {
        accessToken = null;
        return null;
      }
      const sesion = respuestaLoginSchema.parse(await respuesta.json());
      accessToken = sesion.accessToken;
      return sesion;
    } catch {
      accessToken = null;
      return null;
    } finally {
      renovacionEnCurso = null;
    }
  })();
  return renovacionEnCurso;
}

// ---------------------------------------------------------------- peticiones

function ejecutar(ruta: string, opciones?: RequestInit): Promise<Response> {
  const cabeceras = new Headers(opciones?.headers);
  cabeceras.set('Accept', 'application/json');
  if (accessToken) cabeceras.set('Authorization', `Bearer ${accessToken}`);
  return fetch(`${PREFIJO}${ruta}`, { ...opciones, headers: cabeceras });
}

async function errorDe(respuesta: Response): Promise<ErrorApi> {
  const {
    title,
    detail,
    errores,
    type: _type,
    status: _status,
    instance: _instance,
    ...extensiones
  } = (await respuesta.json().catch(() => ({}))) as {
    title?: string;
    detail?: string;
    errores?: { campo: string; mensaje: string }[];
    [clave: string]: unknown;
  };
  return new ErrorApi(
    respuesta.status,
    title ?? 'Error de comunicación con el servidor',
    detail,
    errores,
    extensiones,
  );
}

/**
 * Petición a la API con el access token. Ante un 401 intenta renovar la sesión UNA vez y
 * reintenta; si no se puede renovar, avisa (`alExpirarSesion`) y lanza el error.
 */
async function pedirRespuesta(ruta: string, opciones?: RequestInit): Promise<Response> {
  const tokenUsado = accessToken;
  let respuesta = await ejecutar(ruta, opciones);

  // Las rutas de /auth manejan su propio 401 (por ejemplo, credenciales incorrectas).
  if (respuesta.status === 401 && !ruta.startsWith('/auth/')) {
    // Si otra petición ya renovó mientras tanto, basta con reintentar con el token nuevo.
    const yaRenovada = accessToken !== null && accessToken !== tokenUsado;
    const renovada = yaRenovada || (await renovarSesion()) !== null;
    if (renovada) {
      respuesta = await ejecutar(ruta, opciones);
    }
    if (respuesta.status === 401) alExpirar?.();
  }

  if (!respuesta.ok) throw await errorDe(respuesta);
  return respuesta;
}

/** Hace una petición a la API y valida la respuesta con un esquema Zod de @smo/shared. */
export async function pedir<T extends z.ZodType>(
  ruta: string,
  schema: T,
  opciones?: RequestInit,
): Promise<z.output<T>> {
  const respuesta = await pedirRespuesta(ruta, opciones);
  return schema.parse(await respuesta.json());
}

/** Envía un cuerpo JSON (POST por defecto) y valida la respuesta con un esquema Zod. */
export function enviar<T extends z.ZodType>(
  ruta: string,
  schema: T,
  cuerpo: unknown,
  metodo = 'POST',
): Promise<z.output<T>> {
  return pedir(ruta, schema, {
    method: metodo,
    body: JSON.stringify(cuerpo),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Petición sin cuerpo de respuesta (por ejemplo, 204 No Content). */
export async function pedirSinRespuesta(ruta: string, opciones?: RequestInit): Promise<void> {
  await pedirRespuesta(ruta, opciones);
}

/** Nombre del archivo de `Content-Disposition: attachment; filename="…"`. */
function nombreDeArchivo(cabecera: string | null, porDefecto: string): string {
  const coincidencia = /filename="?([^";]+)"?/i.exec(cabecera ?? '');
  return coincidencia?.[1] ?? porDefecto;
}

/**
 * Descarga un archivo de la API (Excel, PDF) con el access token y lo guarda en el equipo.
 * Devuelve el nombre del archivo.
 */
export async function descargar(ruta: string, porDefecto = 'reporte'): Promise<string> {
  const respuesta = await pedirRespuesta(ruta);
  const nombre = nombreDeArchivo(respuesta.headers.get('Content-Disposition'), porDefecto);
  const url = URL.createObjectURL(await respuesta.blob());
  try {
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  return nombre;
}
