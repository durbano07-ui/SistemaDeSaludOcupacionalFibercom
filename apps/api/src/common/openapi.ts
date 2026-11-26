import type { ApiResponseSchemaHost } from '@nestjs/swagger';
import { z } from 'zod';

type EsquemaOpenApi = ApiResponseSchemaHost['schema'];

/**
 * Convierte un esquema Zod (de @smo/shared) en un esquema OpenAPI 3.0 para Swagger.
 * Para cuerpos de petición usar `io: 'input'` (lo que el cliente envía, antes de los transform).
 */
export function esquemaOpenApi(
  schema: z.ZodType,
  io: 'input' | 'output' = 'output',
): EsquemaOpenApi {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  }) as EsquemaOpenApi;
}
