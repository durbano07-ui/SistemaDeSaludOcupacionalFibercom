import {
  type ConsolidadoAnual,
  type InformeTrimestral,
  type Morbilidad,
  NOMBRES_INDICADOR_SST,
  NOMBRES_MES,
  type RegistroMensual,
  type Totales,
} from '@smo/shared';
import ExcelJS from 'exceljs';

import { type Encabezado, fechaCorta, SUBTITULO, textoCumple } from './comun.js';

const NEGRO = 'FF1D1D1B';
const GRIS = 'FFF4F4F4';
const BORDE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF8D8D8D' } },
  left: { style: 'thin', color: { argb: 'FF8D8D8D' } },
  bottom: { style: 'thin', color: { argb: 'FF8D8D8D' } },
  right: { style: 'thin', color: { argb: 'FF8D8D8D' } },
};
const FORMATO_PORCENTAJE = '0.00%';

function nuevoLibro(): ExcelJS.Workbook {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Sistema de Medicina Ocupacional — FIBERCOM';
  libro.created = new Date();
  return libro;
}

/** Título, subtítulo, período y filtros (filas 1–3) a lo ancho de `columnas`. */
function cabecera(hoja: ExcelJS.Worksheet, e: Encabezado, columnas: number): void {
  const lineas: [string, Partial<ExcelJS.Font>][] = [
    [e.titulo, { bold: true, size: 14 }],
    [SUBTITULO, { bold: true, size: 11 }],
    [`Período: ${e.periodo} · ${e.filtros}`, { size: 10, color: { argb: 'FF525252' } }],
  ];
  lineas.forEach(([texto, fuente], i) => {
    const fila = hoja.getRow(i + 1);
    fila.getCell(1).value = texto;
    fila.getCell(1).font = fuente;
    hoja.mergeCells(i + 1, 1, i + 1, columnas);
  });
  hoja.addRow([]);
}

/** Fila de encabezados: negrita, texto blanco sobre #1D1D1B, bordes finos. */
function filaEncabezados(hoja: ExcelJS.Worksheet, titulos: string[]): ExcelJS.Row {
  const fila = hoja.addRow(titulos);
  fila.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEGRO } };
    celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    celda.border = BORDE;
  });
  fila.height = 30;
  return fila;
}

function filaDatos(hoja: ExcelJS.Worksheet, valores: ExcelJS.CellValue[], negrita = false) {
  const fila = hoja.addRow(valores);
  for (let i = 1; i <= valores.length; i++) {
    const celda = fila.getCell(i);
    celda.border = BORDE;
    celda.alignment = { vertical: 'top', wrapText: true };
    if (negrita) {
      celda.font = { bold: true };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    }
  }
  return fila;
}

function pie(hoja: ExcelJS.Worksheet, e: Encabezado): void {
  hoja.addRow([]);
  hoja.addRow([e.pie]).getCell(1).font = { italic: true, size: 9, color: { argb: 'FF525252' } };
}

function anchos(hoja: ExcelJS.Worksheet, valores: number[]): void {
  valores.forEach((ancho, i) => {
    hoja.getColumn(i + 1).width = ancho;
  });
}

async function aBuffer(libro: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await libro.xlsx.writeBuffer());
}

// --------------------------------------------------------------- registro

const TOTALES_REGISTRO: [string, keyof Totales][] = [
  ['TOTAL ATENCIONES', 'total'],
  ['ENFERMEDAD COMÚN', 'enfermedadComun'],
  ['INCIDENTES', 'incidentes'],
  ['ACCIDENTES', 'accidentes'],
  ['PRIMERA VEZ', 'primera'],
  ['SUBSECUENTE', 'subsecuente'],
];

/** Registro mensual: una hoja por mes (12 si se pidió el año completo). */
export async function excelRegistroMensual(datos: RegistroMensual, e: Encabezado): Promise<Buffer> {
  const libro = nuevoLibro();
  for (const { mes, totales, filas } of datos.meses) {
    const hoja = libro.addWorksheet(NOMBRES_MES[mes - 1]!, {
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    cabecera(hoja, { ...e, periodo: `${NOMBRES_MES[mes - 1]} ${datos.anio}` }, 10);

    // Totales del mes, arriba (como en el Excel del consultorio)
    for (const [etiqueta, campo] of TOTALES_REGISTRO) {
      const fila = hoja.addRow([etiqueta, totales[campo]]);
      fila.getCell(1).font = { bold: true };
      fila.getCell(1).border = BORDE;
      fila.getCell(2).border = BORDE;
      fila.getCell(2).font = { bold: true };
    }
    hoja.addRow([]);

    filaEncabezados(hoja, [
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
    ]);
    if (filas.length === 0) {
      filaDatos(hoja, ['Sin atenciones en el período', '', '', '', '', '', '', '', '', '']);
    }
    for (const f of filas) {
      const fila = filaDatos(hoja, [
        fechaCorta(f.fecha),
        f.paciente,
        f.tipoEvento,
        f.cedula,
        f.cargo,
        f.cie10,
        f.tipoAtencion,
        f.medicamentos,
        '', // se firma en papel
        f.observaciones,
      ]);
      fila.height = 30;
    }
    anchos(hoja, [13, 30, 20, 13, 24, 14, 14, 40, 18, 34]);
    pie(hoja, e);
  }
  return aBuffer(libro);
}

// ------------------------------------------------------------- consolidado

const COLUMNAS_TOTALES: [string, keyof Totales][] = [
  ['Total atenciones', 'total'],
  ['Enfermedad común', 'enfermedadComun'],
  ['Enfermedad profesional', 'enfermedadProfesional'],
  ['Incidentes', 'incidentes'],
  ['Accidentes', 'accidentes'],
  ['Primera vez', 'primera'],
  ['Subsecuente', 'subsecuente'],
];

export async function excelConsolidadoAnual(
  datos: ConsolidadoAnual,
  e: Encabezado,
): Promise<Buffer> {
  const libro = nuevoLibro();
  const hoja = libro.addWorksheet(`Consolidado ${datos.anio}`);
  cabecera(hoja, e, 8);
  filaEncabezados(hoja, ['Mes', ...COLUMNAS_TOTALES.map(([titulo]) => titulo)]);
  for (const m of datos.meses) {
    filaDatos(hoja, [NOMBRES_MES[m.mes - 1]!, ...COLUMNAS_TOTALES.map(([, campo]) => m[campo])]);
  }
  filaDatos(hoja, ['TOTAL', ...COLUMNAS_TOTALES.map(([, campo]) => datos.totales[campo])], true);
  anchos(hoja, [16, 16, 18, 22, 13, 13, 13, 13]);
  pie(hoja, e);
  return aBuffer(libro);
}

// -------------------------------------------------------------- trimestral

export async function excelInformeTrimestral(
  datos: InformeTrimestral,
  e: Encabezado,
): Promise<Buffer> {
  const libro = nuevoLibro();
  const hoja = libro.addWorksheet(`Informe SST ${datos.anio}`, {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  cabecera(hoja, e, 8);
  for (const t of datos.trimestres) {
    const [m1, m2, m3] = t.meses.map((m) => NOMBRES_MES[m - 1]!);
    const titulo = hoja.addRow([`TRIMESTRE ${t.trimestre} (${m1} – ${m3} ${datos.anio})`]);
    titulo.getCell(1).font = { bold: true, size: 12 };
    filaEncabezados(hoja, [
      'Indicador',
      m1!,
      m2!,
      m3!,
      'Total trimestre',
      '% del total',
      'Meta SST',
      'Cumple',
    ]);
    for (const fila of t.filas) {
      const total = fila.indicador === 'total_atenciones';
      const r = filaDatos(
        hoja,
        [
          NOMBRES_INDICADOR_SST[fila.indicador],
          ...fila.valores,
          fila.total,
          fila.porcentaje === null ? '—' : fila.porcentaje / 100,
          fila.meta ?? '—',
          textoCumple(fila.cumple),
        ],
        total,
      );
      if (fila.porcentaje !== null) r.getCell(6).numFmt = FORMATO_PORCENTAJE;
      if (fila.cumple) {
        r.getCell(8).font = {
          bold: true,
          color: { argb: fila.cumple === 'si' ? 'FF198038' : 'FFDA1E28' },
        };
      }
    }
    hoja.addRow([]);
  }
  anchos(hoja, [28, 12, 12, 12, 16, 13, 18, 10]);
  pie(hoja, e);
  return aBuffer(libro);
}

// --------------------------------------------------------------- morbilidad

export async function excelMorbilidad(datos: Morbilidad, e: Encabezado): Promise<Buffer> {
  const libro = nuevoLibro();
  const hoja = libro.addWorksheet('Morbilidad CIE-10');
  cabecera(hoja, e, 6);
  filaEncabezados(hoja, [
    'N°',
    'Código CIE-10',
    'Descripción',
    'Total casos',
    '% del total',
    'Tratamiento/medicamento más frecuente',
  ]);
  datos.filas.forEach((f, i) => {
    const fila = filaDatos(hoja, [
      i + 1,
      f.codigo,
      f.descripcion,
      f.casos,
      f.porcentaje === null ? '—' : f.porcentaje / 100,
      f.tratamiento,
    ]);
    if (f.porcentaje !== null) fila.getCell(5).numFmt = FORMATO_PORCENTAJE;
  });
  if (datos.filas.length === 0)
    filaDatos(hoja, ['', '', 'Sin atenciones en el período', '', '', '']);
  filaDatos(hoja, ['', '', 'TOTAL ATENCIONES PRIMERAS', datos.totalPrimeras, '', ''], true);
  anchos(hoja, [6, 14, 48, 12, 12, 44]);
  pie(hoja, e);
  return aBuffer(libro);
}
