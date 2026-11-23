import type { ApiResponseSchemaHost } from '@nestjs/swagger';
import { z } from 'zod';

type EsquemaOpenApi = ApiResponseSchemaHost['schema'];

/** Convierte un esquema Zod (de @smo/shared) en un esquema OpenAPI 3.0 para Swagger. */
export function esquemaOpenApi(schema: z.ZodType): EsquemaOpenApi {
  return z.toJSONSchema(schema, { target: 'openapi-3.0' }) as EsquemaOpenApi;
}
