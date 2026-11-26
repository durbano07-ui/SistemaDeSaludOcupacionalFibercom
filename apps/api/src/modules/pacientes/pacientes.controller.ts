import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type AtencionesDelMes,
  atencionesDelMesSchema,
  busquedaSchema,
  consultaAtencionesMesSchema,
  consultaHistorialSchema,
  type HistorialAtenciones,
  historialAtencionesSchema,
  listaPacientesSchema,
  type PacienteEncontrado,
  type ResumenPaciente,
  resumenPacienteSchema,
} from '@smo/shared';
import type { z } from 'zod';

import { idPipe } from '../../common/fechas.js';
import { esquemaOpenApi } from '../../common/openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ConsultasAtencionesService } from '../atenciones/consultas-atenciones.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { RequierePermiso } from '../auth/decoradores/requiere-permiso.decorator.js';
import { PacientesService } from './pacientes.service.js';

@ApiTags('Pacientes')
@ApiBearerAuth()
@RequierePermiso('datos_clinicos')
@Controller('pacientes')
export class PacientesController {
  constructor(
    private readonly pacientes: PacientesService,
    private readonly atenciones: ConsultasAtencionesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Busca pacientes activos por cédula, nombres o apellidos (máx. 20)' })
  @ApiQuery({ name: 'q', description: 'Desde 2 caracteres' })
  @ApiOkResponse({ schema: esquemaOpenApi(listaPacientesSchema) })
  buscar(
    @Query(new ZodValidationPipe(busquedaSchema)) { q }: z.output<typeof busquedaSchema>,
  ): Promise<PacienteEncontrado[]> {
    return this.pacientes.buscar(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Resumen del paciente para la tarjeta' })
  @ApiOkResponse({ schema: esquemaOpenApi(resumenPacienteSchema) })
  async resumen(@Param('id', idPipe) id: number): Promise<ResumenPaciente> {
    const resumen = await this.pacientes.resumen(id);
    await this.auditoria.registrar({
      accion: 'leer',
      modulo: 'pacientes',
      entidad: 'usuario',
      idEntidad: id,
      idPaciente: id,
      descripcion: 'Ver resumen del paciente',
    });
    return resumen;
  }

  @Get(':id/atenciones')
  @ApiOperation({ summary: 'Atenciones del paciente en un mes (hora de Ecuador)' })
  @ApiQuery({ name: 'mes', example: '2026-11' })
  @ApiOkResponse({ schema: esquemaOpenApi(atencionesDelMesSchema) })
  async delMes(
    @Param('id', idPipe) id: number,
    @Query(new ZodValidationPipe(consultaAtencionesMesSchema))
    { mes }: z.output<typeof consultaAtencionesMesSchema>,
  ): Promise<AtencionesDelMes> {
    await this.pacientes.asegurarExiste(id);
    return this.atenciones.delMes(id, mes);
  }

  @Get(':id/atenciones/historial')
  @ApiOperation({
    summary: 'Todas las atenciones del paciente, de la más reciente a la más antigua',
  })
  @ApiQuery({ name: 'pagina', required: false, example: 1 })
  @ApiQuery({ name: 'tamano', required: false, example: 10 })
  @ApiOkResponse({ schema: esquemaOpenApi(historialAtencionesSchema) })
  async historial(
    @Param('id', idPipe) id: number,
    @Query(new ZodValidationPipe(consultaHistorialSchema))
    { pagina, tamano }: z.output<typeof consultaHistorialSchema>,
  ): Promise<HistorialAtenciones> {
    await this.pacientes.asegurarExiste(id);
    return this.atenciones.historial(id, pagina, tamano);
  }
}
