import type { CodigoPermiso, CodigoRol } from '@smo/shared';

/** Usuario autenticado en la petición en curso (lo deja JwtAuthGuard en `req.usuario`). */
export interface UsuarioPeticion {
  idUsuario: number;
  idSesion: bigint;
  rol: CodigoRol;
  /** Permisos efectivos: los del rol ∪ los extra del usuario. */
  permisos: CodigoPermiso[];
}

/** Contenido del access token. `sub` y `sid` van como texto (estándar JWT; `sid` es BIGINT). */
export interface PayloadAccessToken {
  sub: string;
  sid: string;
  rol: CodigoRol;
}
