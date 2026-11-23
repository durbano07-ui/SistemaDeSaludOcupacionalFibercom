import { Logger } from '@nestjs/common';
import { respuestaSaludSchema } from '@smo/shared';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { SaludService } from './salud.service.js';

function crearServicio(queryRaw: () => Promise<unknown>) {
  const prisma = { $queryRaw: vi.fn(queryRaw) } as unknown as PrismaService;
  return { servicio: new SaludService(prisma), prisma };
}

describe('SaludService', () => {
  it('responde baseDatos "ok" cuando SELECT 1 funciona', async () => {
    const { servicio, prisma } = crearServicio(() => Promise.resolve([{ 1: 1 }]));

    const respuesta = await servicio.verificar();

    expect(respuesta).toMatchObject({ estado: 'ok', baseDatos: 'ok' });
    expect(respuestaSaludSchema.safeParse(respuesta).success).toBe(true);
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('responde baseDatos "error" sin fallar cuando la base no responde', async () => {
    const advertencia = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { servicio } = crearServicio(() => Promise.reject(new Error('ECONNREFUSED')));

    const respuesta = await servicio.verificar();

    expect(respuesta).toMatchObject({ estado: 'ok', baseDatos: 'error' });
    expect(respuestaSaludSchema.safeParse(respuesta).success).toBe(true);
    expect(advertencia).toHaveBeenCalledWith('La base de datos no responde: ECONNREFUSED');
  });
});
