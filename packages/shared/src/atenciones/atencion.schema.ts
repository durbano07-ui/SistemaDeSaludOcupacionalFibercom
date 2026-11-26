import { z } from 'zod';

import { fechaLocal, fechaSchema, instanteDeHoraLocal } from '../fechas/fechas.js';
import { algunoRequierePreguntaTrabajo } from './reglas.js';

export const TIPOS_ATENCION = ['primera', 'subsecuente'] as const;
export const tipoAtencionSchema = z.enum(TIPOS_ATENCION, { error: 'Elige el tipo de atención' });
export type TipoAtencion = z.infer<typeof tipoAtencionSchema>;

export const TIPOS_EVENTO = [
  'enfermedad_comun',
  'enfermedad_profesional',
  'accidente_trabajo',
  'incidente_trabajo',
] as const;
export const tipoEventoSchema = z.enum(TIPOS_EVENTO, { error: 'Elige el tipo de evento' });
export type TipoEvento = z.infer<typeof tipoEventoSchema>;

export const NOMBRES_TIPO_EVENTO: Record<TipoEvento, string> = {
  enfermedad_comun: 'Enfermedad común',
  enfermedad_profesional: 'Enfermedad profesional',
  accidente_trabajo: 'Accidente de trabajo',
  incidente_trabajo: 'Incidente de trabajo',
};

/** Diagnósticos adicionales por atención, además del principal (tabla atencion_diagnostico). */
export const MAX_DIAGNOSTICOS_ADICIONALES = 5;

/** Margen para la "fecha no futura" (relojes del navegador y del servidor no siempre coinciden). */
export const TOLERANCIA_FECHA_FUTURA_MS = 2 * 60_000;

// ------------------------------------------------------------ campos comunes

const vacioAIndefinido = (valor: unknown) => {
  if (valor === '' || valor === null || valor === undefined) return undefined;
  if (typeof valor === 'number' && Number.isNaN(valor)) return undefined;
  if (typeof valor === 'string') {
    const numero = Number(valor.trim().replace(',', '.'));
    return Number.isNaN(numero) ? valor : numero;
  }
  return valor;
};

function enteroOpcional(nombre: string, min: number, max: number) {
  return z.preprocess(
    vacioAIndefinido,
    z
      .number({ error: `${nombre}: escribe un número` })
      .int(`${nombre}: debe ser un número entero`)
      .min(min, `${nombre}: el valor mínimo es ${min}`)
      .max(max, `${nombre}: el valor máximo es ${max}`)
      .optional(),
  );
}

function textoObligatorio(mensaje: string, max: number) {
  return z.string({ error: mensaje }).trim().min(1, mensaje).max(max, `Máximo ${max} caracteres`);
}

function textoOpcional(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((valor) => valor || undefined);
}

const fechaOpcionalSchema = z.preprocess(
  (valor) => (valor === '' || valor === null ? undefined : valor),
  fechaSchema.optional(),
);

/**
 * Fecha y hora de la atención: 'YYYY-MM-DDTHH:mm' (hora de Ecuador, como la da un input
 * datetime-local) o un ISO con zona. Sale siempre como ISO en UTC.
 */
const fechaHoraSchema = z
  .string({ error: 'Ingresa la fecha y hora' })
  .trim()
  .min(1, 'Ingresa la fecha y hora')
  .transform((valor, ctx) => {
    const instante = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(valor)
      ? instanteDeHoraLocal(valor)
      : /(Z|[+-]\d{2}:\d{2})$/.test(valor)
        ? new Date(valor)
        : new Date(Number.NaN);
    if (Number.isNaN(instante.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'La fecha y hora no es válida' });
      return z.NEVER;
    }
    return instante.toISOString();
  });

// -------------------------------------------------------------- secciones

export const signosVitalesSchema = z.object({
  presionSistolica: enteroOpcional('TA sistólica', 50, 300),
  presionDiastolica: enteroOpcional('TA diastólica', 20, 200),
  frecuenciaCardiaca: enteroOpcional('FC', 20, 250),
  frecuenciaRespiratoria: enteroOpcional('FR', 4, 80),
  saturacionO2: enteroOpcional('SatO2', 50, 100),
  temperatura: z.preprocess(
    vacioAIndefinido,
    z
      .number({ error: 'Temperatura: escribe un número' })
      .min(30, 'Temperatura: el valor mínimo es 30,0')
      .max(45, 'Temperatura: el valor máximo es 45,0')
      .transform((t) => Math.round(t * 10) / 10)
      .optional(),
  ),
});

export const detalleRecetaSchema = z.object({
  idMedicamento: z.number({ error: 'Elige el medicamento' }).int().positive('Elige el medicamento'),
  cantidad: z.preprocess(
    vacioAIndefinido,
    z
      .number({ error: 'Ingresa la cantidad' })
      .int('La cantidad debe ser un número entero')
      .min(1, 'La cantidad debe ser mayor que 0')
      .max(9999, 'La cantidad máxima es 9999'),
  ),
  dosis: textoObligatorio('Ingresa la dosis', 50),
  frecuencia: textoObligatorio('Ingresa la frecuencia', 50),
  duracion: textoObligatorio('Ingresa la duración', 50),
  indicaciones: textoOpcional(255),
});

export const recetaSchema = z.object({
  medicamentos: z.array(detalleRecetaSchema).max(20, 'Máximo 20 medicamentos por receta'),
  recomendaciones: textoOpcional(5000),
  signosAlarma: textoOpcional(5000),
  /** El médico confirma recetar aunque haya una alerta de alergia (RN-06). */
  recetarDeTodosModos: z.boolean().default(false),
});

export const certificadoSchema = z.object({
  dias: z.preprocess(
    vacioAIndefinido,
    z
      .number({ error: 'Ingresa los días de reposo' })
      .int('Los días deben ser un número entero')
      .min(1, 'El reposo es de 1 a 365 días')
      .max(365, 'El reposo es de 1 a 365 días'),
  ),
  fechaInicio: fechaSchema,
});

// ----------------------------------------------------------- nueva atención

/** Cuerpo de `POST /api/v1/atenciones` (y valores del formulario "Nueva atención"). */
export const nuevaAtencionSchema = z
  .object({
    idPaciente: z.number().int().positive(),
    tipoAtencion: tipoAtencionSchema,
    fecha: fechaHoraSchema,
    motivo: textoObligatorio('Ingresa el motivo de consulta', 5000),
    enfermedadActual: textoObligatorio('Describe la enfermedad actual', 5000),
    idCie10: z
      .string({ error: 'Elige el diagnóstico CIE-10' })
      .trim()
      .min(1, 'Elige el diagnóstico CIE-10')
      .max(10),
    /** Códigos CIE-10 adicionales, en el orden en que se registraron. */
    diagnosticosAdicionales: z
      .array(
        z.string({ error: 'Elige el diagnóstico' }).trim().min(1, 'Elige el diagnóstico').max(10),
      )
      .max(
        MAX_DIAGNOSTICOS_ADICIONALES,
        `Máximo ${MAX_DIAGNOSTICOS_ADICIONALES} diagnósticos adicionales`,
      )
      .default([]),
    tipoEvento: tipoEventoSchema,
    ocurrioEnTrabajo: z.boolean().nullable().optional(),
    signosVitales: signosVitalesSchema.optional(),
    examenFisico: textoOpcional(5000),
    tratamiento: textoOpcional(5000),
    observaciones: textoOpcional(5000),
    receta: recetaSchema.optional(),
    certificado: certificadoSchema.optional(),
    proximaCita: fechaOpcionalSchema,
  })
  .superRefine((datos, ctx) => {
    // RN-04: la fecha no puede ser futura
    if (new Date(datos.fecha).getTime() > Date.now() + TOLERANCIA_FECHA_FUTURA_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['fecha'],
        message: 'La fecha de la atención no puede ser futura',
      });
    }
    // RN-04: la próxima cita, si existe, es posterior al día de la atención
    if (datos.proximaCita && datos.proximaCita <= fechaLocal(datos.fecha)) {
      ctx.addIssue({
        code: 'custom',
        path: ['proximaCita'],
        message: 'La próxima cita debe ser posterior a la fecha de la atención',
      });
    }
    // Diagnósticos adicionales sin repetir (ni repetir el principal)
    const vistosCie10 = new Set([datos.idCie10.toUpperCase()]);
    datos.diagnosticosAdicionales.forEach((codigo, indice) => {
      if (codigo && vistosCie10.has(codigo.toUpperCase())) {
        ctx.addIssue({
          code: 'custom',
          path: ['diagnosticosAdicionales', indice],
          message: 'Este diagnóstico ya está en la atención',
        });
      }
      vistosCie10.add(codigo.toUpperCase());
    });
    // RN-05: si algún diagnóstico (principal o adicional) es S o T
    if (
      algunoRequierePreguntaTrabajo([datos.idCie10, ...datos.diagnosticosAdicionales]) &&
      typeof datos.ocurrioEnTrabajo !== 'boolean'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ocurrioEnTrabajo'],
        message: 'Indica si ocurrió en el trabajo',
      });
    }
    if (datos.tipoEvento === 'accidente_trabajo' && datos.ocurrioEnTrabajo !== true) {
      ctx.addIssue({
        code: 'custom',
        path: ['ocurrioEnTrabajo'],
        message: 'Un accidente de trabajo debe haber ocurrido en el trabajo',
      });
    }
    // RN-09: sistólica > diastólica
    const signos = datos.signosVitales;
    if (
      signos?.presionSistolica !== undefined &&
      signos.presionDiastolica !== undefined &&
      signos.presionSistolica <= signos.presionDiastolica
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['signosVitales', 'presionSistolica'],
        message: 'La sistólica debe ser mayor que la diastólica',
      });
    }
    // RN-07: receta con al menos un medicamento o una recomendación; sin repetir medicamentos
    const receta = datos.receta;
    if (receta) {
      const vacia = receta.medicamentos.length === 0 && !receta.recomendaciones;
      if (vacia && receta.signosAlarma) {
        ctx.addIssue({
          code: 'custom',
          path: ['receta', 'recomendaciones'],
          message: 'La receta necesita al menos un medicamento o una recomendación',
        });
      }
      const vistos = new Set<number>();
      receta.medicamentos.forEach((detalle, indice) => {
        if (vistos.has(detalle.idMedicamento)) {
          ctx.addIssue({
            code: 'custom',
            path: ['receta', 'medicamentos', indice, 'idMedicamento'],
            message: 'Este medicamento ya está en la receta',
          });
        }
        vistos.add(detalle.idMedicamento);
      });
    }
  })
  .transform((datos) => {
    const receta = datos.receta;
    const sinReceta =
      !receta ||
      (receta.medicamentos.length === 0 && !receta.recomendaciones && !receta.signosAlarma);
    // Si el diagnóstico no es S/T y no es accidente de trabajo, la pregunta no aplica.
    const ocurrioEnTrabajo =
      typeof datos.ocurrioEnTrabajo === 'boolean' ? datos.ocurrioEnTrabajo : null;
    return { ...datos, ocurrioEnTrabajo, receta: sinReceta ? undefined : receta };
  });

/** Valores del formulario (entrada del esquema). */
export type NuevaAtencionEntrada = z.input<typeof nuevaAtencionSchema>;
/** Datos ya validados y normalizados (lo que recibe la API). */
export type NuevaAtencion = z.output<typeof nuevaAtencionSchema>;
