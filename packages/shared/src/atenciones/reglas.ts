import { sumarDias } from '../fechas/fechas.js';

// ------------------------------------------------------------------ RN-08
/** Fecha de fin del certificado de reposo: inicio + días − 1 (el primer día cuenta). */
export function calcularFechaFin(fechaInicio: string, dias: number): string {
  return sumarDias(fechaInicio, dias - 1);
}

// ------------------------------------------------------------------ RN-05
/** Los diagnósticos S y T (traumatismos, envenenamientos) exigen "¿Ocurrió en el trabajo?". */
export function requierePreguntaTrabajo(idCie10: string | undefined | null): boolean {
  return /^[ST]/i.test(idCie10?.trim() ?? '');
}

// ------------------------------------------------------------------ RN-09
export interface SignosVitales {
  presionSistolica?: number | null;
  presionDiastolica?: number | null;
  frecuenciaCardiaca?: number | null;
  frecuenciaRespiratoria?: number | null;
  saturacionO2?: number | null;
  temperatura?: number | null;
}

export interface AlertaSignoVital {
  campo: keyof SignosVitales;
  mensaje: string;
}

const definido = (valor: number | null | undefined): valor is number =>
  typeof valor === 'number' && !Number.isNaN(valor);

const decimal = (valor: number) => valor.toFixed(1).replace('.', ',');

/**
 * Valores fuera de lo normal (pero posibles): solo generan una alerta, no impiden guardar.
 * TA ≥ 140/90 · FC < 50 o > 100 · FR < 12 o > 20 · SatO2 < 94 · T ≥ 38,0.
 */
export function alertasSignosVitales(signos: SignosVitales | undefined | null): AlertaSignoVital[] {
  if (!signos) return [];
  const alertas: AlertaSignoVital[] = [];
  const { presionSistolica: sis, presionDiastolica: dia } = signos;

  if ((definido(sis) && sis >= 140) || (definido(dia) && dia >= 90)) {
    alertas.push({
      campo: definido(sis) && sis >= 140 ? 'presionSistolica' : 'presionDiastolica',
      mensaje: `Presión arterial elevada (${sis ?? '—'}/${dia ?? '—'} mmHg)`,
    });
  }
  const fc = signos.frecuenciaCardiaca;
  if (definido(fc) && fc < 50) {
    alertas.push({ campo: 'frecuenciaCardiaca', mensaje: `Frecuencia cardiaca baja (${fc} lpm)` });
  } else if (definido(fc) && fc > 100) {
    alertas.push({ campo: 'frecuenciaCardiaca', mensaje: `Frecuencia cardiaca alta (${fc} lpm)` });
  }
  const fr = signos.frecuenciaRespiratoria;
  if (definido(fr) && fr < 12) {
    alertas.push({
      campo: 'frecuenciaRespiratoria',
      mensaje: `Frecuencia respiratoria baja (${fr} rpm)`,
    });
  } else if (definido(fr) && fr > 20) {
    alertas.push({
      campo: 'frecuenciaRespiratoria',
      mensaje: `Frecuencia respiratoria alta (${fr} rpm)`,
    });
  }
  const sat = signos.saturacionO2;
  if (definido(sat) && sat < 94) {
    alertas.push({ campo: 'saturacionO2', mensaje: `Saturación de oxígeno baja (${sat} %)` });
  }
  const t = signos.temperatura;
  if (definido(t) && t >= 38) {
    alertas.push({ campo: 'temperatura', mensaje: `Fiebre (${decimal(t)} °C)` });
  }
  return alertas;
}

// ------------------------------------------------------------------ RN-06
/** Minúsculas y sin tildes ni diéresis. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Nombres comunes con que se escriben las alergias → término del grupo farmacológico.
 * (Lo escrito en la historia clínica es texto libre.)
 */
const SINONIMOS: Record<string, string> = {
  sulfa: 'sulfonamida',
  aine: 'aine',
  antiinflamatorio: 'aine',
};

/** Palabra en singular simple: "penicilinas" → "penicilina", "sulfas" → "sulfa". */
function singular(palabra: string): string {
  return palabra.length > 4 && palabra.endsWith('s') ? palabra.slice(0, -1) : palabra;
}

function terminos(texto: string | null | undefined): Set<string> {
  const palabras = normalizarTexto(texto ?? '')
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3)
    .map(singular);
  return new Set(palabras.flatMap((p) => (SINONIMOS[p] ? [p, SINONIMOS[p]] : [p])));
}

export interface MedicamentoParaAlergia {
  idMedicamento: number;
  nombre: string;
  grupoFarmacologico?: string | null;
}

export interface CoincidenciaAlergia {
  idMedicamento: number;
  medicamento: string;
  /** Palabra de las alergias del paciente que coincidió. */
  alergia: string;
  /** Si coincidió con el nombre del medicamento o con su grupo farmacológico. */
  por: 'nombre' | 'grupo';
}

/**
 * Medicamentos que coinciden (sin distinguir tildes ni mayúsculas, por nombre o por grupo
 * farmacológico) con lo escrito en las alergias del paciente.
 */
export function coincidenciasAlergia(
  alergias: string | null | undefined,
  medicamentos: readonly MedicamentoParaAlergia[],
): CoincidenciaAlergia[] {
  const deAlergias = terminos(alergias);
  if (deAlergias.size === 0) return [];

  const coincidencias: CoincidenciaAlergia[] = [];
  for (const med of medicamentos) {
    const porNombre = [...terminos(med.nombre)].find((t) => deAlergias.has(t));
    const porGrupo = porNombre
      ? undefined
      : [...terminos(med.grupoFarmacologico)].find((t) => deAlergias.has(t));
    const termino = porNombre ?? porGrupo;
    if (termino) {
      coincidencias.push({
        idMedicamento: med.idMedicamento,
        medicamento: med.nombre,
        alergia: termino,
        por: porNombre ? 'nombre' : 'grupo',
      });
    }
  }
  return coincidencias;
}
