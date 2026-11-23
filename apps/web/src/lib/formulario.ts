import { zodResolver } from '@hookform/resolvers/zod';
import { type FieldValues, useForm, type UseFormProps } from 'react-hook-form';
import type { z } from 'zod';

/**
 * React Hook Form validado con un esquema Zod compartido (@smo/shared), para que la web
 * y la API apliquen exactamente las mismas reglas.
 *
 * @example const formulario = useFormulario(z.object({ cedula: cedulaSchema }));
 */
export function useFormulario<TEntrada extends FieldValues, TSalida extends FieldValues>(
  schema: z.ZodType<TSalida, TEntrada>,
  opciones?: Omit<UseFormProps<TEntrada, unknown, TSalida>, 'resolver'>,
) {
  return useForm<TEntrada, unknown, TSalida>({
    mode: 'onTouched',
    ...opciones,
    resolver: zodResolver(schema),
  });
}
