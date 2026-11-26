import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AtencionDetalle,
  atencionDetalleSchema,
  type AtencionRegistrada,
  atencionRegistradaSchema,
  type NuevaAtencion,
  nuevaAtencionSchema,
} from '@smo/shared';

import { idPipe } from '../../common/fechas.js';
import { esquemaOpenApi } from '../../common/openapi.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { UsuarioPeticion } from '../auth/auth.types.js';
import { RequierePermiso } from '../auth/decoradores/requiere-permiso.decorator.js';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator.js';
import { AtencionesService } from './atenciones.service.js';

@ApiTags('Atenciones')
@ApiBearerAuth()
@Controller('atenciones')
export class AtencionesController {
  constructor(private readonly atenciones: AtencionesService) {}

  @Post()
  @RequierePermiso('atenciones')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registra una atención completa (caso, evolución, receta, certificado)',
    description:
      'Todo en una transacción. 409 si la subsecuente no tiene caso abierto; 422 si hay alerta ' +
      'de alergia sin "recetarDeTodosModos".',
  })
  @ApiBody({ schema: esquemaOpenApi(nuevaAtencionSchema, 'input') })
  @ApiCreatedResponse({ schema: esquemaOpenApi(atencionRegistradaSchema) })
  registrar(
    @Body(new ZodValidationPipe(nuevaAtencionSchema)) datos: NuevaAtencion,
    @UsuarioActual() usuario: UsuarioPeticion,
  ): Promise<AtencionRegistrada> {
    return this.atenciones.registrar(datos, usuario.idUsuario);
  }

  @Get(':id')
  @RequierePermiso('datos_clinicos')
  @ApiOperation({ summary: 'Detalle de una atención (para ver la receta o el certificado)' })
  @ApiOkResponse({ schema: esquemaOpenApi(atencionDetalleSchema) })
  detalle(@Param('id', idPipe) id: number): Promise<AtencionDetalle> {
    return this.atenciones.detalle(id);
  }
}
