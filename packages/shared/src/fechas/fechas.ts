import { z } from 'zod';

/**
 * Convención de fechas del sistema:
 * - Instantes (DATETIME) en UTC en la base; en la interfaz, hora de Ecuador continental.
 * - Días (DATE) como texto 'YYYY-MM-DD', sin conversión de zona.
 */
export const ZONA_HORARIA_SISTEMA = 'America/Guayaquil';

const formatoPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA_SISTEMA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function partesLocales(instante: Date): Record<string, number> {
  const partes: Record<string, number> = {};
  for (const { type, value } of formatoPartes.formatToParts(instante)) {
    if (type !== 'literal') partes[type] = Number(value);
  }
  return partes;
}

/** Día local (Ecuador) de un instante, como 'YYYY-MM-DD'. */
export function fechaLocal(instante: Date | string): string {
  const p = partesLocales(new Date(instante));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Minutos que la hora local está adelantada respecto de UTC en ese instante (Ecuador: −300). */
function desplazamientoMinutos(instante: Date): number {
  const p = partesLocales(instante);
  const comoUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60_000);
}

/** Convierte una fecha y hora local 'YYYY-MM-DDTHH:mm' (Ecuador) en el instante UTC. */
export function instanteDeHoraLocal(local: string): Date {
  const supuesto = Date.parse(`${local.length === 16 ? `${local}:00` : local}Z`);
  return new Date(supuesto - desplazamientoMinutos(new Date(supuesto)) * 60_000);
}

/** Fecha y hora local 'YYYY-MM-DDTHH:mm' de un instante (para inputs datetime-local). */
export function horaLocalDeInstante(instante: Date | string): string {
  const p = partesLocales(new Date(instante));
  const dos = (n: number | undefined) => String(n).padStart(2, '0');
  return `${fechaLocal(instante)}T${dos(p.hour)}:${dos(p.minute)}`;
}

/** Suma días a una fecha 'YYYY-MM-DD' (aritmética de calendario, sin zonas). */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio!, mes! - 1, dia! + dias)).toISOString().slice(0, 10);
}

/** Edad cumplida en años a la fecha `hoy` (ambas 'YYYY-MM-DD'). */
export function calcularEdad(fechaNacimiento: string, hoy: string): number {
  const [an, mn, dn] = fechaNacimiento.split('-').map(Number);
  const [ah, mh, dh] = hoy.split('-').map(Number);
  const cumplioEsteAnio = mh! > mn! || (mh === mn && dh! >= dn!);
  return ah! - an! - (cumplioEsteAnio ? 0 : 1);
}

function esFechaReal(texto: string): boolean {
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes! - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** Fecha de calendario 'YYYY-MM-DD'. */
export const fechaSchema = z
  .string({ error: 'Ingresa la fecha' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD')
  .refine(esFechaReal, 'La fecha no existe');

/** Mes 'YYYY-MM'. */
export const mesSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El mes debe tener el formato AAAA-MM');
