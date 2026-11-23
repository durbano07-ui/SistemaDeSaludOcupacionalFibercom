import { z } from 'zod';

/** Estado de un componente del sistema. */
export const estadoComponenteSchema = z.enum(['ok', 'error']);
export type EstadoComponente = z.infer<typeof estadoComponenteSchema>;

/** Respuesta de `GET /api/v1/salud`. */
export const respuestaSaludSchema = z.object({
  estado: z.literal('ok'),
  baseDatos: estadoComponenteSchema,
  hora: z.iso.datetime({ offset: true }),
});
export type RespuestaSalud = z.infer<typeof respuestaSaludSchema>;
