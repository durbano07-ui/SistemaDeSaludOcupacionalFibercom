/**
 * Hora de Ecuador continental para los reportes: UTC−05:00 FIJO (Ecuador no tiene horario de
 * verano). Se usa un desplazamiento fijo, también en SQL (DATE_SUB … INTERVAL 5 HOUR), porque la
 * MariaDB del hosting puede no tener cargadas las tablas de zonas horarias para CONVERT_TZ.
 */
export const HORAS_DETRAS_DE_UTC = 5;
const MS_DESPLAZAMIENTO = HORAS_DETRAS_DE_UTC * 3_600_000;

/** Año, mes (1–12) y día de Ecuador de un instante UTC. */
export function fechaEcuador(instante: Date): { anio: number; mes: number; dia: number } {
  const local = new Date(instante.getTime() - MS_DESPLAZAMIENTO);
  return { anio: local.getUTCFullYear(), mes: local.getUTCMonth() + 1, dia: local.getUTCDate() };
}

/**
 * Instantes UTC [desde, hasta) del período de Ecuador que va del mes `mesDesde` al `mesHasta`
 * (inclusive) del año. Se usan en el WHERE para aprovechar el índice de `atencion.fecha`.
 */
export function rangoUtc(anio: number, mesDesde = 1, mesHasta = 12): { desde: Date; hasta: Date } {
  return {
    desde: new Date(Date.UTC(anio, mesDesde - 1, 1) + MS_DESPLAZAMIENTO),
    hasta: new Date(Date.UTC(anio, mesHasta, 1) + MS_DESPLAZAMIENTO),
  };
}
