import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type AtencionDetalle,
  type AtencionesDelMes,
  type AtencionListada,
  calcularEdad,
  fechaLocal,
  type HistorialAtenciones,
} from '@smo/shared';

import { deFechaSql, rangoDelMes } from '../../common/fechas.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const SELECCION_LISTADO = {
  idAtencion: true,
  codigo: true,
  fecha: true,
  tipoAtencion: true,
  usuario: {
    select: {
      idUsuario: true,
      apellidos: true,
      nombres: true,
      cedula: true,
      cargo: { select: { nombre: true } },
    },
  },
  cie10: { select: { idCie10: true, descripcion: true } },
  evolucionMedica: { select: { motivoConsulta: true } },
  recetaMedica: { select: { idReceta: true } },
  certificado: { select: { idCertificado: true } },
} satisfies Prisma.AtencionSelect;

type FilaListado = Prisma.AtencionGetPayload<{ select: typeof SELECCION_LISTADO }>;

function aListada(fila: FilaListado): AtencionListada {
  return {
    id: fila.idAtencion,
    codigo: fila.codigo,
    fecha: fila.fecha.toISOString(),
    tipoAtencion: fila.tipoAtencion,
    paciente: {
      id: fila.usuario.idUsuario,
      apellidos: fila.usuario.apellidos,
      nombres: fila.usuario.nombres,
      cedula: fila.usuario.cedula,
    },
    cargo: fila.usuario.cargo.nombre,
    motivo: fila.evolucionMedica?.motivoConsulta ?? '',
    diagnostico: { codigo: fila.cie10.idCie10, descripcion: fila.cie10.descripcion },
    tieneReceta: fila.recetaMedica !== null,
    tieneCertificado: fila.certificado !== null,
  };
}

const numero = (valor: { toString(): string } | null) =>
  valor === null ? null : Number(valor.toString());

/** Lecturas de atenciones: listado del mes, historial paginado y detalle. */
@Injectable()
export class ConsultasAtencionesService {
  constructor(private readonly prisma: PrismaService) {}

  async delMes(idPaciente: number, mes: string): Promise<AtencionesDelMes> {
    const { desde, hasta } = rangoDelMes(mes);
    const filas = await this.prisma.atencion.findMany({
      where: { idUsuario: idPaciente, fecha: { gte: desde, lt: hasta } },
      orderBy: [{ fecha: 'desc' }, { idAtencion: 'desc' }],
      select: SELECCION_LISTADO,
    });
    return { mes, atenciones: filas.map(aListada) };
  }

  async historial(
    idPaciente: number,
    pagina: number,
    tamano: number,
  ): Promise<HistorialAtenciones> {
    const where = { idUsuario: idPaciente };
    const [total, filas] = await Promise.all([
      this.prisma.atencion.count({ where }),
      this.prisma.atencion.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { idAtencion: 'desc' }],
        skip: (pagina - 1) * tamano,
        take: tamano,
        select: SELECCION_LISTADO,
      }),
    ]);
    return { pagina, tamano, total, atenciones: filas.map(aListada) };
  }

  async detalle(idAtencion: number): Promise<AtencionDetalle> {
    const a = await this.prisma.atencion.findUnique({
      where: { idAtencion },
      include: {
        cie10: true,
        usuario: {
          include: { cargo: { include: { departamento: true } }, base: true },
        },
        usuarioRegistra: { select: { nombres: true, apellidos: true, codigoMedico: true } },
        evolucionMedica: true,
        recetaMedica: {
          include: {
            detalles: {
              orderBy: { idDetalle: 'asc' },
              include: { medicamento: { include: { presentacion: true } } },
            },
          },
        },
        certificado: true,
      },
    });
    if (!a) throw new NotFoundException('La atención no existe');

    const p = a.usuario;
    const e = a.evolucionMedica;
    return {
      id: a.idAtencion,
      codigo: a.codigo,
      fecha: a.fecha.toISOString(),
      tipoAtencion: a.tipoAtencion,
      tipoEvento: a.tipoEvento,
      ocurrioEnTrabajo: a.ocurrioEnTrabajo,
      observaciones: a.observaciones,
      proximaCita: a.proximaCita ? deFechaSql(a.proximaCita) : null,
      diagnostico: { codigo: a.cie10.idCie10, descripcion: a.cie10.descripcion },
      paciente: {
        id: p.idUsuario,
        apellidos: p.apellidos,
        nombres: p.nombres,
        cedula: p.cedula,
        // Edad a la fecha de la atención (es la que va en la receta o el certificado)
        edad: calcularEdad(deFechaSql(p.fechaNacimiento), fechaLocal(a.fecha)),
        sexo: p.sexo,
        cargo: p.cargo.nombre,
        departamento: p.cargo.departamento.nombre,
        base: p.base.nombre,
      },
      medico: a.usuarioRegistra,
      evolucion: {
        codigo: e?.codigo ?? '',
        motivo: e?.motivoConsulta ?? '',
        enfermedadActual: e?.enfermedadActual ?? '',
        presionSistolica: e?.presionSistolica ?? null,
        presionDiastolica: e?.presionDiastolica ?? null,
        frecuenciaCardiaca: e?.frecuenciaCardiaca ?? null,
        frecuenciaRespiratoria: e?.frecuenciaRespiratoria ?? null,
        saturacionO2: e?.saturacionO2 ?? null,
        temperatura: numero(e?.temperatura ?? null),
        examenFisico: e?.examenFisico ?? null,
        tratamiento: e?.tratamiento ?? null,
      },
      receta: a.recetaMedica
        ? {
            advertencias: a.recetaMedica.advertencias,
            recomendaciones: a.recetaMedica.recomendaciones,
            signosAlarma: a.recetaMedica.signosAlarma,
            medicamentos: a.recetaMedica.detalles.map((d) => ({
              nombre: d.medicamento.nombre,
              presentacion: d.medicamento.presentacion.nombre,
              concentracion: d.medicamento.concentracion,
              cantidad: d.cantidad,
              dosis: d.dosis,
              frecuencia: d.frecuencia,
              duracion: d.duracion,
              indicaciones: d.indicaciones,
            })),
          }
        : null,
      certificado: a.certificado
        ? {
            codigo: a.certificado.codigo,
            dias: a.certificado.dias,
            fechaInicio: deFechaSql(a.certificado.fechaInicio),
            fechaFin: deFechaSql(a.certificado.fechaFin),
            observacion: a.certificado.observacion,
          }
        : null,
    };
  }

  /** Paciente al que pertenece una atención (para la auditoría). */
  async idPacienteDe(idAtencion: number): Promise<number | null> {
    const fila = await this.prisma.atencion.findUnique({
      where: { idAtencion },
      select: { idUsuario: true },
    });
    return fila?.idUsuario ?? null;
  }
}
