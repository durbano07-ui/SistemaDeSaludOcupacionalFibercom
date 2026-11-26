import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type ActualizarMetaSst,
  actualizarMetaSstSchema,
  consolidadoAnualSchema,
  filtrosBaseSchema,
  filtrosMorbilidadSchema,
  filtrosRegistroSchema,
  filtrosTrimestralSchema,
  gestionSchema,
  type IndicadorSst,
  indicadorSstSchema,
  informeTrimestralSchema,
  listaMetasSstSchema,
  metaSstSchema,
  morbilidadSchema,
  opcionesReporteSchema,
  registroMensualSchema,
  type TipoReporte,
  tipoReporteSchema,
} from '@smo/shared';
import type { Response } from 'express';
import type { z } from 'zod';

import { esquemaOpenApi } from '../../common/openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { UsuarioPeticion } from '../auth/auth.types.js';
import { RequierePermiso } from '../auth/decoradores/requiere-permiso.decorator.js';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { ExportacionesService, type Formato } from './exportacion/exportaciones.service.js';
import { MetasSstService } from './metas-sst.service.js';
import { ReportesService } from './reportes.service.js';

const zod = <T extends z.ZodType>(schema: T) => new ZodValidationPipe(schema);

@ApiTags('Reportes')
@ApiBearerAuth()
@RequierePermiso('reportes')
@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly reportes: ReportesService,
    private readonly exportaciones: ExportacionesService,
  ) {}

  @Get('opciones')
  @ApiOperation({ summary: 'Bases y cargos para los filtros' })
  @ApiOkResponse({ schema: esquemaOpenApi(opcionesReporteSchema) })
  opciones() {
    return this.reportes.opciones();
  }

  @Get('registro-mensual')
  @ApiOperation({ summary: 'Registro mensual: totales y lista (un mes, o los 12 sin "mes")' })
  @ApiOkResponse({ schema: esquemaOpenApi(registroMensualSchema) })
  registroMensual(@Query(zod(filtrosRegistroSchema)) f: z.output<typeof filtrosRegistroSchema>) {
    return this.reportes.registroMensual(f);
  }

  @Get('consolidado-anual')
  @ApiOperation({ summary: 'Consolidado anual: una fila por mes y totales' })
  @ApiOkResponse({ schema: esquemaOpenApi(consolidadoAnualSchema) })
  consolidadoAnual(@Query(zod(filtrosBaseSchema)) f: z.output<typeof filtrosBaseSchema>) {
    return this.reportes.consolidadoAnual(f);
  }

  @Get('informe-trimestral')
  @ApiOperation({ summary: 'Informe trimestral SST con metas (un trimestre o los 4)' })
  @ApiOkResponse({ schema: esquemaOpenApi(informeTrimestralSchema) })
  informeTrimestral(
    @Query(zod(filtrosTrimestralSchema)) f: z.output<typeof filtrosTrimestralSchema>,
  ) {
    return this.reportes.informeTrimestral(f);
  }

  @Get('morbilidad')
  @ApiOperation({ summary: 'Morbilidad CIE-10: solo atenciones primeras' })
  @ApiOkResponse({ schema: esquemaOpenApi(morbilidadSchema) })
  morbilidad(@Query(zod(filtrosMorbilidadSchema)) f: z.output<typeof filtrosMorbilidadSchema>) {
    return this.reportes.morbilidad(f);
  }

  @Get('gestion')
  @ApiOperation({ summary: 'Estadísticas de gestión del año' })
  @ApiOkResponse({ schema: esquemaOpenApi(gestionSchema) })
  gestion(@Query(zod(filtrosBaseSchema)) f: z.output<typeof filtrosBaseSchema>) {
    return this.reportes.gestion(f);
  }

  @Get(':tipo/:formato')
  @ApiOperation({
    summary: 'Exporta un reporte a Excel o PDF',
    description: 'tipo: registro-mensual, consolidado-anual, informe-trimestral, morbilidad.',
  })
  async exportar(
    @Param('tipo', zod(tipoReporteSchema)) tipo: TipoReporte,
    @Param('formato', new ParseEnumPipe(['excel', 'pdf'])) formato: Formato,
    @Query() consulta: Record<string, string>,
    @UsuarioActual() usuario: UsuarioPeticion,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.exportaciones.exportar(tipo, formato, consulta, usuario.idUsuario);
    respuesta.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(archivo.contenido, {
      type: archivo.tipoContenido,
      disposition: `attachment; filename="${archivo.nombre}"`,
      length: archivo.contenido.length,
    });
  }
}

@ApiTags('Reportes')
@ApiBearerAuth()
@RequierePermiso('reportes')
@Controller('metas-sst')
export class MetasSstController {
  constructor(private readonly metas: MetasSstService) {}

  @Get()
  @ApiOperation({ summary: 'Metas SST del informe trimestral' })
  @ApiOkResponse({ schema: esquemaOpenApi(listaMetasSstSchema) })
  listar() {
    return this.metas.listar();
  }

  @Put(':indicador')
  @ApiOperation({ summary: 'Actualiza una meta SST (queda en auditoría)' })
  @ApiBody({ schema: esquemaOpenApi(actualizarMetaSstSchema, 'input') })
  @ApiOkResponse({ schema: esquemaOpenApi(metaSstSchema) })
  actualizar(
    @Param('indicador', zod(indicadorSstSchema)) indicador: IndicadorSst,
    @Body(zod(actualizarMetaSstSchema)) datos: ActualizarMetaSst,
    @UsuarioActual() usuario: UsuarioPeticion,
  ) {
    return this.metas.actualizar(indicador, datos, usuario.idUsuario);
  }
}
