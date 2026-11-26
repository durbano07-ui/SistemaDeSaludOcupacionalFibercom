import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Cuerpo de error según RFC 9457 (Problem Details for HTTP APIs). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
}

const TITULOS: Record<number, string> = {
  400: 'Solicitud inválida',
  401: 'No autenticado',
  403: 'Acceso denegado',
  404: 'Recurso no encontrado',
  405: 'Método no permitido',
  409: 'Conflicto',
  413: 'Contenido demasiado grande',
  415: 'Tipo de contenido no admitido',
  422: 'No se pudo procesar la solicitud',
  423: 'Cuenta bloqueada',
  429: 'Demasiadas solicitudes',
  500: 'Error interno del servidor',
  503: 'Servicio no disponible',
};

/** Convierte cualquier excepción en una respuesta `application/problem+json`. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const solicitud = http.getRequest<Request>();
    const respuesta = http.getResponse<Response>();

    const problema = this.construir(excepcion, solicitud);
    if (problema.status >= 500) {
      this.logger.error(excepcion instanceof Error ? excepcion.stack : String(excepcion));
    }

    respuesta.status(problema.status).type('application/problem+json').json(problema);
  }

  private construir(excepcion: unknown, solicitud: Request): ProblemDetails {
    const instance = solicitud.originalUrl;

    if (!(excepcion instanceof HttpException)) {
      return {
        type: 'about:blank',
        title: TITULOS[500]!,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'Ocurrió un error inesperado. Intente de nuevo más tarde.',
        instance,
      };
    }

    const status = excepcion.getStatus();
    const cuerpo = excepcion.getResponse();
    const {
      message,
      error: _error,
      statusCode: _statusCode,
      ...extensiones
    } = typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : { message: cuerpo };

    let detail = Array.isArray(message) ? message.join('; ') : String(message ?? excepcion.message);
    if (status === 404 && detail.startsWith('Cannot ')) {
      detail = `No existe la ruta ${solicitud.method} ${instance.split('?')[0]}`;
    }

    return {
      type: 'about:blank',
      title: TITULOS[status] ?? excepcion.name,
      status,
      detail,
      instance,
      ...extensiones,
    };
  }
}
