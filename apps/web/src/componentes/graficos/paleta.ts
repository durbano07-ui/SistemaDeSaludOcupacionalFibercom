/**
 * Paleta de gráficos basada en FIBERCOM. Además del tono, los colores difieren en claridad
 * (oscuro → claro), para distinguirse también en escala de grises o con daltonismo.
 */
export const PALETA = [
  '#1D1D1B', // negro FIBERCOM (muy oscuro)
  '#C14130', // rojo FIBERCOM (medio)
  '#F3A600', // amarillo FIBERCOM (claro)
  '#6F6F6F', // gris (medio-oscuro)
  '#E8A598', // rojo claro
  '#A8A8A8', // gris claro
  '#862C19', // rojo oscuro
  '#FFD670', // amarillo claro
] as const;

/** Colores fijos de las categorías que se repiten entre gráficos. */
export const COLORES_CATEGORIA: Record<string, string> = {
  'Enfermedad común': '#C14130',
  'Enfermedad profesional': '#1D1D1B',
  'Accidente de trabajo': '#F3A600',
  'Incidente de trabajo': '#A8A8A8',
  'Primera vez': '#C14130',
  Subsecuente: '#1D1D1B',
};

/** Escala de colores para Carbon Charts: categorías conocidas y, si no, la paleta en orden. */
export function escalaColores(grupos: readonly string[]): Record<string, string> {
  let siguiente = 0;
  return Object.fromEntries(
    grupos.map((g) => [g, COLORES_CATEGORIA[g] ?? PALETA[siguiente++ % PALETA.length]!]),
  );
}
