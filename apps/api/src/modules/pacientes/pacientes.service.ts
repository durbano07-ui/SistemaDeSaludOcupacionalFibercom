import { Injectable, NotFoundException } from '@nestjs/common';
import {
  calcularEdad,
  type CondicionPrioritaria,
  fechaLocal,
  type PacienteEncontrado,
  type ResumenPaciente,
} from '@smo/shared';

import { deFechaSql } from '../../common/fechas.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Los pacientes son los usuarios SIN nombre de usuario (los trabajadores sin acceso al sistema). */
const ES_PACIENTE = { nombreUsuario: null };

@Injectable()
export class PacientesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca pacientes activos por cédula, nombres o apellidos. Cada palabra debe aparecer en alguno
   * de los campos; la colación de la base (utf8mb4_uca1400_ai_ci) ignora tildes y mayúsculas.
   */
  async buscar(texto: string): Promise<PacienteEncontrado[]> {
    const palabras = texto.split(/\s+/).filter(Boolean).slice(0, 6);
    const filas = await this.prisma.usuario.findMany({
      where: {
        ...ES_PACIENTE,
        estado: 'activo',
        AND: palabras.map((palabra) => ({
          OR: [
            { cedula: { startsWith: palabra } },
            { nombres: { contains: palabra } },
            { apellidos: { contains: palabra } },
          ],
        })),
      },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      take: 20,
      select: {
        idUsuario: true,
        apellidos: true,
        nombres: true,
        cedula: true,
        base: { select: { nombre: true } },
      },
    });
    return filas.map((f) => ({
      id: f.idUsuario,
      apellidos: f.apellidos,
      nombres: f.nombres,
      cedula: f.cedula,
      base: f.base.nombre,
    }));
  }

  async resumen(idPaciente: number): Promise<ResumenPaciente> {
    const activas = { fechaSalida: null };
    const p = await this.prisma.usuario.findFirst({
      where: { idUsuario: idPaciente, ...ES_PACIENTE },
      include: {
        base: true,
        cargo: { include: { departamento: true } },
        historiaClinica: { select: { alergias: true } },
        gruposVulnerables: { where: activas, include: { grupoVulnerable: true } },
        discapacidades: { where: activas, include: { discapacidad: true } },
        enfermedadesCatastroficas: { where: activas, include: { enfermedadCatastrofica: true } },
        casos: { where: { estado: 'abierto' }, include: { cie10: true }, take: 1 },
      },
    });
    if (!p) throw new NotFoundException('El paciente no existe');

    const condiciones: CondicionPrioritaria[] = [
      ...p.gruposVulnerables.map((g) => ({
        tipo: 'grupo_vulnerable' as const,
        nombre: g.grupoVulnerable.nombre,
        detalle: null,
      })),
      ...p.discapacidades.map((d) => ({
        tipo: 'discapacidad' as const,
        nombre: `Discapacidad ${d.discapacidad.nombre.toLowerCase()}`,
        detalle: `${d.porcentaje} %`,
      })),
      ...p.enfermedadesCatastroficas.map((e) => ({
        tipo: 'enfermedad_catastrofica' as const,
        nombre: e.enfermedadCatastrofica.nombre,
        detalle: null,
      })),
    ];
    const caso = p.casos[0];

    return {
      id: p.idUsuario,
      apellidos: p.apellidos,
      nombres: p.nombres,
      cedula: p.cedula,
      edad: calcularEdad(deFechaSql(p.fechaNacimiento), fechaLocal(new Date())),
      sexo: p.sexo,
      cargo: p.cargo.nombre,
      departamento: p.cargo.departamento.nombre,
      base: p.base.nombre,
      alergias: p.historiaClinica?.alergias?.trim() || null,
      condiciones,
      casoAbierto: caso
        ? {
            id: caso.idCaso,
            cie10: { codigo: caso.cie10.idCie10, descripcion: caso.cie10.descripcion },
            fechaApertura: deFechaSql(caso.fechaApertura),
          }
        : null,
    };
  }

  /** Lanza 404 si el id no es de un paciente. */
  async asegurarExiste(idPaciente: number): Promise<void> {
    const existe = await this.prisma.usuario.count({
      where: { idUsuario: idPaciente, ...ES_PACIENTE },
    });
    if (!existe) throw new NotFoundException('El paciente no existe');
  }
}
