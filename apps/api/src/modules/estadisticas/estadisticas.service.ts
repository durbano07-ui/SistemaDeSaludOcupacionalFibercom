import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { EstadoModulo, Modulos, Rendimiento, UsuariosActivos } from '@smo/shared';

import { HORAS_DETRAS_DE_UTC, rangoUtc } from '../../common/hora-ecuador.js';
import { PdfService } from '../../common/pdf/pdf.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReportesRepositorio } from '../reportes/reportes.repositorio.js';
import { RegistroRendimiento } from './registro-rendimiento.js';

const DIA = 86_400_000;
const MS_ECUADOR = HORAS_DETRAS_DE_UTC * 3_600_000;
const diaEcuador = (instante: number) => new Date(instante - MS_ECUADOR).toISOString().slice(0, 10);

/** Panel de Estadísticas del administrador (sin tablas nuevas). */
@Injectable()
export class EstadisticasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rendimiento: RegistroRendimiento,
    private readonly pdf: PdfService,
    private readonly jwt: JwtService,
    private readonly reportes: ReportesRepositorio,
  ) {}

  tiempos(rango: '1h' | '24h'): Rendimiento {
    return this.rendimiento.resumen(rango);
  }

  /**
   * Activos ahora: sesiones abiertas con actividad en los últimos 15 minutos.
   * Por día: usuarios distintos que iniciaron sesión cada día de los últimos 30 (hora de Ecuador).
   */
  async usuarios(): Promise<UsuariosActivos> {
    const ahora = Date.now();
    const hoy = diaEcuador(ahora);
    const desdeDia = new Date(new Date(`${hoy}T00:00:00Z`).getTime() - 29 * DIA + MS_ECUADOR);

    const [[activos], filas] = await Promise.all([
      this.prisma.$queryRaw<{ total: unknown }[]>`
        SELECT COUNT(DISTINCT id_usuario) AS total FROM sesion
        WHERE fin IS NULL AND ultima_actividad >= ${new Date(ahora - 15 * 60_000)}`,
      this.prisma.$queryRaw<{ dia: Date | string; usuarios: unknown }[]>`
        SELECT DATE(DATE_SUB(inicio, INTERVAL ${Prisma.raw(String(HORAS_DETRAS_DE_UTC))} HOUR)) AS dia,
               COUNT(DISTINCT id_usuario) AS usuarios
        FROM sesion WHERE inicio >= ${desdeDia}
        GROUP BY dia`,
    ]);
    const porDia = new Map(
      filas.map((f) => [
        f.dia instanceof Date ? f.dia.toISOString().slice(0, 10) : String(f.dia).slice(0, 10),
        Number(f.usuarios),
      ]),
    );
    return {
      activosAhora: Number(activos?.total ?? 0),
      porDia: Array.from({ length: 30 }, (_, i) => {
        const dia = new Date(new Date(`${hoy}T00:00:00Z`).getTime() - (29 - i) * DIA)
          .toISOString()
          .slice(0, 10);
        return { dia, usuarios: porDia.get(dia) ?? 0 };
      }),
    };
  }

  /** Verifica cada módulo y mide su latencia. */
  async modulos(): Promise<Modulos> {
    const verificar = async (
      modulo: string,
      prueba: () => Promise<string>,
    ): Promise<EstadoModulo> => {
      const inicio = performance.now();
      try {
        const detalle = await prueba();
        return {
          modulo,
          estado: 'operativo',
          latenciaMs: Math.round(performance.now() - inicio),
          detalle,
          verificadoEn: new Date().toISOString(),
        };
      } catch (error) {
        return {
          modulo,
          estado: 'con_fallas',
          latenciaMs: null,
          detalle: (error as Error).message.slice(0, 200),
          verificadoEn: new Date().toISOString(),
        };
      }
    };

    const modulos = await Promise.all([
      verificar('API', () =>
        Promise.resolve(`En línea hace ${Math.round(process.uptime() / 60)} min`),
      ),
      verificar('Base de datos', async () => {
        await this.prisma.$queryRaw`SELECT 1`;
        return 'Responde a SELECT 1';
      }),
      verificar('Generador de PDF', async () => {
        await this.pdf.verificar();
        return 'Abre una página en blanco';
      }),
      verificar('Autenticación', async () => {
        const token = await this.jwt.signAsync({ sub: '0', sid: '0', rol: 'apoyo' });
        await this.jwt.verifyAsync(token);
        const roles = await this.prisma.rol.count();
        if (roles === 0) throw new Error('No hay roles en la base');
        return `Firma de tokens y ${roles} roles`;
      }),
      verificar('Atenciones', async () => {
        const cie10 = await this.prisma.cie10.count({ where: { estado: 'activo' } });
        if (cie10 === 0) throw new Error('El catálogo CIE-10 está vacío');
        await this.prisma.atencion.findFirst({ select: { idAtencion: true } });
        return `${cie10} códigos CIE-10 activos`;
      }),
      verificar('Reportes', async () => {
        const anio = new Date(Date.now() - MS_ECUADOR).getUTCFullYear();
        await this.reportes.conteosPorMes(rangoUtc(anio));
        const metas = await this.prisma.metaSst.count();
        return `Consultas agregadas y ${metas} metas SST`;
      }),
    ]);
    return {
      operativos: modulos.filter((m) => m.estado === 'operativo').length,
      total: modulos.length,
      modulos,
    };
  }
}
