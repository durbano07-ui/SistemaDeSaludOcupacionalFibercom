import { z } from 'zod';

import { cie10Schema } from '../catalogos/catalogo.schema.js';
import { fechaSchema, mesSchema } from '../fechas/fechas.js';
import { tipoAtencionSchema, tipoEventoSchema } from './atencion.schema.js';

/** Fila de las tablas "Atenciones" y "Consultas anteriores". */
export const atencionListadaSchema = z.object({
  id: z.number().int(),
  codigo: z.string(),
  /** Instante ISO (UTC). */
  fecha: z.string(),
  tipoAtencion: tipoAtencionSchema,
  paciente: z.object({
    id: z.number().int(),
    apellidos: z.string(),
    nombres: z.string(),
    cedula: z.string(),
  }),
  cargo: z.string(),
  motivo: z.string(),
  diagnostico: cie10Schema,
  /** Diagnósticos adicionales, en orden. */
  diagnosticosAdicionales: z.array(cie10Schema),
  tieneReceta: z.boolean(),
  tieneCertificado: z.boolean(),
});
export type AtencionListada = z.infer<typeof atencionListadaSchema>;

/** Consulta de `GET /pacientes/:id/atenciones?mes=`. */
export const consultaAtencionesMesSchema = z.object({ mes: mesSchema });

/** Respuesta de `GET /pacientes/:id/atenciones?mes=`. */
export const atencionesDelMesSchema = z.object({
  mes: z.string(),
  atenciones: z.array(atencionListadaSchema),
});
export type AtencionesDelMes = z.infer<typeof atencionesDelMesSchema>;

export const TAMANO_PAGINA_HISTORIAL = 10;

/** Consulta de `GET /pacientes/:id/atenciones/historial`. */
export const consultaHistorialSchema = z.object({
  pagina: z.coerce.number().int().min(1, 'La página empieza en 1').default(1),
  tamano: z.coerce
    .number()
    .int()
    .min(1)
    .max(50, 'Máximo 50 por página')
    .default(TAMANO_PAGINA_HISTORIAL),
});

/** Respuesta de `GET /pacientes/:id/atenciones/historial`. */
export const historialAtencionesSchema = z.object({
  pagina: z.number().int(),
  tamano: z.number().int(),
  total: z.number().int(),
  atenciones: z.array(atencionListadaSchema),
});
export type HistorialAtenciones = z.infer<typeof historialAtencionesSchema>;

export const alertaSignoVitalSchema = z.object({ campo: z.string(), mensaje: z.string() });
export const coincidenciaAlergiaSchema = z.object({
  idMedicamento: z.number().int(),
  medicamento: z.string(),
  alergia: z.string(),
  por: z.enum(['nombre', 'grupo']),
});

export const advertenciasAtencionSchema = z.object({
  alergias: z.array(coincidenciaAlergiaSchema),
  signosVitales: z.array(alertaSignoVitalSchema),
});
export type AdvertenciasAtencion = z.infer<typeof advertenciasAtencionSchema>;

/** Respuesta 201 de `POST /atenciones`. */
export const atencionRegistradaSchema = z.object({
  id: z.number().int(),
  codigo: z.string(),
  codigoEvolucion: z.string(),
  codigoCertificado: z.string().nullable(),
  idCaso: z.number().int(),
  tipoAtencion: tipoAtencionSchema,
  advertencias: advertenciasAtencionSchema,
});
export type AtencionRegistrada = z.infer<typeof atencionRegistradaSchema>;

/** `GET /atenciones/:id`: todo lo necesario para ver la receta o el certificado. */
export const atencionDetalleSchema = z.object({
  id: z.number().int(),
  codigo: z.string(),
  fecha: z.string(),
  tipoAtencion: tipoAtencionSchema,
  tipoEvento: tipoEventoSchema,
  ocurrioEnTrabajo: z.boolean().nullable(),
  observaciones: z.string().nullable(),
  proximaCita: fechaSchema.nullable(),
  diagnostico: cie10Schema,
  /** Diagnósticos adicionales, en orden. */
  diagnosticosAdicionales: z.array(cie10Schema),
  paciente: z.object({
    id: z.number().int(),
    apellidos: z.string(),
    nombres: z.string(),
    cedula: z.string(),
    edad: z.number().int(),
    sexo: z.enum(['hombre', 'mujer']),
    cargo: z.string(),
    departamento: z.string(),
    base: z.string(),
  }),
  medico: z.object({
    nombres: z.string(),
    apellidos: z.string(),
    codigoMedico: z.string().nullable(),
  }),
  evolucion: z.object({
    codigo: z.string(),
    motivo: z.string(),
    enfermedadActual: z.string(),
    presionSistolica: z.number().nullable(),
    presionDiastolica: z.number().nullable(),
    frecuenciaCardiaca: z.number().nullable(),
    frecuenciaRespiratoria: z.number().nullable(),
    saturacionO2: z.number().nullable(),
    temperatura: z.number().nullable(),
    examenFisico: z.string().nullable(),
    tratamiento: z.string().nullable(),
  }),
  receta: z
    .object({
      advertencias: z.string().nullable(),
      recomendaciones: z.string().nullable(),
      signosAlarma: z.string().nullable(),
      medicamentos: z.array(
        z.object({
          nombre: z.string(),
          presentacion: z.string(),
          concentracion: z.string(),
          cantidad: z.number().int(),
          dosis: z.string(),
          frecuencia: z.string(),
          duracion: z.string(),
          indicaciones: z.string().nullable(),
        }),
      ),
    })
    .nullable(),
  certificado: z
    .object({
      codigo: z.string(),
      dias: z.number().int(),
      fechaInicio: fechaSchema,
      fechaFin: fechaSchema,
      observacion: z.string().nullable(),
    })
    .nullable(),
});
export type AtencionDetalle = z.infer<typeof atencionDetalleSchema>;
