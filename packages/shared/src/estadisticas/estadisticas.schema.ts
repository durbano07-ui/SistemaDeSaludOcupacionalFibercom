import { z } from 'zod';

export const RANGOS_RENDIMIENTO = ['1h', '24h'] as const;
export const consultaRendimientoSchema = z.object({
  rango: z.enum(RANGOS_RENDIMIENTO, { error: 'El rango debe ser 1h o 24h' }).default('1h'),
});

/** `GET /admin/estadisticas/rendimiento`: tiempos de respuesta de la API (en memoria). */
export const rendimientoSchema = z.object({
  rango: z.enum(RANGOS_RENDIMIENTO),
  peticiones: z.number().int(),
  promedioMs: z.number().nullable(),
  p95Ms: z.number().nullable(),
  /** Desde cuándo hay datos (se reinicia si se reinicia la API). */
  desde: z.string(),
  serie: z.array(
    z.object({
      inicio: z.string(),
      peticiones: z.number().int(),
      promedioMs: z.number().nullable(),
      p95Ms: z.number().nullable(),
    }),
  ),
});
export type Rendimiento = z.infer<typeof rendimientoSchema>;

/** `GET /admin/estadisticas/usuarios`. */
export const usuariosActivosSchema = z.object({
  activosAhora: z.number().int(),
  /** Últimos 30 días (hora de Ecuador), del más antiguo al de hoy. */
  porDia: z.array(z.object({ dia: z.string(), usuarios: z.number().int() })),
});
export type UsuariosActivos = z.infer<typeof usuariosActivosSchema>;

export const estadoModuloSchema = z.object({
  modulo: z.string(),
  estado: z.enum(['operativo', 'con_fallas']),
  latenciaMs: z.number().nullable(),
  detalle: z.string(),
  verificadoEn: z.string(),
});
export type EstadoModulo = z.infer<typeof estadoModuloSchema>;

/** `GET /admin/estadisticas/modulos`. */
export const modulosSchema = z.object({
  operativos: z.number().int(),
  total: z.number().int(),
  modulos: z.array(estadoModuloSchema),
});
export type Modulos = z.infer<typeof modulosSchema>;
