import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Error de un campo, tal como se devuelve en `errores` de Problem Details. */
export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

/**
 * Valida y transforma la entrada con un esquema Zod (normalmente de @smo/shared).
 * Uso: `@Body(new ZodValidationPipe(miEsquema)) datos: MiTipo`.
 */
@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(valor: unknown): z.output<T> {
    const resultado = this.schema.safeParse(valor);
    if (resultado.success) return resultado.data;

    const errores: ErrorCampo[] = resultado.error.issues.map((issue) => ({
      campo: issue.path.join('.'),
      mensaje: issue.message,
    }));
    throw new BadRequestException({ message: 'Los datos enviados no son válidos', errores });
  }
}
