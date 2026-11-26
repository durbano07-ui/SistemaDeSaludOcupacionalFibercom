import { Injectable } from '@nestjs/common';

import { HORAS_DETRAS_DE_UTC } from '../../common/hora-ecuador.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Período (instantes UTC) y filtros opcionales por base y cargo del paciente. */
export interface FiltroSql {
  desde: Date;
  hasta: Date;
  base?: number;
  cargo?: number;
}

/** Fecha de la atención en hora de Ecuador (desplazamiento fijo; ver hora-ecuador.ts). */
const FECHA_ECUADOR = Prisma.raw(`DATE_SUB(a.fecha, INTERVAL ${HORAS_DETRAS_DE_UTC} HOUR)`);

/** WHERE común. El período usa el índice de atencion.fecha; base y cargo, la PK de usuario. */
function donde(f: FiltroSql): Prisma.Sql {
  return Prisma.sql`a.fecha >= ${f.desde} AND a.fecha < ${f.hasta}
    ${f.base ? Prisma.sql`AND u.id_base = ${f.base}` : Prisma.empty}
    ${f.cargo ? Prisma.sql`AND u.id_cargo = ${f.cargo}` : Prisma.empty}`;
}

const n = (valor: unknown) => Number(valor ?? 0);

export interface ConteoMes {
  mes: number;
  total: number;
  enfermedadComun: number;
  enfermedadProfesional: number;
  incidentes: number;
  accidentes: number;
  primera: number;
  subsecuente: number;
}

export interface FilaRegistroSql {
  id: number;
  fecha: Date;
  apellidos: string;
  nombres: string;
  cedula: string;
  cargo: string;
  tipoEvento: string;
  tipoAtencion: string;
  cie10: string;
  observaciones: string | null;
}

/**
 * Consultas agregadas de los reportes. Todo se cuenta en SQL (GROUP BY); ninguna consulta trae
 * todas las atenciones para contarlas en memoria. Los parámetros siempre van parametrizados.
 */
@Injectable()
export class ReportesRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  /** Conteos por mes de Ecuador (solo los meses con atenciones). */
  async conteosPorMes(f: FiltroSql): Promise<ConteoMes[]> {
    const filas = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT MONTH(${FECHA_ECUADOR}) AS mes,
             COUNT(*) AS total,
             SUM(a.tipo_evento = 'enfermedad_comun') AS enfermedad_comun,
             SUM(a.tipo_evento = 'enfermedad_profesional') AS enfermedad_profesional,
             SUM(a.tipo_evento = 'incidente_trabajo') AS incidentes,
             SUM(a.tipo_evento = 'accidente_trabajo') AS accidentes,
             SUM(a.tipo_atencion = 'primera') AS primera,
             SUM(a.tipo_atencion = 'subsecuente') AS subsecuente
      FROM atencion a
      JOIN usuario u ON u.id_usuario = a.id_usuario
      WHERE ${donde(f)}
      GROUP BY mes
      ORDER BY mes`;
    return filas.map((r) => ({
      mes: n(r.mes),
      total: n(r.total),
      enfermedadComun: n(r.enfermedad_comun),
      enfermedadProfesional: n(r.enfermedad_profesional),
      incidentes: n(r.incidentes),
      accidentes: n(r.accidentes),
      primera: n(r.primera),
      subsecuente: n(r.subsecuente),
    }));
  }

  /** Filas del registro (una por atención), en orden cronológico. */
  async filasRegistro(f: FiltroSql): Promise<FilaRegistroSql[]> {
    const filas = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT a.id_atencion, a.fecha, u.apellidos, u.nombres, u.cedula, c.nombre AS cargo,
             a.tipo_evento, a.tipo_atencion, a.observaciones,
             CONCAT_WS(', ', a.id_cie10,
               (SELECT GROUP_CONCAT(d.id_cie10 ORDER BY d.orden SEPARATOR ', ')
                FROM atencion_diagnostico d WHERE d.id_atencion = a.id_atencion)) AS cie10
      FROM atencion a
      JOIN usuario u ON u.id_usuario = a.id_usuario
      JOIN cargo c ON c.id_cargo = u.id_cargo
      WHERE ${donde(f)}
      ORDER BY a.fecha, a.id_atencion`;
    return filas.map((r) => ({
      id: n(r.id_atencion),
      fecha: r.fecha as Date,
      apellidos: String(r.apellidos),
      nombres: String(r.nombres),
      cedula: String(r.cedula),
      cargo: String(r.cargo),
      tipoEvento: String(r.tipo_evento),
      tipoAtencion: String(r.tipo_atencion),
      cie10: String(r.cie10),
      observaciones: r.observaciones === null ? null : String(r.observaciones),
    }));
  }

  /** Medicamentos recetados en un conjunto de atenciones, en el orden de la receta. */
  async medicamentosDe(idsAtencion: number[]) {
    if (idsAtencion.length === 0) return [];
    return this.prisma.recetaDetalle.findMany({
      where: { recetaMedica: { idAtencion: { in: idsAtencion } } },
      orderBy: { idDetalle: 'asc' },
      select: {
        dosis: true,
        frecuencia: true,
        recetaMedica: { select: { idAtencion: true } },
        medicamento: { select: { nombre: true, concentracion: true } },
      },
    });
  }

  /** Morbilidad: casos por CIE-10 principal contando SOLO atenciones primeras (un caso = una vez). */
  async morbilidad(f: FiltroSql, limite: number) {
    const [total] = await this.prisma.$queryRaw<{ total: unknown }[]>`
      SELECT COUNT(*) AS total FROM atencion a JOIN usuario u ON u.id_usuario = a.id_usuario
      WHERE ${donde(f)} AND a.tipo_atencion = 'primera'`;
    const filas = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT a.id_cie10 AS codigo, c.descripcion, COUNT(*) AS casos
      FROM atencion a
      JOIN usuario u ON u.id_usuario = a.id_usuario
      JOIN cie10 c ON c.id_cie10 = a.id_cie10
      WHERE ${donde(f)} AND a.tipo_atencion = 'primera'
      GROUP BY a.id_cie10, c.descripcion
      ORDER BY casos DESC, a.id_cie10 ASC
      LIMIT ${limite}`;
    return {
      totalPrimeras: n(total?.total),
      filas: filas.map((r) => ({
        codigo: String(r.codigo),
        descripcion: String(r.descripcion),
        casos: n(r.casos),
      })),
    };
  }

  /**
   * Veces que se recetó cada medicamento en las atenciones (primeras y subsecuentes) de cada
   * CIE-10 principal del período, de más a menos recetado.
   */
  async medicamentosPorCie10(f: FiltroSql, codigos: string[]) {
    if (codigos.length === 0) return [];
    const filas = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT a.id_cie10 AS codigo, m.nombre, m.concentracion, COUNT(*) AS veces
      FROM atencion a
      JOIN usuario u ON u.id_usuario = a.id_usuario
      JOIN receta_medica r ON r.id_atencion = a.id_atencion
      JOIN receta_detalle d ON d.id_receta = r.id_receta
      JOIN medicamento m ON m.id_medicamento = d.id_medicamento
      WHERE ${donde(f)} AND a.id_cie10 IN (${Prisma.join(codigos)})
      GROUP BY a.id_cie10, m.id_medicamento, m.nombre, m.concentracion
      ORDER BY a.id_cie10, veces DESC, m.nombre, m.concentracion`;
    return filas.map((r) => ({
      codigo: String(r.codigo),
      nombre: String(r.nombre),
      concentracion: String(r.concentracion),
      veces: n(r.veces),
    }));
  }

  /** Atenciones por base o por cargo del paciente. */
  async conteoPor(f: FiltroSql, campo: 'base' | 'cargo') {
    const filas =
      campo === 'base'
        ? await this.prisma.$queryRaw<Record<string, unknown>[]>`
            SELECT b.nombre, COUNT(*) AS total FROM atencion a
            JOIN usuario u ON u.id_usuario = a.id_usuario JOIN base b ON b.id_base = u.id_base
            WHERE ${donde(f)} GROUP BY b.id_base, b.nombre ORDER BY total DESC, b.nombre`
        : await this.prisma.$queryRaw<Record<string, unknown>[]>`
            SELECT c.nombre, COUNT(*) AS total FROM atencion a
            JOIN usuario u ON u.id_usuario = a.id_usuario JOIN cargo c ON c.id_cargo = u.id_cargo
            WHERE ${donde(f)} GROUP BY c.id_cargo, c.nombre ORDER BY total DESC, c.nombre`;
    return filas.map((r) => ({ nombre: String(r.nombre), total: n(r.total) }));
  }

  async metas() {
    return this.prisma.metaSst.findMany({ orderBy: { idMeta: 'asc' } });
  }

  async opciones() {
    const [bases, cargos] = await Promise.all([
      this.prisma.base.findMany({
        orderBy: { nombre: 'asc' },
        select: { idBase: true, nombre: true },
      }),
      this.prisma.cargo.findMany({
        where: { estado: 'activo' },
        orderBy: { nombre: 'asc' },
        select: { idCargo: true, nombre: true },
      }),
    ]);
    return {
      bases: bases.map((b) => ({ id: b.idBase, nombre: b.nombre })),
      cargos: cargos.map((c) => ({ id: c.idCargo, nombre: c.nombre })),
    };
  }
}
