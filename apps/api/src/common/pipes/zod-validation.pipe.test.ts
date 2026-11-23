import { BadRequestException } from '@nestjs/common';
import { cedulaSchema } from '@smo/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ cedula: cedulaSchema }));

  it('devuelve los datos validados', () => {
    expect(pipe.transform({ cedula: ' 1710034065 ' })).toEqual({ cedula: '1710034065' });
  });

  it('lanza 400 con el detalle de cada campo', () => {
    try {
      pipe.transform({ cedula: '1710034066' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        message: 'Los datos enviados no son válidos',
        errores: [{ campo: 'cedula', mensaje: 'La cédula no es válida' }],
      });
    }
  });
});
