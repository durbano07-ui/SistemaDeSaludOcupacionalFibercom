import type { INestApplication } from '@nestjs/common';
import {
  consolidadoAnualSchema,
  informeTrimestralSchema,
  morbilidadSchema,
  type NuevaAtencionEntrada,
  nuevaAtencionSchema,
  registroMensualSchema,
} from '@smo/shared';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { registrarAtencion } from '../src/modules/atenciones/registro-atencion.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { catalogos, cedulaNueva, crearApp, token, usuarioSistema } from './apoyo-clinico.js';

// Integración de reportes con datos CONTROLADOS: cada corrida crea su propia base y sus cargos y
// filtra por ellos, así los números son exactos aunque smo_pruebas tenga datos de otras corridas.

/** Lee la respuesta binaria (Excel o PDF) como Buffer. */
const binario = (res: request.Response, fin: (e: Error | null, cuerpo?: Buffer) => void) => {
  const partes: Buffer[] = [];
  res.on('data', (parte: Buffer) => partes.push(parte));
  res.on('end', () => fin(null, Buffer.concat(partes)));
};

describe('Reportes (integración)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenMedico: string;
  let tokenApoyo: string;
  let idMedico: number;
  let baseA: number;
  let baseB: number;
  let cargoX: number;
  let cargoY: number;

  const http = () => request(app.getHttpServer());
  const obtener = (ruta: string, t = tokenMedico) =>
    http().get(`/api/v1${ruta}`).set('Authorization', `Bearer ${t}`);

  async function paciente(idBase: number, idCargo: number): Promise<number> {
    const p = await prisma.usuario.create({
      data: {
        idBase,
        idCargo,
        cedula: cedulaNueva(),
        nombres: 'Paciente',
        apellidos: 'De Reportes',
        sexo: 'mujer',
        fechaNacimiento: new Date('1988-04-04T00:00:00Z'),
      },
    });
    return p.idUsuario;
  }

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    const meds = await catalogos(prisma);
    idMedico = await usuarioSistema(
      prisma,
      'prueba_clin_medico',
      'medico_ocupacional',
      '0200000040',
    );
    await usuarioSistema(prisma, 'prueba_clin_apoyo', 'apoyo', '0200000057');
    tokenMedico = await token(app, 'prueba_clin_medico');
    tokenApoyo = await token(app, 'prueba_clin_apoyo');

    const sello = `${Date.now()}`.slice(-9);
    const departamento = await prisma.departamento.upsert({
      where: { nombre: 'Departamento de pruebas' },
      update: {},
      create: { nombre: 'Departamento de pruebas' },
    });
    baseA = (await prisma.base.create({ data: { nombre: `Base A ${sello}` } })).idBase;
    baseB = (await prisma.base.create({ data: { nombre: `Base B ${sello}` } })).idBase;
    const cargo = async (nombre: string) =>
      (
        await prisma.cargo.create({
          data: { nombre: `${nombre} ${sello}`, idDepartamento: departamento.idDepartamento },
        })
      ).idCargo;
    cargoX = await cargo('Cargo X');
    cargoY = await cargo('Cargo Y');

    const p1 = await paciente(baseA, cargoX);
    const p2 = await paciente(baseA, cargoY);
    const p3 = await paciente(baseB, cargoX);

    const receta = (...ids: number[]) => ({
      medicamentos: ids.map((idMedicamento) => ({
        idMedicamento,
        cantidad: 10,
        dosis: idMedicamento === meds.paracetamol ? '1 tableta' : '1 cápsula',
        frecuencia: 'cada 8 horas',
        duracion: '5 días',
      })),
    });
    const registrar = (
      datos: Partial<NuevaAtencionEntrada> & Pick<NuevaAtencionEntrada, 'idPaciente' | 'fecha'>,
    ) =>
      registrarAtencion(
        prisma,
        nuevaAtencionSchema.parse({
          tipoAtencion: 'primera',
          motivo: 'Motivo',
          enfermedadActual: 'Enfermedad actual',
          idCie10: 'M54.5',
          tipoEvento: 'enfermedad_comun',
          ...datos,
        }),
        idMedico,
      );

    // Base A (p1 cargo X, p2 cargo Y) — en orden cronológico por paciente
    await registrar({
      idPaciente: p1,
      fecha: '2025-01-15T10:00',
      receta: receta(meds.paracetamol),
    });
    await registrar({
      idPaciente: p1,
      fecha: '2025-02-10T10:00',
      tipoAtencion: 'subsecuente',
      receta: receta(meds.paracetamol, meds.amoxicilina),
    });
    await registrar({
      idPaciente: p2,
      fecha: '2025-02-20T09:00',
      idCie10: 'J06.9',
      receta: receta(meds.amoxicilina),
    });
    await registrar({
      idPaciente: p2,
      fecha: '2025-03-05T11:00',
      idCie10: 'S61.0',
      tipoEvento: 'accidente_trabajo',
      ocurrioEnTrabajo: true,
    });
    // 31-dic-2025 22:00 en Ecuador = 01-ene-2026 03:00 UTC: debe contar en DICIEMBRE de 2025
    await registrar({
      idPaciente: p1,
      fecha: '2025-12-31T22:00',
      idCie10: 'J06.9',
      tipoEvento: 'enfermedad_profesional',
    });
    // Base B
    await registrar({
      idPaciente: p3,
      fecha: '2025-04-02T08:30',
      idCie10: 'J06.9',
      tipoEvento: 'incidente_trabajo',
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('consolidado anual con números exactos; el 31-dic 22:00 de Ecuador cuenta en diciembre', async () => {
    const r = consolidadoAnualSchema.parse(
      (await obtener(`/reportes/consolidado-anual?anio=2025&base=${baseA}`).expect(200)).body,
    );
    expect(r.totales).toEqual({
      total: 5,
      enfermedadComun: 3,
      enfermedadProfesional: 1,
      incidentes: 0,
      accidentes: 1,
      primera: 4,
      subsecuente: 1,
    });
    expect(r.meses.map((m) => m.total)).toEqual([1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    expect(r.meses[11]).toMatchObject({ enfermedadProfesional: 1 });

    const anioSiguiente = consolidadoAnualSchema.parse(
      (await obtener(`/reportes/consolidado-anual?anio=2026&base=${baseA}`).expect(200)).body,
    );
    expect(anioSiguiente.totales.total).toBe(0);
  });

  it('filtros de base y cargo', async () => {
    const soloB = consolidadoAnualSchema.parse(
      (await obtener(`/reportes/consolidado-anual?anio=2025&base=${baseB}`).expect(200)).body,
    );
    expect(soloB.totales).toMatchObject({ total: 1, incidentes: 1 });

    const aX = consolidadoAnualSchema.parse(
      (
        await obtener(`/reportes/consolidado-anual?anio=2025&base=${baseA}&cargo=${cargoX}`).expect(
          200,
        )
      ).body,
    );
    expect(aX.totales).toMatchObject({ total: 3, primera: 2, subsecuente: 1 });

    const aY = consolidadoAnualSchema.parse(
      (
        await obtener(`/reportes/consolidado-anual?anio=2025&base=${baseA}&cargo=${cargoY}`).expect(
          200,
        )
      ).body,
    );
    expect(aY.totales).toMatchObject({ total: 2, accidentes: 1 });
  });

  it('informe trimestral: valores, %, Meta SST y Cumple (incluido el trimestre sin atenciones)', async () => {
    const r = informeTrimestralSchema.parse(
      (await obtener(`/reportes/informe-trimestral?anio=2025&base=${baseA}`).expect(200)).body,
    );
    expect(r.trimestres).toHaveLength(4);

    const t1 = r.trimestres[0]!;
    expect(t1.meses).toEqual([1, 2, 3]);
    const fila = (t: typeof t1, indicador: string) =>
      t.filas.find((f) => f.indicador === indicador)!;
    expect(fila(t1, 'enfermedad_comun')).toEqual({
      indicador: 'enfermedad_comun',
      valores: [1, 2, 0],
      total: 3,
      porcentaje: 75,
      meta: '< 15%',
      cumple: 'no',
    });
    expect(fila(t1, 'enfermedad_profesional')).toMatchObject({
      total: 0,
      porcentaje: 0,
      cumple: 'si',
    });
    expect(fila(t1, 'accidente_trabajo')).toMatchObject({
      valores: [0, 0, 1],
      total: 1,
      cumple: 'no',
    });
    expect(fila(t1, 'incidente_trabajo')).toMatchObject({ meta: 'Prevención 100%', cumple: null });
    expect(fila(t1, 'total_atenciones')).toMatchObject({
      valores: [1, 2, 1],
      total: 4,
      porcentaje: 100,
      cumple: null,
    });

    // T2 sin atenciones: % "—" y Cumple de la meta por porcentaje "—"; la de casos sí se evalúa
    const t2 = r.trimestres[1]!;
    expect(fila(t2, 'enfermedad_comun')).toMatchObject({
      total: 0,
      porcentaje: null,
      cumple: null,
    });
    expect(fila(t2, 'accidente_trabajo')).toMatchObject({ total: 0, cumple: 'si' });

    // T4: la enfermedad profesional del 31-dic incumple "0 casos"
    const t4 = informeTrimestralSchema.parse(
      (
        await obtener(`/reportes/informe-trimestral?anio=2025&trimestre=4&base=${baseA}`).expect(
          200,
        )
      ).body,
    ).trimestres;
    expect(t4).toHaveLength(1);
    expect(fila(t4[0]!, 'enfermedad_profesional')).toMatchObject({
      valores: [0, 0, 1],
      cumple: 'no',
    });
    expect(fila(t4[0]!, 'enfermedad_comun')).toMatchObject({ porcentaje: 0, cumple: 'si' });
  });

  it('morbilidad: solo atenciones primeras, ranking y los 2 medicamentos más recetados', async () => {
    const r = morbilidadSchema.parse(
      (await obtener(`/reportes/morbilidad?anio=2025&base=${baseA}`).expect(200)).body,
    );
    // 5 atenciones, pero solo 4 primeras (la subsecuente de M54.5 no suma un caso)
    expect(r.totalPrimeras).toBe(4);
    expect(r.filas.map((f) => [f.codigo, f.casos, f.porcentaje, f.tratamiento])).toEqual([
      ['J06.9', 2, 50, 'Amoxicilina 500 mg'],
      ['M54.5', 1, 25, 'Paracetamol 500 mg, Amoxicilina 500 mg'],
      ['S61.0', 1, 25, 'Sin receta'],
    ]);

    const t1 = morbilidadSchema.parse(
      (await obtener(`/reportes/morbilidad?anio=2025&trimestre=1&base=${baseA}`).expect(200)).body,
    );
    expect(t1).toMatchObject({ periodo: 'Trimestre 1 de 2025', totalPrimeras: 3 });
    await obtener(`/reportes/morbilidad?anio=2025&mes=1&trimestre=1`).expect(400);
  });

  it('registro mensual: totales del mes y medicamentos "Nombre concentración – dosificación"', async () => {
    const r = registroMensualSchema.parse(
      (await obtener(`/reportes/registro-mensual?anio=2025&mes=2&base=${baseA}`).expect(200)).body,
    );
    expect(r.meses).toHaveLength(1);
    expect(r.meses[0]!.totales).toMatchObject({ total: 2, primera: 1, subsecuente: 1 });
    expect(r.meses[0]!.filas.map((f) => [f.cie10, f.tipoAtencion, f.medicamentos])).toEqual([
      ['M54.5', 'Subsecuente', 'Paracetamol 500 mg – 1 t c/8 h; Amoxicilina 500 mg – 1 c c/8 h'],
      ['J06.9', 'Primera vez', 'Amoxicilina 500 mg – 1 c c/8 h'],
    ]);
  });

  it('el Excel se abre con ExcelJS y tiene los encabezados y totales esperados; queda auditado', async () => {
    const respuesta = await obtener(`/reportes/consolidado-anual/excel?anio=2025&base=${baseA}`)
      .buffer(true)
      .parse(binario)
      .expect(200)
      .expect('Content-Type', /spreadsheetml/)
      .expect('Content-Disposition', /reporte-consolidado-anual-2025\.xlsx/);

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(respuesta.body as Buffer);
    const hoja = libro.worksheets[0]!;
    expect(hoja.getCell('A1').value).toBe('CONSOLIDADO ANUAL DE ATENCIONES');
    expect(hoja.getCell('A2').value).toBe(
      'FIBERCOM – Departamento de Seguridad y Salud Ocupacional',
    );
    const filas = hoja.getSheetValues().filter(Boolean) as unknown[][];
    const encabezados = filas.find((f) => f.includes('Mes'))!;
    expect(encabezados.slice(1)).toEqual([
      'Mes',
      'Total atenciones',
      'Enfermedad común',
      'Enfermedad profesional',
      'Incidentes',
      'Accidentes',
      'Primera vez',
      'Subsecuente',
    ]);
    expect(filas.find((f) => f[1] === 'TOTAL')!.slice(1)).toEqual(['TOTAL', 5, 3, 1, 0, 1, 4, 1]);
    expect(hoja.getRow(5).getCell(1).font?.color?.argb).toBe('FFFFFFFF');

    // Registro sin mes: una hoja por mes
    const anual = await obtener(`/reportes/registro-mensual/excel?anio=2025&base=${baseA}`)
      .buffer(true)
      .parse(binario)
      .expect(200);
    const libroAnual = new ExcelJS.Workbook();
    await libroAnual.xlsx.load(anual.body as Buffer);
    expect(libroAnual.worksheets.map((h) => h.name)).toHaveLength(12);
    expect(libroAnual.worksheets[1]!.name).toBe('Febrero');

    const auditoria = await prisma.auditoria.findFirst({
      where: { accion: 'exportar', idUsuario: idMedico },
      orderBy: { idAuditoria: 'desc' },
    });
    expect(auditoria).toMatchObject({ modulo: 'reportes' });
    expect(auditoria?.descripcion).toContain('registro-mensual a Excel');
  });

  it('el PDF responde application/pdf y no está vacío', async () => {
    const respuesta = await obtener(
      `/reportes/informe-trimestral/pdf?anio=2025&trimestre=1&base=${baseA}`,
    )
      .buffer(true)
      .parse(binario)
      .expect(200)
      .expect('Content-Type', 'application/pdf')
      .expect('Content-Disposition', /informe-trimestral-sst-2025-T1\.pdf/);
    const pdf = respuesta.body as Buffer;
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 60_000);

  it('metas SST: sin permiso → 403; con permiso se actualiza y queda en auditoría', async () => {
    const cuerpo = { texto: '< 20%', tipo: 'porcentaje_maximo', limite: 20 };
    await http()
      .put('/api/v1/metas-sst/enfermedad_comun')
      .set('Authorization', `Bearer ${tokenApoyo}`)
      .send(cuerpo)
      .expect(403);

    const antes = await prisma.metaSst.findUniqueOrThrow({
      where: { indicador: 'enfermedad_comun' },
    });
    try {
      await http()
        .put('/api/v1/metas-sst/enfermedad_comun')
        .set('Authorization', `Bearer ${tokenMedico}`)
        .send({ texto: '', tipo: 'casos_maximo', limite: '' })
        .expect(400);
      const r = await http()
        .put('/api/v1/metas-sst/enfermedad_comun')
        .set('Authorization', `Bearer ${tokenMedico}`)
        .send(cuerpo)
        .expect(200);
      expect(r.body).toMatchObject({ indicador: 'enfermedad_comun', texto: '< 20%', limite: 20 });

      const auditoria = await prisma.auditoria.findFirst({
        where: { accion: 'actualizar', entidad: 'meta_sst', idUsuario: idMedico },
        orderBy: { idAuditoria: 'desc' },
      });
      expect(JSON.parse(auditoria!.valorAnterior!)).toMatchObject({ texto: antes.texto });
      expect(JSON.parse(auditoria!.valorNuevo!)).toEqual({
        texto: '< 20%',
        tipo: 'porcentaje_maximo',
        limite: 20,
      });
    } finally {
      await prisma.metaSst.update({
        where: { indicador: 'enfermedad_comun' },
        data: { texto: antes.texto, tipo: antes.tipo, limite: antes.limite },
      });
    }
  });

  it('sin el permiso "reportes" → 403', async () => {
    await obtener('/reportes/consolidado-anual?anio=2025', tokenApoyo).expect(403);
    await obtener('/reportes/morbilidad/excel?anio=2025', tokenApoyo).expect(403);
  });
});
