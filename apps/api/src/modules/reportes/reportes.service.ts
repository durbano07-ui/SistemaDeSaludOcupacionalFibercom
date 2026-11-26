import { Injectable } from '@nestjs/common';
import {
  type ConsolidadoAnual,
  evaluarMeta,
  type FiltrosReporte,
  type Gestion,
  INDICADORES_SST,
  type IndicadorSst,
  type InformeTrimestral,
  mesesDelTrimestre,
  type Morbilidad,
  NOMBRES_MES,
  NOMBRES_TIPO_EVENTO,
  type OpcionesReporte,
  porcentajeDe,
  type RegistroMensual,
  textoMedicamentos,
  type Totales,
} from '@smo/shared';

import { fechaEcuador, rangoUtc } from '../../common/hora-ecuador.js';
import { type ConteoMes, type FiltroSql, ReportesRepositorio } from './reportes.repositorio.js';

const CERO: Totales = {
  total: 0,
  enfermedadComun: 0,
  enfermedadProfesional: 0,
  incidentes: 0,
  accidentes: 0,
  primera: 0,
  subsecuente: 0,
};

function sumar(lista: readonly Totales[]): Totales {
  return lista.reduce(
    (acc, t) => ({
      total: acc.total + t.total,
      enfermedadComun: acc.enfermedadComun + t.enfermedadComun,
      enfermedadProfesional: acc.enfermedadProfesional + t.enfermedadProfesional,
      incidentes: acc.incidentes + t.incidentes,
      accidentes: acc.accidentes + t.accidentes,
      primera: acc.primera + t.primera,
      subsecuente: acc.subsecuente + t.subsecuente,
    }),
    CERO,
  );
}

/** Los 12 meses, con ceros donde no hubo atenciones. */
function doceMeses(conteos: ConteoMes[]): (Totales & { mes: number })[] {
  return Array.from({ length: 12 }, (_, i) => {
    const encontrado = conteos.find((c) => c.mes === i + 1);
    const { mes: _mes, ...totales } = encontrado ?? { ...CERO, mes: i + 1 };
    return { mes: i + 1, ...totales };
  });
}

/** Valor de un indicador SST en los totales de un mes. */
function valorIndicador(t: Totales, indicador: IndicadorSst): number {
  switch (indicador) {
    case 'enfermedad_comun':
      return t.enfermedadComun;
    case 'enfermedad_profesional':
      return t.enfermedadProfesional;
    case 'accidente_trabajo':
      return t.accidentes;
    case 'incidente_trabajo':
      return t.incidentes;
    case 'total_atenciones':
      return t.total;
  }
}

function filtroSql(f: FiltrosReporte, mesDesde = 1, mesHasta = 12): FiltroSql {
  return { ...rangoUtc(f.anio, mesDesde, mesHasta), base: f.base, cargo: f.cargo };
}

/** Reportes del consultorio, calculados siempre desde el registro de atenciones. */
@Injectable()
export class ReportesService {
  constructor(private readonly repositorio: ReportesRepositorio) {}

  opciones(): Promise<OpcionesReporte> {
    return this.repositorio.opciones();
  }

  /** Registro mensual: un mes, o los 12 si no se indica el mes. */
  async registroMensual(f: FiltrosReporte & { mes?: number }): Promise<RegistroMensual> {
    const sql = f.mes ? filtroSql(f, f.mes, f.mes) : filtroSql(f);
    const [conteos, filas] = await Promise.all([
      this.repositorio.conteosPorMes(sql),
      this.repositorio.filasRegistro(sql),
    ]);
    const detalles = await this.repositorio.medicamentosDe(filas.map((fila) => fila.id));
    const medicamentos = new Map<number, Parameters<typeof textoMedicamentos>[0][number][]>();
    for (const d of detalles) {
      const id = d.recetaMedica.idAtencion;
      medicamentos.set(id, [
        ...(medicamentos.get(id) ?? []),
        { ...d.medicamento, dosis: d.dosis, frecuencia: d.frecuencia },
      ]);
    }

    const meses = f.mes ? [f.mes] : Array.from({ length: 12 }, (_, i) => i + 1);
    const porMes = doceMeses(conteos);
    const mesDe = (fecha: Date) => fechaEcuador(fecha).mes;

    return {
      anio: f.anio,
      meses: meses.map((mes) => {
        const { mes: _mes, ...totales } = porMes[mes - 1]!;
        return {
          mes,
          totales,
          filas: filas
            .filter((fila) => mesDe(fila.fecha) === mes)
            .map((fila) => ({
              id: fila.id,
              fecha: fila.fecha.toISOString(),
              paciente: `${fila.apellidos} ${fila.nombres}`,
              tipoEvento:
                NOMBRES_TIPO_EVENTO[fila.tipoEvento as keyof typeof NOMBRES_TIPO_EVENTO] ??
                fila.tipoEvento,
              cedula: fila.cedula,
              cargo: fila.cargo,
              cie10: fila.cie10,
              tipoAtencion: fila.tipoAtencion === 'primera' ? 'Primera vez' : 'Subsecuente',
              medicamentos: textoMedicamentos(medicamentos.get(fila.id) ?? []),
              observaciones: fila.observaciones?.trim() || '—',
            })),
        };
      }),
    };
  }

  async consolidadoAnual(f: FiltrosReporte): Promise<ConsolidadoAnual> {
    const meses = doceMeses(await this.repositorio.conteosPorMes(filtroSql(f)));
    return { anio: f.anio, meses, totales: sumar(meses) };
  }

  /** Informe trimestral SST: un trimestre o los 4. */
  async informeTrimestral(f: FiltrosReporte & { trimestre?: number }): Promise<InformeTrimestral> {
    const [conteos, metas] = await Promise.all([
      this.repositorio.conteosPorMes(filtroSql(f)),
      this.repositorio.metas(),
    ]);
    const porMes = doceMeses(conteos);
    const trimestres = f.trimestre ? [f.trimestre] : [1, 2, 3, 4];

    return {
      anio: f.anio,
      trimestres: trimestres.map((trimestre) => {
        const meses = mesesDelTrimestre(trimestre);
        const delMes: [Totales, Totales, Totales] = [
          porMes[meses[0] - 1]!,
          porMes[meses[1] - 1]!,
          porMes[meses[2] - 1]!,
        ];
        const totalTrimestre = delMes.reduce((s, t) => s + t.total, 0);
        return {
          trimestre,
          meses,
          filas: INDICADORES_SST.map((indicador) => {
            const valores = delMes.map((t) => valorIndicador(t, indicador)) as [
              number,
              number,
              number,
            ];
            const total = valores[0] + valores[1] + valores[2];
            const porcentaje = porcentajeDe(total, totalTrimestre);
            const meta = metas.find((m) => m.indicador === indicador);
            return {
              indicador,
              valores,
              total,
              porcentaje,
              meta: meta?.texto ?? null,
              cumple: meta
                ? evaluarMeta(
                    { tipo: meta.tipo, limite: meta.limite === null ? null : Number(meta.limite) },
                    { total, porcentaje },
                  )
                : null,
            };
          }),
        };
      }),
    };
  }

  /** Morbilidad CIE-10 (HU-40): solo atenciones primeras, ranking de mayor a menor. */
  async morbilidad(
    f: FiltrosReporte & { mes?: number; trimestre?: number; limite: number },
  ): Promise<Morbilidad> {
    const [mesDesde, mesHasta, periodo] = f.mes
      ? [f.mes, f.mes, `${NOMBRES_MES[f.mes - 1]} ${f.anio}`]
      : f.trimestre
        ? [
            mesesDelTrimestre(f.trimestre)[0],
            mesesDelTrimestre(f.trimestre)[2],
            `Trimestre ${f.trimestre} de ${f.anio}`,
          ]
        : [1, 12, `Año ${f.anio}`];
    const sql = filtroSql(f, mesDesde, mesHasta);
    const { totalPrimeras, filas } = await this.repositorio.morbilidad(sql, f.limite);
    const recetados = await this.repositorio.medicamentosPorCie10(
      sql,
      filas.map((fila) => fila.codigo),
    );

    return {
      anio: f.anio,
      periodo,
      totalPrimeras,
      filas: filas.map((fila) => {
        const dos = recetados.filter((r) => r.codigo === fila.codigo).slice(0, 2);
        return {
          ...fila,
          porcentaje: porcentajeDe(fila.casos, totalPrimeras),
          tratamiento: dos.length
            ? dos.map((r) => `${r.nombre} ${r.concentracion}`).join(', ')
            : 'Sin receta',
        };
      }),
    };
  }

  async gestion(f: FiltrosReporte): Promise<Gestion> {
    const sql = filtroSql(f);
    const [conteos, morbilidad, porBase, porCargo] = await Promise.all([
      this.repositorio.conteosPorMes(sql),
      this.repositorio.morbilidad(sql, 5),
      this.repositorio.conteoPor(sql, 'base'),
      this.repositorio.conteoPor(sql, 'cargo'),
    ]);
    const meses = doceMeses(conteos);
    const t = sumar(meses);
    return {
      anio: f.anio,
      total: t.total,
      porTipoEvento: [
        { nombre: 'Enfermedad común', total: t.enfermedadComun },
        { nombre: 'Enfermedad profesional', total: t.enfermedadProfesional },
        { nombre: 'Accidente de trabajo', total: t.accidentes },
        { nombre: 'Incidente de trabajo', total: t.incidentes },
      ],
      porTipoAtencion: [
        { nombre: 'Primera vez', total: t.primera },
        { nombre: 'Subsecuente', total: t.subsecuente },
      ],
      porMes: meses.map((m) => ({ mes: m.mes, nombre: NOMBRES_MES[m.mes - 1]!, total: m.total })),
      topCie10: morbilidad.filas,
      porBase,
      porCargo,
    };
  }
}
