import { BadRequestException, ParseIntPipe } from '@nestjs/common';
import { instanteDeHoraLocal } from '@smo/shared';

/**
 * Columnas DATE: Prisma las representa como Date a medianoche UTC. Se escriben y leen como
 * 'YYYY-MM-DD' sin conversión de zona.
 */
export function aFechaSql(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function deFechaSql(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Instantes UTC [desde, hasta) que corresponden a un mes 'YYYY-MM' en hora de Ecuador. */
export function rangoDelMes(mes: string): { desde: Date; hasta: Date } {
  const [anio, numero] = mes.split('-').map(Number);
  const siguiente =
    numero === 12 ? `${anio! + 1}-01` : `${anio}-${String(numero! + 1).padStart(2, '0')}`;
  return {
    desde: instanteDeHoraLocal(`${mes}-01T00:00`),
    hasta: instanteDeHoraLocal(`${siguiente}-01T00:00`),
  };
}

/** `@Param('id', idPipe)`: identificador numérico con el error en español. */
export const idPipe = new ParseIntPipe({
  exceptionFactory: () => new BadRequestException('El identificador no es válido'),
});
