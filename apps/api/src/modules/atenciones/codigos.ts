import { Prisma } from '../../generated/prisma/client.js';

/** Tablas con código correlativo por año (RN-13). */
export const SERIES = {
  atencion: { tabla: 'atencion', prefijo: 'ATE' },
  evolucion: { tabla: 'evolucion_medica', prefijo: 'EVO' },
  certificado: { tabla: 'certificado_reposo', prefijo: 'CER' },
} as const;
export type Serie = keyof typeof SERIES;

/** ATE-2026-0001: prefijo, año y número con al menos 4 dígitos. */
export function formatearCodigo(prefijo: string, anio: number, numero: number): string {
  return `${prefijo}-${anio}-${String(numero).padStart(4, '0')}`;
}

/** Número de un código ATE-2026-0042 → 42 (null si no tiene el formato). */
export function numeroDeCodigo(codigo: string): number | null {
  const coincidencia = /^[A-Z]{3}-\d{4}-(\d{4,})$/.exec(codigo);
  return coincidencia ? Number(coincidencia[1]) : null;
}

/** Cliente de Prisma dentro de una transacción. */
type ClienteTransaccion = Pick<Prisma.TransactionClient, '$queryRaw'>;

/**
 * Siguiente código de la serie para el año. Debe llamarse DENTRO de la transacción que inserta
 * la fila: el SELECT … FOR UPDATE bloquea los códigos del año hasta el COMMIT, así otra
 * transacción espera y obtiene el número siguiente. (Se compara numéricamente porque, pasado el
 * 9999, el orden alfabético ya no sirve.)
 */
export async function siguienteCodigo(
  tx: ClienteTransaccion,
  serie: Serie,
  anio: number,
): Promise<string> {
  const { tabla, prefijo } = SERIES[serie];
  const filas = await tx.$queryRaw<{ ultimo: bigint | number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(codigo, ${prefijo.length + 7}) AS UNSIGNED)) AS ultimo
    FROM ${Prisma.raw(tabla)}
    WHERE codigo LIKE ${`${prefijo}-${anio}-%`}
    FOR UPDATE`;
  const ultimo = Number(filas[0]?.ultimo ?? 0);
  return formatearCodigo(prefijo, anio, ultimo + 1);
}
