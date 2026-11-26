import { Injectable } from '@nestjs/common';
import type { Cie10, Medicamento } from '@smo/shared';

import { PrismaService } from '../../prisma/prisma.service.js';

const palabras = (texto: string) => texto.split(/\s+/).filter(Boolean).slice(0, 6);

@Injectable()
export class CatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  /** CIE-10 activos cuyo código empieza con el texto o cuya descripción contiene cada palabra. */
  async buscarCie10(texto: string): Promise<Cie10[]> {
    const filas = await this.prisma.cie10.findMany({
      where: {
        estado: 'activo',
        OR: [
          { idCie10: { startsWith: texto.toUpperCase() } },
          { AND: palabras(texto).map((p) => ({ descripcion: { contains: p } })) },
        ],
      },
      orderBy: { idCie10: 'asc' },
      take: 20,
    });
    return filas.map((f) => ({ codigo: f.idCie10, descripcion: f.descripcion }));
  }

  /** Medicamentos activos por nombre o grupo farmacológico. */
  async buscarMedicamentos(texto: string): Promise<Medicamento[]> {
    const filas = await this.prisma.medicamento.findMany({
      where: {
        estado: 'activo',
        AND: palabras(texto).map((p) => ({
          OR: [{ nombre: { contains: p } }, { grupoFarmacologico: { contains: p } }],
        })),
      },
      include: { presentacion: true },
      orderBy: [{ nombre: 'asc' }, { concentracion: 'asc' }],
      take: 20,
    });
    return filas.map((f) => ({
      id: f.idMedicamento,
      nombre: f.nombre,
      presentacion: f.presentacion.nombre,
      concentracion: f.concentracion,
      grupoFarmacologico: f.grupoFarmacologico,
    }));
  }
}
