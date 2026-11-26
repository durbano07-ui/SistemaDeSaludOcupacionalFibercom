import { Injectable } from '@nestjs/common';
import type { Rendimiento } from '@smo/shared';

const MINUTO = 60_000;
const VENTANA_MINUTOS = 24 * 60;
/** Muestras por minuto para el percentil 95 (si llegan más, se reemplazan al azar). */
const MAX_MUESTRAS = 2_000;

interface Minuto {
  cantidad: number;
  sumaMs: number;
  muestras: number[];
}

/** Percentil p (0–100) por el método del rango más cercano. */
export function percentil(valores: readonly number[], p: number): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const posicion = Math.ceil((p / 100) * ordenados.length) - 1;
  return ordenados[Math.min(Math.max(posicion, 0), ordenados.length - 1)]!;
}

const redondear = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/**
 * Tiempos de respuesta de la API, acumulados EN MEMORIA por minuto durante las últimas 24 h.
 * Se pierden si se reinicia la API (no hay tabla para esto).
 */
@Injectable()
export class RegistroRendimiento {
  private readonly minutos = new Map<number, Minuto>();
  private readonly inicio = Date.now();

  registrar(duracionMs: number, ahora = Date.now()): void {
    const clave = Math.floor(ahora / MINUTO);
    let minuto = this.minutos.get(clave);
    if (!minuto) {
      minuto = { cantidad: 0, sumaMs: 0, muestras: [] };
      this.minutos.set(clave, minuto);
      this.limpiar(clave);
    }
    minuto.cantidad++;
    minuto.sumaMs += duracionMs;
    if (minuto.muestras.length < MAX_MUESTRAS) {
      minuto.muestras.push(duracionMs);
    } else {
      // Muestreo de reservorio: cada petición tiene la misma probabilidad de quedar
      const indice = Math.floor(Math.random() * minuto.cantidad);
      if (indice < MAX_MUESTRAS) minuto.muestras[indice] = duracionMs;
    }
  }

  private limpiar(claveActual: number): void {
    for (const clave of this.minutos.keys()) {
      if (clave <= claveActual - VENTANA_MINUTOS) this.minutos.delete(clave);
    }
  }

  /** Resumen: 1h en puntos de 1 minuto; 24h en puntos de 15 minutos. */
  resumen(rango: '1h' | '24h', ahora = Date.now()): Rendimiento {
    const [puntos, tamano] = rango === '1h' ? [60, 1] : [96, 15];
    const ultimo = Math.floor(ahora / MINUTO);
    const primero = ultimo - puntos * tamano + 1;

    let cantidad = 0;
    let suma = 0;
    const todas: number[] = [];
    const serie = Array.from({ length: puntos }, (_, i) => {
      const desde = primero + i * tamano;
      let c = 0;
      let s = 0;
      const muestras: number[] = [];
      for (let m = desde; m < desde + tamano; m++) {
        const minuto = this.minutos.get(m);
        if (!minuto) continue;
        c += minuto.cantidad;
        s += minuto.sumaMs;
        muestras.push(...minuto.muestras);
      }
      cantidad += c;
      suma += s;
      todas.push(...muestras);
      return {
        inicio: new Date(desde * MINUTO).toISOString(),
        peticiones: c,
        promedioMs: redondear(c ? s / c : null),
        p95Ms: redondear(percentil(muestras, 95)),
      };
    });

    return {
      rango,
      peticiones: cantidad,
      promedioMs: redondear(cantidad ? suma / cantidad : null),
      p95Ms: redondear(percentil(todas, 95)),
      desde: new Date(this.inicio).toISOString(),
      serie,
    };
  }
}
