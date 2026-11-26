import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  busquedaSchema,
  type Cie10,
  listaCie10Schema,
  listaMedicamentosSchema,
  type Medicamento,
} from '@smo/shared';
import type { z } from 'zod';

import { esquemaOpenApi } from '../../common/openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RequierePermiso } from '../auth/decoradores/requiere-permiso.decorator.js';
import { CatalogosService } from './catalogos.service.js';

type Busqueda = z.output<typeof busquedaSchema>;

/** Buscadores del formulario de atención. */
@ApiTags('Catálogos')
@ApiBearerAuth()
@RequierePermiso('atenciones')
@Controller()
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get('cie10')
  @ApiOperation({ summary: 'CIE-10 activos por código o texto (máx. 20)' })
  @ApiQuery({ name: 'q' })
  @ApiOkResponse({ schema: esquemaOpenApi(listaCie10Schema) })
  cie10(@Query(new ZodValidationPipe(busquedaSchema)) { q }: Busqueda): Promise<Cie10[]> {
    return this.catalogos.buscarCie10(q);
  }

  @Get('medicamentos')
  @ApiOperation({ summary: 'Medicamentos activos por nombre o grupo (máx. 20)' })
  @ApiQuery({ name: 'q' })
  @ApiOkResponse({ schema: esquemaOpenApi(listaMedicamentosSchema) })
  medicamentos(
    @Query(new ZodValidationPipe(busquedaSchema)) { q }: Busqueda,
  ): Promise<Medicamento[]> {
    return this.catalogos.buscarMedicamentos(q);
  }
}
