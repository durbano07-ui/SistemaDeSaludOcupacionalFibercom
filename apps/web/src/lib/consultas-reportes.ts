import {
  type ActualizarMetaSst,
  consolidadoAnualSchema,
  gestionSchema,
  type IndicadorSst,
  informeTrimestralSchema,
  listaMetasSstSchema,
  metaSstSchema,
  modulosSchema,
  morbilidadSchema,
  opcionesReporteSchema,
  registroMensualSchema,
  rendimientoSchema,
  usuariosActivosSchema,
} from '@smo/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { enviar, pedir } from './api';

/** Filtros aplicados en la pantalla de reportes. */
export interface FiltrosAplicados {
  anio: number;
  mes?: number;
  trimestre?: number;
  base?: number;
  cargo?: number;
}

/** Query string con solo los filtros definidos. */
export function consulta(filtros: Partial<FiltrosAplicados> & Record<string, unknown>): string {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') parametros.set(clave, String(valor));
  }
  return parametros.toString();
}

export const clavesReportes = {
  opciones: ['reportes', 'opciones'] as const,
  reporte: (tipo: string, filtros: object) => ['reportes', tipo, filtros] as const,
  metas: ['metas-sst'] as const,
  admin: (que: string, extra?: string) => ['admin', 'estadisticas', que, extra] as const,
};

const comun = { placeholderData: keepPreviousData, staleTime: 60_000 } as const;

export function useOpcionesReporte() {
  return useQuery({
    queryKey: clavesReportes.opciones,
    queryFn: () => pedir('/reportes/opciones', opcionesReporteSchema),
    staleTime: 10 * 60_000,
  });
}

export function useRegistroMensual(f: FiltrosAplicados) {
  const filtros = { anio: f.anio, mes: f.mes, base: f.base, cargo: f.cargo };
  return useQuery({
    queryKey: clavesReportes.reporte('registro-mensual', filtros),
    queryFn: () => pedir(`/reportes/registro-mensual?${consulta(filtros)}`, registroMensualSchema),
    ...comun,
  });
}

export function useConsolidadoAnual(f: FiltrosAplicados) {
  const filtros = { anio: f.anio, base: f.base, cargo: f.cargo };
  return useQuery({
    queryKey: clavesReportes.reporte('consolidado-anual', filtros),
    queryFn: () =>
      pedir(`/reportes/consolidado-anual?${consulta(filtros)}`, consolidadoAnualSchema),
    ...comun,
  });
}

export function useInformeTrimestral(f: FiltrosAplicados) {
  const filtros = { anio: f.anio, trimestre: f.trimestre, base: f.base, cargo: f.cargo };
  return useQuery({
    queryKey: clavesReportes.reporte('informe-trimestral', filtros),
    queryFn: () =>
      pedir(`/reportes/informe-trimestral?${consulta(filtros)}`, informeTrimestralSchema),
    ...comun,
  });
}

export function useMorbilidad(f: FiltrosAplicados) {
  const filtros = {
    anio: f.anio,
    mes: f.mes,
    trimestre: f.trimestre,
    base: f.base,
    cargo: f.cargo,
  };
  return useQuery({
    queryKey: clavesReportes.reporte('morbilidad', filtros),
    queryFn: () => pedir(`/reportes/morbilidad?${consulta(filtros)}`, morbilidadSchema),
    ...comun,
  });
}

export function useGestion(f: FiltrosAplicados) {
  const filtros = { anio: f.anio, base: f.base, cargo: f.cargo };
  return useQuery({
    queryKey: clavesReportes.reporte('gestion', filtros),
    queryFn: () => pedir(`/reportes/gestion?${consulta(filtros)}`, gestionSchema),
    ...comun,
  });
}

export function useMetasSst(habilitado = true) {
  return useQuery({
    queryKey: clavesReportes.metas,
    queryFn: () => pedir('/metas-sst', listaMetasSstSchema),
    enabled: habilitado,
  });
}

/** Guarda las metas cambiadas y refresca metas e informes trimestrales. */
export function useGuardarMetas() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (cambios: { indicador: IndicadorSst; datos: ActualizarMetaSst }[]) => {
      for (const { indicador, datos } of cambios) {
        await enviar(`/metas-sst/${indicador}`, metaSstSchema, datos, 'PUT');
      }
    },
    onSettled: async () => {
      await cliente.invalidateQueries({ queryKey: clavesReportes.metas });
      await cliente.invalidateQueries({ queryKey: ['reportes', 'informe-trimestral'] });
    },
  });
}

// ------------------------------------------------- estadísticas del administrador

const REFRESCO_MS = 30_000;

export function useRendimiento(rango: '1h' | '24h') {
  return useQuery({
    queryKey: clavesReportes.admin('rendimiento', rango),
    queryFn: () => pedir(`/admin/estadisticas/rendimiento?rango=${rango}`, rendimientoSchema),
    refetchInterval: REFRESCO_MS,
    placeholderData: keepPreviousData,
  });
}

export function useUsuariosActivos() {
  return useQuery({
    queryKey: clavesReportes.admin('usuarios'),
    queryFn: () => pedir('/admin/estadisticas/usuarios', usuariosActivosSchema),
    refetchInterval: REFRESCO_MS,
  });
}

export function useModulos() {
  return useQuery({
    queryKey: clavesReportes.admin('modulos'),
    queryFn: () => pedir('/admin/estadisticas/modulos', modulosSchema),
    refetchInterval: REFRESCO_MS,
  });
}
