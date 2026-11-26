import { fechaEcuador, HORAS_DETRAS_DE_UTC } from '../../../common/hora-ecuador.js';

/** Datos de cabecera y pie que comparten el Excel y el PDF de cada reporte. */
export interface Encabezado {
  titulo: string;
  periodo: string;
  /** "Base: Todas · Cargo: Todos" */
  filtros: string;
  /** "Generado el 26/11/2026 12:30 por Carlos Andrés Ficticio Médico" */
  pie: string;
}

export const SUBTITULO = 'FIBERCOM – Departamento de Seguridad y Salud Ocupacional';

const dos = (n: number) => String(n).padStart(2, '0');

/** dd/mm/aaaa en hora de Ecuador. */
export function fechaCorta(instante: Date | string): string {
  const { anio, mes, dia } = fechaEcuador(new Date(instante));
  return `${dos(dia)}/${dos(mes)}/${anio}`;
}

/** dd/mm/aaaa hh:mm en hora de Ecuador. */
export function fechaHora(instante: Date): string {
  const local = new Date(instante.getTime() - HORAS_DETRAS_DE_UTC * 3_600_000);
  return `${fechaCorta(instante)} ${dos(local.getUTCHours())}:${dos(local.getUTCMinutes())}`;
}

/** % para mostrar: "15,38 %" o "—". */
export function textoPorcentaje(porcentaje: number | null): string {
  return porcentaje === null ? '—' : `${porcentaje.toFixed(2).replace('.', ',')} %`;
}

export function textoCumple(cumple: 'si' | 'no' | null): string {
  return cumple === 'si' ? 'Sí' : cumple === 'no' ? 'No' : '—';
}
