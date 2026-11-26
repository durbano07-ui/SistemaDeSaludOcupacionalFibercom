import { BadRequestException, Injectable } from '@nestjs/common';
import {
  filtrosBaseSchema,
  filtrosMorbilidadSchema,
  filtrosRegistroSchema,
  filtrosTrimestralSchema,
  NOMBRES_MES,
  type TipoReporte,
} from '@smo/shared';

import { PdfService } from '../../../common/pdf/pdf.service.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { AuditoriaService } from '../../auditoria/auditoria.service.js';
import { ReportesService } from '../reportes.service.js';
import { type Encabezado, fechaHora } from './comun.js';
import {
  excelConsolidadoAnual,
  excelInformeTrimestral,
  excelMorbilidad,
  excelRegistroMensual,
} from './excel.js';
import {
  htmlConsolidadoAnual,
  htmlInformeTrimestral,
  htmlMorbilidad,
  htmlRegistroMensual,
} from './pdf-plantillas.js';

export type Formato = 'excel' | 'pdf';

export interface ArchivoExportado {
  contenido: Buffer;
  nombre: string;
  tipoContenido: string;
}

const TIPO_CONTENIDO: Record<Formato, string> = {
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const TITULOS: Record<TipoReporte, string> = {
  'registro-mensual': 'REGISTRO DE ATENCIONES MÉDICAS',
  'consolidado-anual': 'CONSOLIDADO ANUAL DE ATENCIONES',
  'informe-trimestral': 'INFORMES TRIMESTRALES DE INDICADORES SST',
  morbilidad: 'ESTADÍSTICAS Y MORBILIDAD',
};

const valida = <T>(pipe: ZodValidationPipe<never>, consulta: unknown) =>
  pipe.transform(consulta) as T;

/** Exportación a Excel (ExcelJS) y PDF (Puppeteer) de los 4 reportes, con auditoría. */
@Injectable()
export class ExportacionesService {
  constructor(
    private readonly reportes: ReportesService,
    private readonly pdf: PdfService,
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** "Base: Guaranda · Cargo: Todos" con los nombres de la base y el cargo filtrados. */
  private async textoFiltros(base?: number, cargo?: number): Promise<string> {
    const [b, c] = await Promise.all([
      base ? this.prisma.base.findUnique({ where: { idBase: base } }) : null,
      cargo ? this.prisma.cargo.findUnique({ where: { idCargo: cargo } }) : null,
    ]);
    if (base && !b) throw new BadRequestException('La base no existe');
    if (cargo && !c) throw new BadRequestException('El cargo no existe');
    return `Base: ${b?.nombre ?? 'Todas'} · Cargo: ${c?.nombre ?? 'Todos'}`;
  }

  private async pie(idUsuario: number): Promise<string> {
    const u = await this.prisma.usuario.findUnique({
      where: { idUsuario },
      select: { nombres: true, apellidos: true },
    });
    return `Generado el ${fechaHora(new Date())} por ${u ? `${u.nombres} ${u.apellidos}` : 'el sistema'}`;
  }

  async exportar(
    tipo: TipoReporte,
    formato: Formato,
    consulta: unknown,
    idUsuario: number,
  ): Promise<ArchivoExportado> {
    const archivo = await this.generar(tipo, formato, consulta, idUsuario);
    await this.auditoria.registrar({
      accion: 'exportar',
      modulo: 'reportes',
      entidad: 'reporte',
      descripcion:
        `Exportar ${tipo} a ${formato === 'excel' ? 'Excel' : 'PDF'} (${archivo.nombre})`.slice(
          0,
          255,
        ),
      valorNuevo: { tipo, formato, filtros: consulta, archivo: archivo.nombre },
    });
    return archivo;
  }

  private async generar(
    tipo: TipoReporte,
    formato: Formato,
    consulta: unknown,
    idUsuario: number,
  ): Promise<ArchivoExportado> {
    const extension = formato === 'excel' ? 'xlsx' : 'pdf';
    const base = async (f: { anio: number; base?: number; cargo?: number }, periodo: string) =>
      ({
        titulo: TITULOS[tipo],
        periodo,
        filtros: await this.textoFiltros(f.base, f.cargo),
        pie: await this.pie(idUsuario),
      }) satisfies Encabezado;

    const terminar = async (
      contenidoExcel: () => Promise<Buffer>,
      html: () => string,
      nombre: string,
      horizontal: boolean,
      e: Encabezado,
    ): Promise<ArchivoExportado> => ({
      contenido:
        formato === 'excel'
          ? await contenidoExcel()
          : await this.pdf.generar(html(), { horizontal, pie: e.pie }),
      nombre: `${nombre}.${extension}`,
      tipoContenido: TIPO_CONTENIDO[formato],
    });

    switch (tipo) {
      case 'registro-mensual': {
        const f = valida<{ anio: number; mes?: number; base?: number; cargo?: number }>(
          new ZodValidationPipe(filtrosRegistroSchema as never),
          consulta,
        );
        const e = await base(f, f.mes ? `${NOMBRES_MES[f.mes - 1]} ${f.anio}` : `Año ${f.anio}`);
        const datos = await this.reportes.registroMensual(f);
        const sufijo = f.mes ? `${f.anio}-${String(f.mes).padStart(2, '0')}` : `${f.anio}`;
        return terminar(
          () => excelRegistroMensual(datos, e),
          () => htmlRegistroMensual(datos, e),
          `reporte-registro-mensual-${sufijo}`,
          true,
          e,
        );
      }
      case 'consolidado-anual': {
        const f = valida<{ anio: number; base?: number; cargo?: number }>(
          new ZodValidationPipe(filtrosBaseSchema as never),
          consulta,
        );
        const e = await base(f, `Año ${f.anio}`);
        const datos = await this.reportes.consolidadoAnual(f);
        return terminar(
          () => excelConsolidadoAnual(datos, e),
          () => htmlConsolidadoAnual(datos, e),
          `reporte-consolidado-anual-${f.anio}`,
          false,
          e,
        );
      }
      case 'informe-trimestral': {
        const f = valida<{ anio: number; trimestre?: number; base?: number; cargo?: number }>(
          new ZodValidationPipe(filtrosTrimestralSchema as never),
          consulta,
        );
        const e = await base(
          f,
          f.trimestre ? `Trimestre ${f.trimestre} de ${f.anio}` : `Año ${f.anio} (4 trimestres)`,
        );
        const datos = await this.reportes.informeTrimestral(f);
        return terminar(
          () => excelInformeTrimestral(datos, e),
          () => htmlInformeTrimestral(datos, e),
          `informe-trimestral-sst-${f.anio}${f.trimestre ? `-T${f.trimestre}` : ''}`,
          true,
          e,
        );
      }
      case 'morbilidad': {
        const f = valida<{
          anio: number;
          mes?: number;
          trimestre?: number;
          limite: number;
          base?: number;
          cargo?: number;
        }>(new ZodValidationPipe(filtrosMorbilidadSchema as never), consulta);
        const datos = await this.reportes.morbilidad(f);
        const e = await base(f, datos.periodo);
        const sufijo = f.mes
          ? `${f.anio}-${String(f.mes).padStart(2, '0')}`
          : f.trimestre
            ? `${f.anio}-T${f.trimestre}`
            : `${f.anio}`;
        return terminar(
          () => excelMorbilidad(datos, e),
          () => htmlMorbilidad(datos, e),
          `reporte-morbilidad-${sufijo}`,
          false,
          e,
        );
      }
    }
  }
}
