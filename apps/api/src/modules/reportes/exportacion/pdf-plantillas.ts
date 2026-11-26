import {
  type ConsolidadoAnual,
  type InformeTrimestral,
  type Morbilidad,
  NOMBRES_INDICADOR_SST,
  NOMBRES_MES,
  type RegistroMensual,
  type Totales,
} from '@smo/shared';

import { PdfService } from '../../../common/pdf/pdf.service.js';
import { type Encabezado, fechaCorta, SUBTITULO, textoPorcentaje } from './comun.js';

/** Escapa texto para insertarlo en HTML (los datos vienen de la base, nunca se confía en ellos). */
const h = (valor: unknown) =>
  String(valor ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const ESTILOS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 2px; font: 10px/1.35 Arial, Helvetica, sans-serif; color: #1d1d1b; }
  header { display: flex; align-items: center; gap: 16px; padding-bottom: 8px; margin-bottom: 10px;
           border-bottom: 3px solid #f3a600; }
  header img { height: 42px; }
  header h1 { margin: 0; font-size: 15px; }
  header p { margin: 2px 0 0; color: #525252; }
  h2 { font-size: 12px; margin: 14px 0 6px; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { background: #1d1d1b; color: #fff; font-weight: bold; padding: 5px 4px; border: 1px solid #8d8d8d; }
  td { padding: 4px; border: 1px solid #8d8d8d; vertical-align: top; }
  td.n { text-align: right; white-space: nowrap; }
  tr.total td { font-weight: bold; background: #f4f4f4; }
  .tarjetas { display: flex; gap: 6px; margin-bottom: 10px; }
  .tarjeta { flex: 1; border: 1px solid #c6c6c6; padding: 6px; }
  .tarjeta b { display: block; font-size: 16px; }
  .si { color: #198038; font-weight: bold; }
  .no { color: #da1e28; font-weight: bold; }
  .salto { page-break-before: always; }
  .vacio { color: #525252; font-style: italic; }
`;

function documento(e: Encabezado, cuerpo: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${h(e.titulo)}</title>
<style>${ESTILOS}</style></head><body>
<header><img src="${PdfService.logo}" alt="FIBERCOM">
  <div><h1>${h(e.titulo)}</h1><p><b>${h(SUBTITULO)}</b></p>
  <p>Período: ${h(e.periodo)} · ${h(e.filtros)}</p></div></header>
${cuerpo}</body></html>`;
}

const tabla = (encabezados: string[], filas: string) =>
  `<table><thead><tr>${encabezados.map((t) => `<th>${h(t)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>`;

const celdaCumple = (cumple: 'si' | 'no' | null) =>
  cumple === 'si'
    ? '<td class="si">✔ Sí</td>'
    : cumple === 'no'
      ? '<td class="no">✖ No</td>'
      : '<td>—</td>';

// --------------------------------------------------------------- registro

const TARJETAS: [string, keyof Totales][] = [
  ['Total atenciones', 'total'],
  ['Enfermedad común', 'enfermedadComun'],
  ['Incidentes', 'incidentes'],
  ['Accidentes', 'accidentes'],
  ['Primera vez', 'primera'],
  ['Subsecuente', 'subsecuente'],
];

export function htmlRegistroMensual(datos: RegistroMensual, e: Encabezado): string {
  const cuerpo = datos.meses
    .map(({ mes, totales, filas }, i) => {
      const tarjetas = TARJETAS.map(
        ([t, campo]) => `<div class="tarjeta">${h(t)}<b>${totales[campo]}</b></div>`,
      ).join('');
      const filasHtml = filas.length
        ? filas
            .map(
              (
                f,
              ) => `<tr><td>${fechaCorta(f.fecha)}</td><td>${h(f.paciente)}</td><td>${h(f.tipoEvento)}</td>
<td>${h(f.cedula)}</td><td>${h(f.cargo)}</td><td>${h(f.cie10)}</td><td>${h(f.tipoAtencion)}</td>
<td>${h(f.medicamentos)}</td><td style="min-width:70px"></td><td>${h(f.observaciones)}</td></tr>`,
            )
            .join('')
        : '<tr><td colspan="10" class="vacio">Sin atenciones en el período</td></tr>';
      return `<section class="${i > 0 ? 'salto' : ''}"><h2>${h(NOMBRES_MES[mes - 1])} ${datos.anio}</h2>
<div class="tarjetas">${tarjetas}</div>
${tabla(
  [
    'Fecha de atención',
    'Nombre del paciente',
    'Tipo de evento',
    'Cédula',
    'Cargo/Puesto',
    'Código CIE-10',
    'Tipo de atención',
    'Medicamento usado/dosificación',
    'Firma/Conformidad',
    'Observaciones/indicaciones',
  ],
  filasHtml,
)}</section>`;
    })
    .join('');
  return documento(e, cuerpo);
}

// ------------------------------------------------------------- consolidado

const COLUMNAS: [string, keyof Totales][] = [
  ['Total atenciones', 'total'],
  ['Enfermedad común', 'enfermedadComun'],
  ['Enfermedad profesional', 'enfermedadProfesional'],
  ['Incidentes', 'incidentes'],
  ['Accidentes', 'accidentes'],
  ['Primera vez', 'primera'],
  ['Subsecuente', 'subsecuente'],
];

export function htmlConsolidadoAnual(datos: ConsolidadoAnual, e: Encabezado): string {
  const fila = (nombre: string, t: Totales, clase = '') =>
    `<tr class="${clase}"><td>${h(nombre)}</td>${COLUMNAS.map(([, c]) => `<td class="n">${t[c]}</td>`).join('')}</tr>`;
  const filas =
    datos.meses.map((m) => fila(NOMBRES_MES[m.mes - 1]!, m)).join('') +
    fila('TOTAL', datos.totales, 'total');
  return documento(e, tabla(['Mes', ...COLUMNAS.map(([t]) => t)], filas));
}

// -------------------------------------------------------------- trimestral

export function htmlInformeTrimestral(datos: InformeTrimestral, e: Encabezado): string {
  const cuerpo = datos.trimestres
    .map((t) => {
      const [m1, m2, m3] = t.meses.map((m) => NOMBRES_MES[m - 1]!);
      const filas = t.filas
        .map(
          (f) => `<tr class="${f.indicador === 'total_atenciones' ? 'total' : ''}">
<td>${h(NOMBRES_INDICADOR_SST[f.indicador])}</td>${f.valores.map((v) => `<td class="n">${v}</td>`).join('')}
<td class="n">${f.total}</td><td class="n">${textoPorcentaje(f.porcentaje)}</td>
<td>${h(f.meta ?? '—')}</td>${celdaCumple(f.cumple)}</tr>`,
        )
        .join('');
      return `<h2>Trimestre ${t.trimestre} (${h(m1)} – ${h(m3)} ${datos.anio})</h2>${tabla(
        ['Indicador', m1!, m2!, m3!, 'Total trimestre', '% del total', 'Meta SST', 'Cumple'],
        filas,
      )}`;
    })
    .join('');
  return documento(e, cuerpo);
}

// --------------------------------------------------------------- morbilidad

export function htmlMorbilidad(datos: Morbilidad, e: Encabezado): string {
  const filas = datos.filas.length
    ? datos.filas
        .map(
          (
            f,
            i,
          ) => `<tr><td class="n">${i + 1}</td><td>${h(f.codigo)}</td><td>${h(f.descripcion)}</td>
<td class="n">${f.casos}</td><td class="n">${textoPorcentaje(f.porcentaje)}</td><td>${h(f.tratamiento)}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="6" class="vacio">Sin atenciones en el período</td></tr>';
  const total = `<tr class="total"><td></td><td></td><td>TOTAL ATENCIONES PRIMERAS</td><td class="n">${datos.totalPrimeras}</td><td></td><td></td></tr>`;
  return documento(
    e,
    tabla(
      [
        'N°',
        'Código CIE-10',
        'Descripción',
        'Total casos',
        '% del total',
        'Tratamiento/medicamento más frecuente',
      ],
      filas + total,
    ),
  );
}
