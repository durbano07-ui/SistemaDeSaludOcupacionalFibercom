import type { z } from 'zod';

const PREFIJO = '/api/v1';

/** Error devuelto por la API en formato Problem Details (RFC 9457). */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly titulo: string,
    readonly detalle?: string,
    readonly errores?: { campo: string; mensaje: string }[],
  ) {
    super(detalle ?? titulo);
    this.name = 'ErrorApi';
  }
}

/** Hace una petición a la API y valida la respuesta con un esquema Zod de @smo/shared. */
export async function pedir<T extends z.ZodType>(
  ruta: string,
  schema: T,
  opciones?: RequestInit,
): Promise<z.output<T>> {
  const respuesta = await fetch(`${PREFIJO}${ruta}`, {
    ...opciones,
    headers: { Accept: 'application/json', ...opciones?.headers },
  });

  if (!respuesta.ok) {
    const problema = (await respuesta.json().catch(() => ({}))) as {
      title?: string;
      detail?: string;
      errores?: { campo: string; mensaje: string }[];
    };
    throw new ErrorApi(
      respuesta.status,
      problema.title ?? 'Error de comunicación con el servidor',
      problema.detail,
      problema.errores,
    );
  }

  return schema.parse(await respuesta.json());
}
