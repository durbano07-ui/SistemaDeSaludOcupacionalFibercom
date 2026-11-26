import { Module } from '@nestjs/common';

import { AtencionesController } from './atenciones.controller.js';
import { AtencionesService } from './atenciones.service.js';
import { ConsultasAtencionesService } from './consultas-atenciones.service.js';

@Module({
  controllers: [AtencionesController],
  providers: [AtencionesService, ConsultasAtencionesService],
  exports: [ConsultasAtencionesService],
})
export class AtencionesModule {}
