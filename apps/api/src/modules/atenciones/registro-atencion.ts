import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AdvertenciasAtencion,
  alertasSignosVitales,
  calcularFechaFin,
  type CoincidenciaAlergia,
  coincidenciasAlergia,
  fechaLocal,
  type NuevaAtencion,
  type TipoAtencion,
} from '@smo/shared';

import { aFechaSql, deFechaSql } from '../../common/fechas.js';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { siguienteCodigo } from './codigos.js';

/** Reintentos ante un choque de índice único o un deadlock entre transacciones simultáneas. */
export const MAX_REINTENTOS = 3;

export interface AtencionGuardada {
  id: number;
  codigo: string;
  codigoEvolucion: string;
  codigoCertificado: string | null;
  idCaso: number;
  /** Caso que se cerró por ser atención primera (RN-01). */
  idCasoCerrado: number | null;
  tipoAtencion: TipoAtencion;
  advertencias: AdvertenciasAtencion;
}

/** Choques que se resuelven repitiendo la transacción completa. */
export function esChoqueReintentable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002' || error.code === 'P2034';
  }
  const texto = error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : '';
  return /deadlock|1213|lock wait timeout|1205/i.test(texto);
}

function textoAdvertenciaAlergia(alergias: string, coincidencias: CoincidenciaAlergia[]): string {
  const medicamentos = coincidencias.map((c) => c.medicamento).join(', ');
  return `Alergias registradas: ${alergias.trim()}. Recetado de todos modos: ${medicamentos}.`.slice(
    0,
    1000,
  );
}

/**
 * Registra una atención completa (caso, atención, evolución, receta con su detalle y certificado)
 * en UNA transacción: se guarda todo o nada. Aplica RN-01/02 (casos), RN-04 a RN-08 y RN-13.
 * `datos` ya viene validado por `nuevaAtencionSchema`.
 */
export async function registrarAtencion(
  prisma: PrismaClient,
  datos: NuevaAtencion,
  idMedico: number,
): Promise<AtencionGuardada> {
  const fecha = new Date(datos.fecha);
  const dia = fechaLocal(fecha);
  const anio = Number(dia.slice(0, 4));

  // -------- comprobaciones previas (sin bloquear nada)
  const paciente = await prisma.usuario.findUnique({
    where: { idUsuario: datos.idPaciente },
    select: {
      nombreUsuario: true,
      estado: true,
      historiaClinica: { select: { alergias: true } },
    },
  });
  if (!paciente || paciente.nombreUsuario !== null) {
    throw new NotFoundException('El paciente no existe');
  }
  if (paciente.estado !== 'activo') throw new ConflictException('El paciente está inactivo');

  const cie10 = await prisma.cie10.findUnique({
    where: { idCie10: datos.idCie10 },
    select: { estado: true },
  });
  if (!cie10 || cie10.estado !== 'activo') {
    throw new BadRequestException('El diagnóstico CIE-10 no existe o está inactivo');
  }

  const adicionales = datos.diagnosticosAdicionales;
  if (adicionales.length > 0) {
    const encontrados = await prisma.cie10.count({
      where: { idCie10: { in: adicionales }, estado: 'activo' },
    });
    if (encontrados !== new Set(adicionales).size) {
      throw new BadRequestException('Algún diagnóstico adicional no existe o está inactivo');
    }
  }

  // La base exige proxima_cita > CAST(fecha AS DATE) con `fecha` en UTC: después de las 19:00
  // de Ecuador el día UTC ya es el siguiente.
  if (datos.proximaCita && datos.proximaCita <= deFechaSql(fecha)) {
    throw new BadRequestException(
      'Para una atención registrada después de las 19:00, la próxima cita debe ser al menos dos días después.',
    );
  }

  const idsMedicamentos = datos.receta?.medicamentos.map((m) => m.idMedicamento) ?? [];
  const medicamentos = idsMedicamentos.length
    ? await prisma.medicamento.findMany({
        where: { idMedicamento: { in: idsMedicamentos }, estado: 'activo' },
        select: { idMedicamento: true, nombre: true, grupoFarmacologico: true },
      })
    : [];
  if (medicamentos.length !== new Set(idsMedicamentos).size) {
    throw new BadRequestException('Algún medicamento de la receta no existe o está inactivo');
  }

  // RN-06: alerta de alergia. No bloquea, pero el médico debe confirmar.
  const alergias = paciente.historiaClinica?.alergias?.trim() || null;
  const coincidencias = coincidenciasAlergia(alergias, medicamentos);
  if (coincidencias.length > 0 && !datos.receta?.recetarDeTodosModos) {
    throw new UnprocessableEntityException({
      message: `El paciente tiene alergias registradas (${alergias}) que coinciden con: ${coincidencias
        .map((c) => c.medicamento)
        .join(', ')}. Marca "Recetar de todos modos" para continuar.`,
      alergias: coincidencias,
    });
  }

  const advertencias: AdvertenciasAtencion = {
    alergias: coincidencias,
    signosVitales: alertasSignosVitales(datos.signosVitales),
  };

  // -------- transacción (se repite completa ante un choque de códigos o de caso abierto)
  for (let intento = 0; ; intento++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Caso abierto del paciente, bloqueado hasta el COMMIT
          const [fila] = await tx.$queryRaw<
            { id_caso: bigint | number; fecha_apertura: Date }[]
          >`SELECT id_caso, fecha_apertura FROM caso
            WHERE id_usuario = ${datos.idPaciente} AND estado = 'abierto' FOR UPDATE`;
          // Las consultas crudas devuelven los enteros como BigInt
          const abierto = fila
            ? { id_caso: Number(fila.id_caso), fecha_apertura: fila.fecha_apertura }
            : undefined;

          if (abierto && dia < deFechaSql(abierto.fecha_apertura)) {
            throw new ConflictException(
              `La fecha de la atención es anterior a la apertura del caso abierto (${deFechaSql(abierto.fecha_apertura)}).`,
            );
          }

          let idCaso: number;
          let idCasoCerrado: number | null = null;
          if (datos.tipoAtencion === 'primera') {
            // RN-01: cierra el caso abierto y abre uno nuevo con el CIE-10 de la atención
            if (abierto) {
              await tx.caso.update({
                where: { idCaso: abierto.id_caso },
                data: { estado: 'cerrado', fechaCierre: aFechaSql(dia) },
              });
              idCasoCerrado = abierto.id_caso;
            }
            const caso = await tx.caso.create({
              data: {
                idUsuario: datos.idPaciente,
                idCie10: datos.idCie10,
                fechaApertura: aFechaSql(dia),
              },
              select: { idCaso: true },
            });
            idCaso = caso.idCaso;
          } else {
            // RN-02: la subsecuente se suma al caso abierto
            if (!abierto) throw new ConflictException('El paciente no tiene un caso abierto');
            idCaso = abierto.id_caso;
          }

          const codigo = await siguienteCodigo(tx, 'atencion', anio);
          const atencion = await tx.atencion.create({
            data: {
              codigo,
              idUsuario: datos.idPaciente,
              idUsuarioRegistra: idMedico,
              idCaso,
              idCie10: datos.idCie10,
              fecha,
              tipoAtencion: datos.tipoAtencion,
              tipoEvento: datos.tipoEvento,
              ocurrioEnTrabajo: datos.ocurrioEnTrabajo,
              observaciones: datos.observaciones ?? null,
              proximaCita: datos.proximaCita ? aFechaSql(datos.proximaCita) : null,
            },
            select: { idAtencion: true },
          });
          if (adicionales.length > 0) {
            await tx.atencionDiagnostico.createMany({
              data: adicionales.map((idCie10, indice) => ({
                idAtencion: atencion.idAtencion,
                idCie10,
                orden: indice + 1,
              })),
            });
          }

          const codigoEvolucion = await siguienteCodigo(tx, 'evolucion', anio);
          const signos = datos.signosVitales;
          await tx.evolucionMedica.create({
            data: {
              idAtencion: atencion.idAtencion,
              idUsuarioRegistra: idMedico,
              codigo: codigoEvolucion,
              motivoConsulta: datos.motivo,
              enfermedadActual: datos.enfermedadActual,
              presionSistolica: signos?.presionSistolica ?? null,
              presionDiastolica: signos?.presionDiastolica ?? null,
              frecuenciaCardiaca: signos?.frecuenciaCardiaca ?? null,
              frecuenciaRespiratoria: signos?.frecuenciaRespiratoria ?? null,
              saturacionO2: signos?.saturacionO2 ?? null,
              temperatura: signos?.temperatura ?? null,
              examenFisico: datos.examenFisico ?? null,
              tratamiento: datos.tratamiento ?? null,
            },
          });

          if (datos.receta) {
            const receta = await tx.recetaMedica.create({
              data: {
                idAtencion: atencion.idAtencion,
                recomendaciones: datos.receta.recomendaciones ?? null,
                signosAlarma: datos.receta.signosAlarma ?? null,
                advertencias:
                  coincidencias.length && alergias
                    ? textoAdvertenciaAlergia(alergias, coincidencias)
                    : null,
              },
              select: { idReceta: true },
            });
            if (datos.receta.medicamentos.length) {
              await tx.recetaDetalle.createMany({
                data: datos.receta.medicamentos.map((m) => ({
                  idReceta: receta.idReceta,
                  idMedicamento: m.idMedicamento,
                  cantidad: m.cantidad,
                  dosis: m.dosis,
                  frecuencia: m.frecuencia,
                  duracion: m.duracion,
                  indicaciones: m.indicaciones ?? null,
                })),
              });
            }
          }

          let codigoCertificado: string | null = null;
          if (datos.certificado) {
            codigoCertificado = await siguienteCodigo(tx, 'certificado', anio);
            await tx.certificadoReposo.create({
              data: {
                idAtencion: atencion.idAtencion,
                codigo: codigoCertificado,
                dias: datos.certificado.dias,
                fechaInicio: aFechaSql(datos.certificado.fechaInicio),
                // RN-08: la calcula la API; la base lo verifica (ck_certificado_fin)
                fechaFin: aFechaSql(
                  calcularFechaFin(datos.certificado.fechaInicio, datos.certificado.dias),
                ),
              },
            });
          }

          return {
            id: atencion.idAtencion,
            codigo,
            codigoEvolucion,
            codigoCertificado,
            idCaso,
            idCasoCerrado,
            tipoAtencion: datos.tipoAtencion,
            advertencias,
          };
        },
        { timeout: 15_000, maxWait: 10_000 },
      );
    } catch (error) {
      if (intento < MAX_REINTENTOS && esChoqueReintentable(error)) continue;
      throw error;
    }
  }
}
