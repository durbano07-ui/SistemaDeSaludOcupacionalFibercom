import {
  atencionDetalleSchema,
  atencionesDelMesSchema,
  type AtencionRegistrada,
  atencionRegistradaSchema,
  historialAtencionesSchema,
  listaCie10Schema,
  listaMedicamentosSchema,
  listaPacientesSchema,
  type NuevaAtencion,
  resumenPacienteSchema,
  TAMANO_PAGINA_HISTORIAL,
} from '@smo/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { enviar, pedir } from './api';

/** Claves de TanStack Query: todo lo de un paciente cuelga de ['paciente', id]. */
export const claves = {
  busquedaPacientes: (q: string) => ['pacientes', 'busqueda', q] as const,
  paciente: (id: number) => ['paciente', id] as const,
  atencionesMes: (id: number, mes: string) => ['paciente', id, 'atenciones', mes] as const,
  historial: (id: number, pagina: number) => ['paciente', id, 'historial', pagina] as const,
  atencion: (id: number) => ['atencion', id] as const,
  cie10: (q: string) => ['cie10', q] as const,
  medicamentos: (q: string) => ['medicamentos', q] as const,
};

const MIN_BUSQUEDA = 2;
const conQ = (q: string) => `?q=${encodeURIComponent(q)}`;

/** Devuelve el valor cuando deja de cambiar durante `espera` ms. */
export function useRetardado<T>(valor: T, espera = 300): T {
  const [retardado, setRetardado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setRetardado(valor), espera);
    return () => clearTimeout(temporizador);
  }, [valor, espera]);
  return retardado;
}

export function useBusquedaPacientes(q: string) {
  const termino = q.trim();
  return useQuery({
    queryKey: claves.busquedaPacientes(termino),
    queryFn: () => pedir(`/pacientes${conQ(termino)}`, listaPacientesSchema),
    enabled: termino.length >= MIN_BUSQUEDA,
    staleTime: 10_000,
  });
}

export function useResumenPaciente(id: number | null) {
  return useQuery({
    queryKey: claves.paciente(id ?? 0),
    queryFn: () => pedir(`/pacientes/${id}`, resumenPacienteSchema),
    enabled: id !== null,
  });
}

export function useAtencionesMes(id: number, mes: string) {
  return useQuery({
    queryKey: claves.atencionesMes(id, mes),
    queryFn: () => pedir(`/pacientes/${id}/atenciones?mes=${mes}`, atencionesDelMesSchema),
  });
}

export function useHistorial(id: number, pagina: number) {
  return useQuery({
    queryKey: claves.historial(id, pagina),
    queryFn: () =>
      pedir(
        `/pacientes/${id}/atenciones/historial?pagina=${pagina}&tamano=${TAMANO_PAGINA_HISTORIAL}`,
        historialAtencionesSchema,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAtencionDetalle(id: number | null) {
  return useQuery({
    queryKey: claves.atencion(id ?? 0),
    queryFn: () => pedir(`/atenciones/${id}`, atencionDetalleSchema),
    enabled: id !== null,
  });
}

export function useBuscarCie10(q: string) {
  const termino = q.trim();
  return useQuery({
    queryKey: claves.cie10(termino),
    queryFn: () => pedir(`/cie10${conQ(termino)}`, listaCie10Schema),
    enabled: termino.length >= MIN_BUSQUEDA,
    staleTime: 5 * 60_000,
  });
}

export function useBuscarMedicamentos(q: string) {
  const termino = q.trim();
  return useQuery({
    queryKey: claves.medicamentos(termino),
    queryFn: () => pedir(`/medicamentos${conQ(termino)}`, listaMedicamentosSchema),
    enabled: termino.length >= MIN_BUSQUEDA,
    staleTime: 5 * 60_000,
  });
}

/** Registra la atención y refresca todo lo del paciente (tarjeta, tablas, historial). */
export function useRegistrarAtencion(idPaciente: number) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: NuevaAtencion): Promise<AtencionRegistrada> =>
      enviar('/atenciones', atencionRegistradaSchema, datos),
    onSuccess: () => cliente.invalidateQueries({ queryKey: claves.paciente(idPaciente) }),
  });
}
