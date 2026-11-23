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
