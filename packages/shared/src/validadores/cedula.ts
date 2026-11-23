import { z } from 'zod';

const COEFICIENTES = [2, 1, 2, 1, 2, 1, 2, 1, 2] as const;

/**
 * Valida una cédula de identidad ecuatoriana:
 * - exactamente 10 dígitos;
 * - código de provincia 01–24, o 30 (ecuatorianos registrados en el exterior);
 * - tercer dígito menor que 6 (persona natural);
 * - dígito verificador según el algoritmo módulo 10.
 */
export function esCedulaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;

  const digitos = Array.from(cedula, Number);
  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if ((digitos[2] ?? 9) >= 6) return false;

  const suma = COEFICIENTES.reduce((total, coeficiente, i) => {
    const producto = (digitos[i] ?? 0) * coeficiente;
    return total + (producto > 9 ? producto - 9 : producto);
  }, 0);
  const verificador = (10 - (suma % 10)) % 10;

  return verificador === digitos[9];
}

/** Esquema Zod de una cédula ecuatoriana válida. */
export const cedulaSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'La cédula debe tener exactamente 10 dígitos')
  .refine(esCedulaValida, 'La cédula no es válida');
