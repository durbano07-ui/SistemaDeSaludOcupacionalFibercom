import { type DynamicModule, Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { ENTORNO, type Entorno } from './config/entorno.js';
import { SaludModule } from './modules/salud/salud.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Global()
@Module({})
export class AppModule {
  /** Registra la aplicación con el entorno ya validado. */
  static registrar(entorno: Entorno): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: entorno.LOG_LEVEL,
            // Solo lo necesario: sin cabeceras (evita registrar tokens o cookies).
            serializers: {
              req: (req: { id: unknown; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },
            transport:
              entorno.NODE_ENV === 'development'
                ? {
                    target: 'pino-pretty',
                    options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                  }
                : undefined,
          },
        }),
        PrismaModule,
        SaludModule,
      ],
      providers: [{ provide: ENTORNO, useValue: entorno }],
      exports: [ENTORNO],
    };
  }
}
