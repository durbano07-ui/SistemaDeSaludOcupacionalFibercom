import { AsyncLocalStorage } from 'node:async_hooks';

import type { NextFunction, Request, Response } from 'express';

/** Datos de la petición en curso que necesitan los servicios (por ejemplo, la auditoría). */
export interface ContextoPeticion {
  ip: string;
  agenteUsuario?: string;
  /** Se completan cuando JwtAuthGuard valida el access token. */
  idUsuario?: number;
  idSesion?: bigint;
}

const almacen = new AsyncLocalStorage<ContextoPeticion>();

/** Contexto de la petición en curso, o `undefined` fuera de una petición HTTP (tareas, pruebas). */
export function contextoActual(): ContextoPeticion | undefined {
  return almacen.getStore();
}

/** IP del cliente tal como la ve Express (respeta `trust proxy` si se configura). */
export function ipDe(req: Request): string {
  return (req.ip ?? req.socket.remoteAddress ?? 'desconocida').slice(0, 45);
}

/** Middleware de Express: abre un contexto por petición. */
export function middlewareContexto(req: Request, _res: Response, next: NextFunction): void {
  const agente = req.get('user-agent');
  almacen.run({ ip: ipDe(req), agenteUsuario: agente?.slice(0, 255) }, next);
}
