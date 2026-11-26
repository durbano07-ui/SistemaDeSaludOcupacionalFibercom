import { Global, Module } from '@nestjs/common';

import { AuditoriaService } from './auditoria.service.js';

/** Auditoría reutilizable por todos los módulos (global: no hace falta importarlo). */
@Global()
@Module({
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
