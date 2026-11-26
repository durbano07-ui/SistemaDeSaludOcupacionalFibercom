import { Injectable } from '@nestjs/common';
import type { AtencionDetalle, AtencionRegistrada, NuevaAtencion } from '@smo/shared';

import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ConsultasAtencionesService } from './consultas-atenciones.service.js';
import { registrarAtencion } from './registro-atencion.js';

const MODULO = 'atenciones';

@Injectable()
export class AtencionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consultas: ConsultasAtencionesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async registrar(datos: NuevaAtencion, idMedico: number): Promise<AtencionRegistrada> {
    const { idCasoCerrado, ...guardada } = await registrarAtencion(this.prisma, datos, idMedico);

    await this.auditoria.registrar({
      accion: 'crear',
      modulo: MODULO,
      entidad: 'atencion',
      idEntidad: guardada.id,
      idPaciente: datos.idPaciente,
      descripcion: `Atención ${guardada.tipoAtencion} ${guardada.codigo} (${datos.idCie10})`,
      valorNuevo: {
        codigo: guardada.codigo,
        codigoEvolucion: guardada.codigoEvolucion,
        codigoCertificado: guardada.codigoCertificado,
        tipoAtencion: guardada.tipoAtencion,
        tipoEvento: datos.tipoEvento,
        idCie10: datos.idCie10,
        fecha: datos.fecha,
        idCaso: guardada.idCaso,
        idCasoCerrado,
        medicamentos: datos.receta?.medicamentos.map((m) => m.idMedicamento) ?? [],
        certificado: datos.certificado ?? null,
        advertencias: guardada.advertencias,
      },
    });
    return guardada;
  }

  async detalle(idAtencion: number): Promise<AtencionDetalle> {
    const detalle = await this.consultas.detalle(idAtencion);
    await this.auditoria.registrar({
      accion: 'leer',
      modulo: MODULO,
      entidad: 'atencion',
      idEntidad: idAtencion,
      idPaciente: detalle.paciente.id,
      descripcion: `Ver atención ${detalle.codigo}`,
    });
    return detalle;
  }
}
