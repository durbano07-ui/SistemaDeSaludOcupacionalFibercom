import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { ENTORNO, type Entorno } from '../config/entorno.js';
import { PrismaClient } from '../generated/prisma/client.js';

/** Convierte DATABASE_URL (mysql://usuario:clave@host:puerto/base) a la configuración del pool. */
export function configuracionPool(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    connectTimeout: 3_000,
    acquireTimeout: 5_000,
  };
}

/** Cliente de Prisma sobre el adaptador de MariaDB. La conexión se abre en la primera consulta. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENTORNO) entorno: Entorno) {
    super({ adapter: new PrismaMariaDb(configuracionPool(entorno.DATABASE_URL)) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
