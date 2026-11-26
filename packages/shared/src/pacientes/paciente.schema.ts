import { z } from 'zod';

import { cie10Schema } from '../catalogos/catalogo.schema.js';

/** Resultado de `GET /pacientes?q=` (la cédula sirve para buscar; la tabla no la muestra). */
export const pacienteEncontradoSchema = z.object({
  id: z.number().int(),
  apellidos: z.string(),
  nombres: z.string(),
  cedula: z.string(),
  base: z.string(),
});
export type PacienteEncontrado = z.infer<typeof pacienteEncontradoSchema>;
export const listaPacientesSchema = z.array(pacienteEncontradoSchema);

export const TIPOS_CONDICION = [
  'grupo_vulnerable',
  'discapacidad',
  'enfermedad_catastrofica',
] as const;

/** Condición prioritaria activa (sin fecha de salida). */
export const condicionPrioritariaSchema = z.object({
  tipo: z.enum(TIPOS_CONDICION),
  nombre: z.string(),
  /** Por ejemplo, el porcentaje de discapacidad. */
  detalle: z.string().nullable(),
});
export type CondicionPrioritaria = z.infer<typeof condicionPrioritariaSchema>;

export const casoAbiertoSchema = z.object({
  id: z.number().int(),
  cie10: cie10Schema,
  /** 'YYYY-MM-DD' */
  fechaApertura: z.string(),
});
export type CasoAbierto = z.infer<typeof casoAbiertoSchema>;

/** `GET /pacientes/:id`: datos de la tarjeta del paciente. */
export const resumenPacienteSchema = z.object({
  id: z.number().int(),
  apellidos: z.string(),
  nombres: z.string(),
  cedula: z.string(),
  edad: z.number().int(),
  sexo: z.enum(['hombre', 'mujer']),
  cargo: z.string(),
  departamento: z.string(),
  base: z.string(),
  /** Texto de la historia clínica, o null si no hay alergias registradas. */
  alergias: z.string().nullable(),
  condiciones: z.array(condicionPrioritariaSchema),
  casoAbierto: casoAbiertoSchema.nullable(),
});
export type ResumenPaciente = z.infer<typeof resumenPacienteSchema>;
