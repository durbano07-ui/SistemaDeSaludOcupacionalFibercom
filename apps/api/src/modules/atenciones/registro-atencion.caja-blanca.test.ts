/**
 * PRUEBAS DE CAJA BLANCA — registrarAtencion (registro-atencion.ts)
 *
 * Grafo de flujo: 21 nodos de decisión → V(G) = 22 caminos básicos (29 condiciones simples).
 * Cada prueba recorre un camino independiente (C1…C22) o una condición de una decisión compuesta.
 * Se usa un Prisma falso para forzar cada decisión sin base de datos.
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type NuevaAtencionEntrada, nuevaAtencionSchema } from '@smo/shared';
import { describe, expect, it, vi } from 'vitest';

import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { esChoqueReintentable, MAX_REINTENTOS, registrarAtencion } from './registro-atencion.js';

interface Escenario {
  paciente?: {
    nombreUsuario: string | null;
    estado: string;
    historiaClinica: { alergias: string } | null;
  } | null;
  cie10?: { estado: string } | null;
  adicionalesActivos?: number;
  medicamentos?: { idMedicamento: number; nombre: string; grupoFarmacologico: string | null }[];
  casoAbierto?: { id_caso: bigint; fecha_apertura: Date } | null;
  /** Errores que lanza la transacción en los primeros intentos. */
  fallos?: unknown[];
}

const PACIENTE = { nombreUsuario: null, estado: 'activo', historiaClinica: null };
const AMOXICILINA = { idMedicamento: 1, nombre: 'Amoxicilina', grupoFarmacologico: 'Penicilinas' };
const PARACETAMOL = { idMedicamento: 2, nombre: 'Paracetamol', grupoFarmacologico: 'Analgésicos' };

/** Prisma falso: cada método devuelve lo que pide el escenario y registra cómo se llamó. */
function prismaFalso(e: Escenario = {}) {
  const fallos = [...(e.fallos ?? [])];
  const tx = {
    $queryRaw: vi.fn((plantilla: TemplateStringsArray) => {
      const sql = plantilla.join('?');
      if (sql.includes('FROM caso')) return Promise.resolve(e.casoAbierto ? [e.casoAbierto] : []);
      return Promise.resolve([{ ultimo: 6n }]); // último código del año
    }),
    caso: {
      update: vi.fn(() => Promise.resolve({})),
      create: vi.fn(() => Promise.resolve({ idCaso: 50 })),
    },
    atencion: { create: vi.fn(() => Promise.resolve({ idAtencion: 900 })) },
    atencionDiagnostico: { createMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    evolucionMedica: { create: vi.fn(() => Promise.resolve({})) },
    recetaMedica: { create: vi.fn(() => Promise.resolve({ idReceta: 70 })) },
    recetaDetalle: { createMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    certificadoReposo: { create: vi.fn(() => Promise.resolve({})) },
  };
  const prisma = {
    usuario: {
      findUnique: vi.fn(() => Promise.resolve(e.paciente === undefined ? PACIENTE : e.paciente)),
    },
    cie10: {
      findUnique: vi.fn(() =>
        Promise.resolve(e.cie10 === undefined ? { estado: 'activo' } : e.cie10),
      ),
      count: vi.fn(() => Promise.resolve(e.adicionalesActivos ?? 0)),
    },
    medicamento: { findMany: vi.fn(() => Promise.resolve(e.medicamentos ?? [])) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
      if (fallos.length) throw fallos.shift();
      return fn(tx);
    }),
  };
  return { prisma: prisma as unknown as PrismaClient, mock: prisma, tx };
}

const base: NuevaAtencionEntrada = {
  idPaciente: 10,
  tipoAtencion: 'primera',
  fecha: '2026-11-20T10:00',
  motivo: 'Motivo',
  enfermedadActual: 'Enfermedad actual',
  idCie10: 'J06.9',
  tipoEvento: 'enfermedad_comun',
};
const datos = (cambios: Partial<NuevaAtencionEntrada> = {}) =>
  nuevaAtencionSchema.parse({ ...base, ...cambios });
const detalle = (idMedicamento: number) => ({
  idMedicamento,
  cantidad: 10,
  dosis: '1 tableta',
  frecuencia: 'cada 8 horas',
  duracion: '5 días',
});
const choque = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('choque', { code, clientVersion: 'prueba' });

describe('Caja blanca · registrarAtencion — comprobaciones previas (D1–D9)', () => {
  it('C1 · D1 verdadera (paciente no existe) → 404', async () => {
    const { prisma } = prismaFalso({ paciente: null });
    await expect(registrarAtencion(prisma, datos(), 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('C2 · D1 segunda condición (es un usuario del sistema, no un paciente) → 404', async () => {
    const { prisma } = prismaFalso({ paciente: { ...PACIENTE, nombreUsuario: 'medico' } });
    await expect(registrarAtencion(prisma, datos(), 1)).rejects.toThrow('El paciente no existe');
  });

  it('C3 · D2 verdadera (paciente inactivo) → 409', async () => {
    const { prisma } = prismaFalso({ paciente: { ...PACIENTE, estado: 'inactivo' } });
    await expect(registrarAtencion(prisma, datos(), 1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('C4 · D3 verdadera (CIE-10 no existe) → 400', async () => {
    const { prisma } = prismaFalso({ cie10: null });
    await expect(registrarAtencion(prisma, datos(), 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('C5 · D3 segunda condición (CIE-10 inactivo) → 400', async () => {
    const { prisma } = prismaFalso({ cie10: { estado: 'inactivo' } });
    await expect(registrarAtencion(prisma, datos(), 1)).rejects.toThrow(
      'CIE-10 no existe o está inactivo',
    );
  });

  it('C6 · D4 y D5 verdaderas (un diagnóstico adicional no existe) → 400', async () => {
    const { prisma } = prismaFalso({ adicionalesActivos: 1 });
    await expect(
      registrarAtencion(prisma, datos({ diagnosticosAdicionales: ['R51', 'X99.9'] }), 1),
    ).rejects.toThrow('Algún diagnóstico adicional no existe o está inactivo');
  });

  it('C7 · D6 verdadera (después de las 19:00 la cita del día siguiente choca con el CHECK UTC) → 400', async () => {
    const { prisma, mock } = prismaFalso();
    // 20/11 20:00 en Ecuador = 21/11 01:00 UTC; la cita del 21/11 es válida en hora local pero no en UTC
    await expect(
      registrarAtencion(prisma, datos({ fecha: '2026-11-20T20:00', proximaCita: '2026-11-21' }), 1),
    ).rejects.toThrow('al menos dos días después');
    expect(mock.$transaction).not.toHaveBeenCalled();
  });

  it('C8 · D7 y D8 verdaderas (un medicamento de la receta no existe) → 400', async () => {
    const { prisma } = prismaFalso({ medicamentos: [] });
    await expect(
      registrarAtencion(prisma, datos({ receta: { medicamentos: [detalle(1)] } }), 1),
    ).rejects.toThrow('Algún medicamento de la receta no existe o está inactivo');
  });

  it('C9 · D9 verdadera (alergia sin "Recetar de todos modos") → 422 con las coincidencias', async () => {
    const { prisma, mock } = prismaFalso({
      paciente: { ...PACIENTE, historiaClinica: { alergias: 'Penicilina' } },
      medicamentos: [AMOXICILINA],
    });
    const error = await registrarAtencion(
      prisma,
      datos({ receta: { medicamentos: [detalle(1)] } }),
      1,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as UnprocessableEntityException).getResponse()).toMatchObject({
      alergias: [{ medicamento: 'Amoxicilina', por: 'grupo' }],
    });
    expect(mock.$transaction).not.toHaveBeenCalled();
  });
});

describe('Caja blanca · registrarAtencion — transacción (D10–D21)', () => {
  it('C10 · camino mínimo: primera sin caso abierto, sin receta, sin certificado, sin adicionales', async () => {
    const { prisma, tx } = prismaFalso();
    const r = await registrarAtencion(prisma, datos(), 7);

    expect(r).toMatchObject({
      id: 900,
      codigo: 'ATE-2026-0007',
      codigoEvolucion: 'EVO-2026-0007',
      codigoCertificado: null,
      idCaso: 50,
      idCasoCerrado: null,
      tipoAtencion: 'primera',
      advertencias: { alergias: [], signosVitales: [] },
    });
    expect(tx.caso.update).not.toHaveBeenCalled();
    expect(tx.caso.create).toHaveBeenCalledOnce();
    expect(tx.atencionDiagnostico.createMany).not.toHaveBeenCalled();
    expect(tx.recetaMedica.create).not.toHaveBeenCalled();
    expect(tx.certificadoReposo.create).not.toHaveBeenCalled();
    expect(tx.atencion.create.mock.calls[0]).toMatchObject([
      { data: { proximaCita: null, observaciones: null, idUsuarioRegistra: 7 } },
    ]);
  });

  it('C11 · D11, D13 y D14 verdaderas: la primera cierra el caso abierto (RN-01) y abre otro', async () => {
    const { prisma, tx } = prismaFalso({
      casoAbierto: { id_caso: 33n, fecha_apertura: new Date('2026-11-01T00:00:00Z') },
    });
    const r = await registrarAtencion(prisma, datos(), 1);

    expect(r).toMatchObject({ idCasoCerrado: 33, idCaso: 50 });
    expect(tx.caso.update).toHaveBeenCalledWith({
      where: { idCaso: 33 },
      data: { estado: 'cerrado', fechaCierre: new Date('2026-11-20T00:00:00Z') },
    });
  });

  it('C12 · D12 verdadera (fecha anterior a la apertura del caso abierto) → 409', async () => {
    const { prisma, tx } = prismaFalso({
      casoAbierto: { id_caso: 33n, fecha_apertura: new Date('2026-11-25T00:00:00Z') },
    });
    await expect(registrarAtencion(prisma, datos(), 1)).rejects.toThrow(
      'anterior a la apertura del caso abierto',
    );
    expect(tx.atencion.create).not.toHaveBeenCalled();
  });

  it('C13 · D13 falsa y D15 verdadera (subsecuente sin caso abierto) → 409 (RN-02)', async () => {
    const { prisma } = prismaFalso({ casoAbierto: null });
    await expect(
      registrarAtencion(prisma, datos({ tipoAtencion: 'subsecuente' }), 1),
    ).rejects.toThrow('El paciente no tiene un caso abierto');
  });

  it('C14 · D15 falsa (subsecuente con caso abierto): se suma al caso sin crear otro', async () => {
    const { prisma, tx } = prismaFalso({
      casoAbierto: { id_caso: 33n, fecha_apertura: new Date('2026-11-01T00:00:00Z') },
    });
    const r = await registrarAtencion(prisma, datos({ tipoAtencion: 'subsecuente' }), 1);
    expect(r).toMatchObject({ idCaso: 33, idCasoCerrado: null, tipoAtencion: 'subsecuente' });
    expect(tx.caso.create).not.toHaveBeenCalled();
    expect(tx.caso.update).not.toHaveBeenCalled();
  });

  it('C15 · D4 y D17 verdaderas: los diagnósticos adicionales se guardan con su orden', async () => {
    const { prisma, tx } = prismaFalso({ adicionalesActivos: 2 });
    await registrarAtencion(prisma, datos({ diagnosticosAdicionales: ['R51', 'R50.9'] }), 1);
    expect(tx.atencionDiagnostico.createMany).toHaveBeenCalledWith({
      data: [
        { idAtencion: 900, idCie10: 'R51', orden: 1 },
        { idAtencion: 900, idCie10: 'R50.9', orden: 2 },
      ],
    });
  });

  it('C16 · D18, D19 y D20 verdaderas: receta con medicamentos y alergia confirmada (advertencia guardada)', async () => {
    const { prisma, tx } = prismaFalso({
      paciente: { ...PACIENTE, historiaClinica: { alergias: '  Penicilina ' } },
      medicamentos: [AMOXICILINA, PARACETAMOL],
    });
    const r = await registrarAtencion(
      prisma,
      datos({ receta: { medicamentos: [detalle(1), detalle(2)], recetarDeTodosModos: true } }),
      1,
    );
    expect(r.advertencias.alergias).toHaveLength(1);
    expect(tx.recetaMedica.create.mock.calls[0]).toMatchObject([
      {
        data: {
          advertencias: 'Alergias registradas: Penicilina. Recetado de todos modos: Amoxicilina.',
          recomendaciones: null,
          signosAlarma: null,
        },
      },
    ]);
    expect(tx.recetaDetalle.createMany.mock.calls[0]).toMatchObject([
      { data: [{ idReceta: 70, idMedicamento: 1, indicaciones: null }, { idMedicamento: 2 }] },
    ]);
  });

  it('C17 · D18 verdadera, D19 y D20 falsas: receta solo con recomendación (sin detalle ni advertencia)', async () => {
    const { prisma, tx, mock } = prismaFalso();
    await registrarAtencion(
      prisma,
      datos({ receta: { medicamentos: [], recomendaciones: 'Reposo' } }),
      1,
    );
    expect(mock.medicamento.findMany).not.toHaveBeenCalled(); // D7 falsa: sin medicamentos no se consulta
    expect(tx.recetaMedica.create.mock.calls[0]).toMatchObject([
      { data: { advertencias: null, recomendaciones: 'Reposo' } },
    ]);
    expect(tx.recetaDetalle.createMany).not.toHaveBeenCalled();
  });

  it('C18 · D21 verdadera: certificado con su código y la fecha de fin calculada (RN-08)', async () => {
    const { prisma, tx } = prismaFalso();
    const r = await registrarAtencion(
      prisma,
      datos({ certificado: { dias: 3, fechaInicio: '2026-11-20' } }),
      1,
    );
    expect(r.codigoCertificado).toBe('CER-2026-0007');
    expect(tx.certificadoReposo.create).toHaveBeenCalledWith({
      data: {
        idAtencion: 900,
        codigo: 'CER-2026-0007',
        dias: 3,
        fechaInicio: new Date('2026-11-20T00:00:00Z'),
        fechaFin: new Date('2026-11-22T00:00:00Z'),
      },
    });
  });

  it('C19 · D6 falsa con cita válida y D16 verdadera: guarda la próxima cita y los signos vitales', async () => {
    const { prisma, tx } = prismaFalso();
    const r = await registrarAtencion(
      prisma,
      datos({
        proximaCita: '2026-11-27',
        observaciones: 'Control',
        signosVitales: { temperatura: 38.2, frecuenciaCardiaca: 80 },
        examenFisico: 'Normal',
        tratamiento: 'Reposo',
      }),
      1,
    );
    expect(r.advertencias.signosVitales).toEqual([
      { campo: 'temperatura', mensaje: 'Fiebre (38,2 °C)' },
    ]);
    expect(tx.atencion.create.mock.calls[0]).toMatchObject([
      { data: { proximaCita: new Date('2026-11-27T00:00:00Z'), observaciones: 'Control' } },
    ]);
    expect(tx.evolucionMedica.create.mock.calls[0]).toMatchObject([
      {
        data: {
          temperatura: 38.2,
          frecuenciaCardiaca: 80,
          presionSistolica: null,
          examenFisico: 'Normal',
        },
      },
    ]);
  });
});

describe('Caja blanca · registrarAtencion — bucle de reintentos (D22, RN-13)', () => {
  it('C20 · D22 verdadera una vez: un choque P2002 se reintenta y el segundo intento guarda', async () => {
    const { prisma, mock } = prismaFalso({ fallos: [choque('P2002')] });
    await expect(registrarAtencion(prisma, datos(), 1)).resolves.toMatchObject({ id: 900 });
    expect(mock.$transaction).toHaveBeenCalledTimes(2);
  });

  it('C21 · D22 falsa por la segunda condición: un error no reintentable se propaga sin reintentar', async () => {
    const { prisma, mock } = prismaFalso({
      fallos: [new Error('Out of range value for column cantidad')],
    });
    await expect(registrarAtencion(prisma, datos(), 1)).rejects.toThrow('Out of range');
    expect(mock.$transaction).toHaveBeenCalledOnce();
  });

  it('C22 · D22 falsa por la primera condición: agotados los reintentos se lanza el último choque', async () => {
    const choques = Array.from({ length: MAX_REINTENTOS + 1 }, () => choque('P2034'));
    const { prisma, mock } = prismaFalso({ fallos: choques });
    await expect(registrarAtencion(prisma, datos(), 1)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(mock.$transaction).toHaveBeenCalledTimes(MAX_REINTENTOS + 1);
  });
});

describe('Caja blanca · esChoqueReintentable (V(G) = 4)', () => {
  it('error de Prisma: P2002 y P2034 se reintentan; otro código no', () => {
    expect(esChoqueReintentable(choque('P2002'))).toBe(true);
    expect(esChoqueReintentable(choque('P2034'))).toBe(true);
    expect(esChoqueReintentable(choque('P2025'))).toBe(false);
  });

  it('error del driver: deadlock (1213) o espera de bloqueo (1205), en el mensaje o en la causa', () => {
    expect(esChoqueReintentable(new Error('Deadlock found when trying to get lock'))).toBe(true);
    expect(esChoqueReintentable(new Error('falló', { cause: 'ER_LOCK_WAIT_TIMEOUT 1205' }))).toBe(
      true,
    );
    expect(esChoqueReintentable(new Error('Duplicate entry'))).toBe(false);
  });

  it('algo que no es un Error no se reintenta', () => {
    expect(esChoqueReintentable('texto')).toBe(false);
    expect(esChoqueReintentable(undefined)).toBe(false);
  });
});
