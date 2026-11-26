import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  consultaRendimientoSchema,
  modulosSchema,
  rendimientoSchema,
  usuariosActivosSchema,
} from '@smo/shared';
import type { z } from 'zod';

import { esquemaOpenApi } from '../../common/openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RequierePermiso } from '../auth/decoradores/requiere-permiso.decorator.js';
import { EstadisticasService } from './estadisticas.service.js';

@ApiTags('Estadísticas del administrador')
@ApiBearerAuth()
@RequierePermiso('supervision')
@Controller('admin/estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticas: EstadisticasService) {}

  @Get('rendimiento')
  @ApiOperation({ summary: 'Tiempo de respuesta de la API (en memoria, últimas 24 h)' })
  @ApiOkResponse({ schema: esquemaOpenApi(rendimientoSchema) })
  rendimiento(
    @Query(new ZodValidationPipe(consultaRendimientoSchema))
    { rango }: z.output<typeof consultaRendimientoSchema>,
  ) {
    return this.estadisticas.tiempos(rango);
  }

  @Get('usuarios')
  @ApiOperation({ summary: 'Usuarios activos ahora y por día (últimos 30 días)' })
  @ApiOkResponse({ schema: esquemaOpenApi(usuariosActivosSchema) })
  usuarios() {
    return this.estadisticas.usuarios();
  }

  @Get('modulos')
  @ApiOperation({ summary: 'Estado de cada módulo del sistema' })
  @ApiOkResponse({ schema: esquemaOpenApi(modulosSchema) })
  modulos() {
    return this.estadisticas.modulos();
  }
}
