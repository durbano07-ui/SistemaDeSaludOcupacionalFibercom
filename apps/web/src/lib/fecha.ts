import 'dayjs/locale/es';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

/** Zona horaria del sistema: todas las fechas se muestran en hora de Ecuador continental. */
export const ZONA_HORARIA = 'America/Guayaquil';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('es');
dayjs.tz.setDefault(ZONA_HORARIA);

/** Formatea una fecha ISO como `dd/mm/aaaa hh:mm:ss` en hora de Ecuador. */
export function formatearFechaHora(fecha: string | Date): string {
  return dayjs(fecha).tz(ZONA_HORARIA).format('DD/MM/YYYY HH:mm:ss');
}

export { dayjs };

/** Solo la fecha `dd/mm/aaaa` de un instante, en hora de Ecuador. */
export function formatearFecha(instante: string | Date): string {
  return dayjs(instante).tz(ZONA_HORARIA).format('DD/MM/YYYY');
}

/** Fecha de calendario 'YYYY-MM-DD' (columna DATE) como `dd/mm/aaaa`, sin conversión de zona. */
export function formatearDia(dia: string): string {
  const [anio, mes, numero] = dia.split('-');
  return `${numero}/${mes}/${anio}`;
}

/** 'YYYY-MM' → "noviembre de 2026". */
export function nombreMes(mes: string): string {
  return dayjs(`${mes}-01`).format('MMMM [de] YYYY');
}

/** Los últimos `cantidad` meses (el actual primero) como 'YYYY-MM', en hora de Ecuador. */
export function ultimosMeses(cantidad: number, ahora: Date = new Date()): string[] {
  const actual = dayjs(ahora).tz(ZONA_HORARIA).startOf('month');
  return Array.from({ length: cantidad }, (_, i) => actual.subtract(i, 'month').format('YYYY-MM'));
}
