import { Module } from '@nestjs/common';

import { AtencionesModule } from '../atenciones/atenciones.module.js';
import { PacientesController } from './pacientes.controller.js';
import { PacientesService } from './pacientes.service.js';

@Module({
  imports: [AtencionesModule],
  controllers: [PacientesController],
  providers: [PacientesService],
})
export class PacientesModule {}
