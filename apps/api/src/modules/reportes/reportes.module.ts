import { Module } from '@nestjs/common';

import { ExportacionesService } from './exportacion/exportaciones.service.js';
import { MetasSstService } from './metas-sst.service.js';
import { MetasSstController, ReportesController } from './reportes.controller.js';
import { ReportesRepositorio } from './reportes.repositorio.js';
import { ReportesService } from './reportes.service.js';

@Module({
  controllers: [ReportesController, MetasSstController],
  providers: [ReportesRepositorio, ReportesService, ExportacionesService, MetasSstService],
  exports: [ReportesRepositorio],
})
export class ReportesModule {}
