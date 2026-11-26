import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { middlewareContexto } from './common/contexto/contexto-peticion.js';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter.js';
import type { Entorno } from './config/entorno.js';

export const PREFIJO_API = 'api/v1';

/** Configuración común de la aplicación (se usa en main.ts y en las pruebas de integración). */
export function configurarApp(app: INestApplication, entorno: Entorno): void {
  const esProduccion = entorno.NODE_ENV === 'production';

  app.setGlobalPrefix(PREFIJO_API);
  // En desarrollo se relaja la CSP para que funcione Swagger UI.
  app.use(helmet({ contentSecurityPolicy: esProduccion ? undefined : false }));
  app.enableCors({ origin: entorno.CORS_ORIGIN, credentials: true });
  app.use(cookieParser());
  app.use(middlewareContexto);
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  if (!esProduccion) {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Sistema de Medicina Ocupacional — API')
        .setDescription('API REST del Sistema de Medicina Ocupacional de FIBERCOM ECUADOR')
        .setVersion('0.1.0')
        .addBearerAuth()
        .addCookieAuth('smo_renovacion')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, documento);
  }
}
