import { z } from 'zod';

/** Texto de búsqueda de los buscadores (CIE-10, medicamentos, pacientes): desde 2 caracteres. */
export const busquedaSchema = z.object({
  q: z
    .string({ error: 'Escribe al menos 2 caracteres' })
    .trim()
    .min(2, 'Escribe al menos 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),
});

export const cie10Schema = z.object({
  codigo: z.string(),
  descripcion: z.string(),
});
export type Cie10 = z.infer<typeof cie10Schema>;
export const listaCie10Schema = z.array(cie10Schema);

export const medicamentoSchema = z.object({
  id: z.number().int(),
  nombre: z.string(),
  presentacion: z.string(),
  concentracion: z.string(),
  grupoFarmacologico: z.string().nullable(),
});
export type Medicamento = z.infer<typeof medicamentoSchema>;
export const listaMedicamentosSchema = z.array(medicamentoSchema);
