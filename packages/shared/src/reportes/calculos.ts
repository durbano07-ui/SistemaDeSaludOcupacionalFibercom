/** Reglas de cálculo de los reportes (puras: se prueban sin base de datos). */

export const NOMBRES_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/** Trimestre (1–4) de un mes (1–12). */
export function trimestreDeMes(mes: number): 1 | 2 | 3 | 4 {
  return (Math.floor((mes - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

/** Meses (1–12) de un trimestre (1–4). */
export function mesesDelTrimestre(trimestre: number): [number, number, number] {
  const primero = (trimestre - 1) * 3 + 1;
  return [primero, primero + 1, primero + 2];
}

/** Porcentaje (0–100, dos decimales) de `valor` sobre `total`; null si el total es 0. */
export function porcentajeDe(valor: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((valor / total) * 10_000) / 100;
}

export type TipoMetaSst = 'porcentaje_maximo' | 'casos_maximo' | 'informativa';
export type Cumple = 'si' | 'no' | null;

/**
 * Cumple de una meta SST en un trimestre.
 * - porcentaje_maximo: % del trimestre <= límite (sin atenciones en el trimestre → "—").
 * - casos_maximo: total del trimestre <= límite.
 * - informativa: no se evalúa ("—").
 */
export function evaluarMeta(
  meta: { tipo: TipoMetaSst; limite: number | null },
  fila: { total: number; porcentaje: number | null },
): Cumple {
  if (meta.tipo === 'informativa' || meta.limite === null) return null;
  if (meta.tipo === 'casos_maximo') return fila.total <= meta.limite ? 'si' : 'no';
  if (fila.porcentaje === null) return null;
  return fila.porcentaje <= meta.limite ? 'si' : 'no';
}

export interface MedicamentoRecetado {
  nombre: string;
  concentracion: string;
  dosis: string;
  frecuencia: string;
}

/** Abrevia "cada 8 horas" → "c/8 h" (forma usual en el registro en papel). */
function abreviarFrecuencia(frecuencia: string): string {
  return frecuencia
    .trim()
    .replace(/^cada\s+(\d+)\s*(horas?|h)\b/i, 'c/$1 h')
    .replace(/^cada\s+(\d+)\s*(d[ií]as?)\b/i, 'c/$1 d');
}

/** Abrevia "1 tableta" / "1 cápsula" → "1 t" / "1 c". */
function abreviarDosis(dosis: string): string {
  return dosis
    .trim()
    .replace(/^(\d+(?:[.,]\d+)?)\s*tabletas?\b/i, '$1 t')
    .replace(/^(\d+(?:[.,]\d+)?)\s*c[aá]psulas?\b/i, '$1 c');
}

/**
 * "Medicamento usado/dosificación" del registro mensual:
 * "Ibuprofeno 400 mg – 1 c/8 h; Paracetamol 500 mg – 1 t c/8 h". Sin receta: "—".
 */
export function textoMedicamentos(medicamentos: readonly MedicamentoRecetado[]): string {
  if (medicamentos.length === 0) return '—';
  return medicamentos
    .map((m) => {
      const dosificacion = [abreviarDosis(m.dosis), abreviarFrecuencia(m.frecuencia)]
        .filter(Boolean)
        .join(' ');
      return `${m.nombre} ${m.concentracion} – ${dosificacion}`;
    })
    .join('; ');
}
