import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type RespuestaSalud, respuestaSaludSchema } from '@smo/shared';

import { esquemaOpenApi } from '../../common/openapi.js';
import { Publico } from '../auth/decoradores/publico.decorator.js';
import { SaludService } from './salud.service.js';

@ApiTags('Salud')
@Publico()
@Controller('salud')
export class SaludController {
  constructor(private readonly saludService: SaludService) {}

  @Get()
  @ApiOperation({ summary: 'Estado de la API y de la base de datos' })
  @ApiOkResponse({
    description: 'La API responde; `baseDatos` indica si MariaDB contesta.',
    schema: esquemaOpenApi(respuestaSaludSchema),
  })
  verificar(): Promise<RespuestaSalud> {
    return this.saludService.verificar();
  }
}
