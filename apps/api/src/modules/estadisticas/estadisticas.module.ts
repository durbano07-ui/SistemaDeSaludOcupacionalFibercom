import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from '../auth/auth.module.js';
import { ReportesModule } from '../reportes/reportes.module.js';
import { EstadisticasController } from './estadisticas.controller.js';
import { EstadisticasService } from './estadisticas.service.js';
import { RegistroRendimiento } from './registro-rendimiento.js';
import { RendimientoInterceptor } from './rendimiento.interceptor.js';

@Module({
  imports: [AuthModule, ReportesModule],
  controllers: [EstadisticasController],
  providers: [
    RegistroRendimiento,
    EstadisticasService,
    { provide: APP_INTERCEPTOR, useClass: RendimientoInterceptor },
  ],
})
export class EstadisticasModule {}
