import { Injectable, NotFoundException } from '@nestjs/common';
import type { ActualizarMetaSst, IndicadorSst, MetaSst } from '@smo/shared';

import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

type FilaMeta = Awaited<ReturnType<PrismaService['metaSst']['findMany']>>[number];

const aMeta = (m: FilaMeta): MetaSst => ({
  indicador: m.indicador,
  texto: m.texto,
  tipo: m.tipo,
  limite: m.limite === null ? null : Number(m.limite),
  actualizadoEn: m.actualizadoEn.toISOString(),
});

/** Metas SST del informe trimestral (tabla meta_sst). */
@Injectable()
export class MetasSstService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<MetaSst[]> {
    return (await this.prisma.metaSst.findMany({ orderBy: { idMeta: 'asc' } })).map(aMeta);
  }

  async actualizar(
    indicador: IndicadorSst,
    datos: ActualizarMetaSst,
    idUsuario: number,
  ): Promise<MetaSst> {
    const anterior = await this.prisma.metaSst.findUnique({ where: { indicador } });
    if (!anterior) throw new NotFoundException('La meta no existe');

    const nueva = await this.prisma.metaSst.update({
      where: { indicador },
      data: {
        texto: datos.texto,
        tipo: datos.tipo,
        limite: datos.limite,
        idUsuarioActualiza: idUsuario,
        actualizadoEn: new Date(),
      },
    });
    const resumen = (m: FilaMeta) => ({
      texto: m.texto,
      tipo: m.tipo,
      limite: m.limite === null ? null : Number(m.limite),
    });
    await this.auditoria.registrar({
      accion: 'actualizar',
      modulo: 'reportes',
      entidad: 'meta_sst',
      idEntidad: anterior.idMeta,
      descripcion: `Meta SST "${indicador}"`,
      valorAnterior: resumen(anterior),
      valorNuevo: resumen(nueva),
    });
    return aMeta(nueva);
  }
}
