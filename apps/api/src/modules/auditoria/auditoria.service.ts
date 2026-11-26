import { Injectable } from '@nestjs/common';

import { contextoActual } from '../../common/contexto/contexto-peticion.js';
import type { AccionAuditoria } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Claves que nunca se guardan en `valor_anterior` / `valor_nuevo`. */
const CLAVES_SENSIBLES = /contrasena|password|token|secreto|hash|cookie|authorization/i;

export interface RegistroAuditoria {
  accion: AccionAuditoria;
  /** Módulo funcional: auth, usuarios, atenciones… */
  modulo: string;
  entidad?: string;
  idEntidad?: string | number | bigint;
  idPaciente?: number;
  descripcion?: string;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  /**
   * Quién y en qué sesión, cuando todavía no están en el contexto de la petición
   * (por ejemplo, durante el login). Si no se indican, se toman del contexto.
   */
  idUsuario?: number;
  idSesion?: bigint;
  /** Nombre de usuario escrito en un login fallido cuando la cuenta no existe. */
  usuarioIntentado?: string;
}

/** Quita recursivamente las claves sensibles de un valor antes de guardarlo. */
export function sanear(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(sanear);
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([clave]) => !CLAVES_SENSIBLES.test(clave))
        .map(([clave, v]) => [clave, sanear(v)]),
    );
  }
  return typeof valor === 'bigint' ? valor.toString() : valor;
}

function aJson(valor: unknown): string | undefined {
  return valor === undefined ? undefined : JSON.stringify(sanear(valor));
}

/**
 * Registro de auditoría (tabla `auditoria`, solo INSERT). Toma el usuario, la sesión y la IP
 * del contexto de la petición. Nunca guarda contraseñas ni tokens.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(registro: RegistroAuditoria): Promise<void> {
    const contexto = contextoActual();
    const idUsuario = registro.idUsuario ?? contexto?.idUsuario;
    const usuarioIntentado = idUsuario ? undefined : registro.usuarioIntentado?.slice(0, 50);

    if (!idUsuario && !usuarioIntentado) {
      // La base lo rechazaría (CHECK ck_aud_quien): es un error de programación.
      throw new Error('La auditoría necesita idUsuario o usuarioIntentado');
    }

    await this.prisma.auditoria.create({
      data: {
        // La fecha la fija la aplicación (igual que el resto de fechas que escribe Prisma).
        fecha: new Date(),
        idUsuario,
        idSesion: registro.idSesion ?? contexto?.idSesion,
        usuarioIntentado,
        accion: registro.accion,
        modulo: registro.modulo,
        entidad: registro.entidad,
        idEntidad: registro.idEntidad?.toString(),
        idPaciente: registro.idPaciente,
        descripcion: registro.descripcion?.slice(0, 255),
        valorAnterior: aJson(registro.valorAnterior),
        valorNuevo: aJson(registro.valorNuevo),
        ip: contexto?.ip,
      },
    });
  }
}
