import { Injectable, Logger } from '@nestjs/common';
import type { EstadoComponente, RespuestaSalud } from '@smo/shared';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SaludService {
  private readonly logger = new Logger(SaludService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Informa si la API está viva y si la base de datos responde a `SELECT 1`. */
  async verificar(): Promise<RespuestaSalud> {
    let baseDatos: EstadoComponente = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      baseDatos = 'error';
      this.logger.warn(`La base de datos no responde: ${(error as Error).message}`);
    }
    return { estado: 'ok', baseDatos, hora: new Date().toISOString() };
  }
}
