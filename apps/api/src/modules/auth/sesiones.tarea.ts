import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service.js';

/** Tarea programada: marca como expiradas las sesiones cuyo refresh token ya venció. */
@Injectable()
export class SesionesTarea {
  private readonly logger = new Logger(SesionesTarea.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'expirar-sesiones' })
  async expirarSesiones(): Promise<number> {
    const ahora = new Date();
    const { count } = await this.prisma.sesion.updateMany({
      where: { fin: null, renovacionExpira: { lte: ahora } },
      data: { fin: ahora, motivoCierre: 'expirada', tokenRenovacionHash: null },
    });
    if (count > 0) this.logger.log(`${count} sesiones marcadas como expiradas`);
    return count;
  }
}
