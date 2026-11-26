import { z } from 'zod';

import { cie10Schema } from '../catalogos/catalogo.schema.js';

const enteroOpcional = (min: number, max: number, mensaje: string) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().int(mensaje).min(min, mensaje).max(max, mensaje).optional(),
  );

/** Filtros comunes: año obligatorio; base y cargo opcionales (ids). */
export const filtrosBaseSchema = z.object({
  anio: z.coerce
    .number({ error: 'Indica el año' })
    .int('El año no es válido')
    .min(2000, 'El año no es válido')
    .max(2100, 'El año no es válido'),
  base: enteroOpcional(1, 4_294_967_295, 'La base no es válida'),
  cargo: enteroOpcional(1, 4_294_967_295, 'El cargo no es válido'),
});
export type FiltrosReporte = z.output<typeof filtrosBaseSchema>;

export const filtrosRegistroSchema = filtrosBaseSchema.extend({
  mes: enteroOpcional(1, 12, 'El mes debe estar entre 1 y 12'),
});
export const filtrosTrimestralSchema = filtrosBaseSchema.extend({
  trimestre: enteroOpcional(1, 4, 'El trimestre debe estar entre 1 y 4'),
});
export const filtrosMorbilidadSchema = filtrosBaseSchema
  .extend({
    mes: enteroOpcional(1, 12, 'El mes debe estar entre 1 y 12'),
    trimestre: enteroOpcional(1, 4, 'El trimestre debe estar entre 1 y 4'),
    limite: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : v),
      z.coerce
        .number()
        .int()
        .min(1, 'El límite va de 1 a 100')
        .max(100, 'El límite va de 1 a 100')
        .default(20),
    ),
  })
  .refine((f) => !(f.mes && f.trimestre), {
    message: 'Filtra por mes o por trimestre, no por ambos',
    path: ['trimestre'],
  });

/** Los 4 reportes exportables. */
export const TIPOS_REPORTE = [
  'registro-mensual',
  'consolidado-anual',
  'informe-trimestral',
  'morbilidad',
] as const;
export const tipoReporteSchema = z.enum(TIPOS_REPORTE, { error: 'Reporte desconocido' });
export type TipoReporte = z.infer<typeof tipoReporteSchema>;

// ------------------------------------------------------------- respuestas

/** Totales de un período (fila del consolidado o tarjetas del registro mensual). */
export const totalesSchema = z.object({
  total: z.number().int(),
  enfermedadComun: z.number().int(),
  enfermedadProfesional: z.number().int(),
  incidentes: z.number().int(),
  accidentes: z.number().int(),
  primera: z.number().int(),
  subsecuente: z.number().int(),
});
export type Totales = z.infer<typeof totalesSchema>;

export const filaRegistroSchema = z.object({
  id: z.number().int(),
  /** Instante ISO (UTC). */
  fecha: z.string(),
  paciente: z.string(),
  tipoEvento: z.string(),
  cedula: z.string(),
  cargo: z.string(),
  /** Principal y adicionales separados por ", ". */
  cie10: z.string(),
  tipoAtencion: z.string(),
  medicamentos: z.string(),
  observaciones: z.string(),
});
export type FilaRegistro = z.infer<typeof filaRegistroSchema>;

export const registroMensualSchema = z.object({
  anio: z.number().int(),
  meses: z.array(
    z.object({ mes: z.number().int(), totales: totalesSchema, filas: z.array(filaRegistroSchema) }),
  ),
});
export type RegistroMensual = z.infer<typeof registroMensualSchema>;

export const consolidadoAnualSchema = z.object({
  anio: z.number().int(),
  meses: z.array(totalesSchema.extend({ mes: z.number().int() })),
  totales: totalesSchema,
});
export type ConsolidadoAnual = z.infer<typeof consolidadoAnualSchema>;

export const INDICADORES_SST = [
  'enfermedad_comun',
  'enfermedad_profesional',
  'accidente_trabajo',
  'incidente_trabajo',
  'total_atenciones',
] as const;
export const indicadorSstSchema = z.enum(INDICADORES_SST, { error: 'Indicador desconocido' });
export type IndicadorSst = z.infer<typeof indicadorSstSchema>;

export const NOMBRES_INDICADOR_SST: Record<IndicadorSst, string> = {
  enfermedad_comun: 'Enfermedades comunes',
  enfermedad_profesional: 'Enfermedades profesionales',
  accidente_trabajo: 'Accidentes de trabajo',
  incidente_trabajo: 'Incidentes de trabajo',
  total_atenciones: 'TOTAL ATENCIONES',
};

export const TIPOS_META_SST = ['porcentaje_maximo', 'casos_maximo', 'informativa'] as const;
export const tipoMetaSstSchema = z.enum(TIPOS_META_SST, { error: 'Elige el tipo de meta' });

export const NOMBRES_TIPO_META: Record<(typeof TIPOS_META_SST)[number], string> = {
  porcentaje_maximo: 'Porcentaje máximo',
  casos_maximo: 'Casos máximos',
  informativa: 'Informativa (no se evalúa)',
};

export const metaSstSchema = z.object({
  indicador: indicadorSstSchema,
  texto: z.string(),
  tipo: tipoMetaSstSchema,
  limite: z.number().nullable(),
  actualizadoEn: z.string(),
});
export type MetaSst = z.infer<typeof metaSstSchema>;
export const listaMetasSstSchema = z.array(metaSstSchema);

/** Cuerpo de `PUT /metas-sst/:indicador`. */
export const actualizarMetaSstSchema = z
  .object({
    texto: z
      .string({ error: 'Escribe el texto de la meta' })
      .trim()
      .min(1, 'Escribe el texto de la meta')
      .max(60, 'Máximo 60 caracteres'),
    tipo: tipoMetaSstSchema,
    limite: z.preprocess(
      (v) =>
        v === '' || v === undefined
          ? null
          : typeof v === 'string'
            ? Number(v.replace(',', '.'))
            : v,
      z
        .number({ error: 'El límite debe ser un número' })
        .min(0, 'El límite no puede ser negativo')
        .max(99_999.99, 'El límite es demasiado grande')
        .nullable(),
    ),
  })
  .superRefine((meta, ctx) => {
    if (meta.tipo !== 'informativa' && meta.limite === null) {
      ctx.addIssue({ code: 'custom', path: ['limite'], message: 'Indica el límite de la meta' });
    }
    if (meta.tipo === 'porcentaje_maximo' && meta.limite !== null && meta.limite > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['limite'],
        message: 'Un porcentaje no puede pasar de 100',
      });
    }
  })
  .transform((meta) => ({ ...meta, limite: meta.tipo === 'informativa' ? null : meta.limite }));
export type ActualizarMetaSst = z.output<typeof actualizarMetaSstSchema>;

export const filaTrimestralSchema = z.object({
  indicador: indicadorSstSchema,
  valores: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  total: z.number().int(),
  /** % del total del trimestre; null si el trimestre no tiene atenciones. */
  porcentaje: z.number().nullable(),
  meta: z.string().nullable(),
  cumple: z.enum(['si', 'no']).nullable(),
});
export const informeTrimestralSchema = z.object({
  anio: z.number().int(),
  trimestres: z.array(
    z.object({
      trimestre: z.number().int(),
      meses: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
      filas: z.array(filaTrimestralSchema),
    }),
  ),
});
export type InformeTrimestral = z.infer<typeof informeTrimestralSchema>;

export const morbilidadSchema = z.object({
  anio: z.number().int(),
  periodo: z.string(),
  totalPrimeras: z.number().int(),
  filas: z.array(
    cie10Schema.extend({
      casos: z.number().int(),
      porcentaje: z.number().nullable(),
      tratamiento: z.string(),
    }),
  ),
});
export type Morbilidad = z.infer<typeof morbilidadSchema>;

const conteoSchema = z.object({ nombre: z.string(), total: z.number().int() });
export const gestionSchema = z.object({
  anio: z.number().int(),
  total: z.number().int(),
  porTipoEvento: z.array(conteoSchema),
  porTipoAtencion: z.array(conteoSchema),
  porMes: z.array(conteoSchema.extend({ mes: z.number().int() })),
  topCie10: z.array(cie10Schema.extend({ casos: z.number().int() })),
  porBase: z.array(conteoSchema),
  porCargo: z.array(conteoSchema),
});
export type Gestion = z.infer<typeof gestionSchema>;

/** `GET /reportes/opciones`: bases y cargos para los filtros. */
export const opcionesReporteSchema = z.object({
  bases: z.array(z.object({ id: z.number().int(), nombre: z.string() })),
  cargos: z.array(z.object({ id: z.number().int(), nombre: z.string() })),
});
export type OpcionesReporte = z.infer<typeof opcionesReporteSchema>;
