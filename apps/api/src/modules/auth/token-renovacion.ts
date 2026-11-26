import { createHash, randomBytes } from 'node:crypto';

/** Nombre de la cookie HttpOnly que lleva el refresh token. */
export const COOKIE_RENOVACION = 'smo_renovacion';
/** La cookie solo viaja a las rutas de autenticación. */
export const RUTA_COOKIE_RENOVACION = '/api/v1/auth';

/** SHA-256 en hexadecimal (64 caracteres, como `sesion.token_renovacion_hash`). */
export function sha256(texto: string): string {
  return createHash('sha256').update(texto).digest('hex');
}

/**
 * Refresh token: `<id_sesion>.<32 bytes aleatorios en base64url>`. En la base solo se guarda
 * el SHA-256 del token completo. El id de sesión permite encontrar la sesión cuando llega un
 * token ya rotado (reutilización) y revocarla, aunque la base solo guarde el hash vigente.
 */
export function generarTokenRenovacion(idSesion: bigint): { token: string; hash: string } {
  const token = `${idSesion}.${randomBytes(32).toString('base64url')}`;
  return { token, hash: sha256(token) };
}

/** Lee un refresh token; devuelve `null` si no tiene el formato esperado. */
export function leerTokenRenovacion(token: unknown): { idSesion: bigint; hash: string } | null {
  if (typeof token !== 'string') return null;
  const coincidencia = /^(\d{1,19})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!coincidencia?.[1]) return null;
  return { idSesion: BigInt(coincidencia[1]), hash: sha256(token) };
}
