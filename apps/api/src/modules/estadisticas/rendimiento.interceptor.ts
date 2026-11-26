import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { finalize, type Observable } from 'rxjs';

import { RegistroRendimiento } from './registro-rendimiento.js';

/** No se miden: la salud (la consultan monitores) ni las exportaciones (son lentas a propósito). */
const EXCLUIDAS = [/\/salud(\?|$)/, /\/reportes\/[^/]+\/(excel|pdf)(\?|$)/];

/** Interceptor global: mide el tiempo de respuesta de cada petición HTTP. */
@Injectable()
export class RendimientoInterceptor implements NestInterceptor {
  constructor(private readonly registro: RegistroRendimiento) {}

  intercept(contexto: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    const url = contexto.switchToHttp().getRequest<Request>().originalUrl ?? '';
    if (contexto.getType() !== 'http' || EXCLUIDAS.some((r) => r.test(url))) {
      return siguiente.handle();
    }
    const inicio = process.hrtime.bigint();
    return siguiente.handle().pipe(
      finalize(() => {
        this.registro.registrar(Number(process.hrtime.bigint() - inicio) / 1e6);
      }),
    );
  }
}
