/** "15,38 %" o "—". */
export function textoPorcentaje(porcentaje: number | null): string {
  return porcentaje === null
    ? '—'
    : `${porcentaje.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}
