import type { INestApplication } from '@nestjs/common';
import {
  atencionDetalleSchema,
  atencionesDelMesSchema,
  atencionRegistradaSchema,
  fechaLocal,
  historialAtencionesSchema,
  type NuevaAtencionEntrada,
  nuevaAtencionSchema,
  resumenPacienteSchema,
} from '@smo/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { registrarAtencion } from '../src/modules/atenciones/registro-atencion.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { catalogos, crearApp, pacienteNuevo, token, usuarioSistema } from './apoyo-clinico.js';

// Integración del módulo de atenciones contra MariaDB (base smo_pruebas).

describe('Atenciones médicas (integración)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenMedico: string;
  let tokenApoyo: string;
  let idMedico: number;
  let meds: Awaited<ReturnType<typeof catalogos>>;

  /** Hace 1 hora: dentro del mismo día local salvo justo después de medianoche. */
  const haceUnaHora = () => new Date(Date.now() - 3_600_000).toISOString();

  const atencion = (idPaciente: number, cambios: Partial<NuevaAtencionEntrada> = {}) => ({
    idPaciente,
    tipoAtencion: 'primera',
    fecha: haceUnaHora(),
    motivo: 'Dolor lumbar',
    enfermedadActual: 'Dolor de 3 días al levantar carga',
    idCie10: 'M54.5',
    tipoEvento: 'enfermedad_comun',
    ...cambios,
  });

  const http = () => request(app.getHttpServer());
  const registrar = (cuerpo: object, tokenAcceso = tokenMedico) =>
    http().post('/api/v1/atenciones').set('Authorization', `Bearer ${tokenAcceso}`).send(cuerpo);
  const obtener = (ruta: string, tokenAcceso = tokenMedico) =>
    http().get(`/api/v1${ruta}`).set('Authorization', `Bearer ${tokenAcceso}`);

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    meds = await catalogos(prisma);
    idMedico = await usuarioSistema(
      prisma,
      'prueba_clin_medico',
      'medico_ocupacional',
      '0200000040',
    );
    await usuarioSistema(prisma, 'prueba_clin_apoyo', 'apoyo', '0200000057');
    tokenMedico = await token(app, 'prueba_clin_medico');
    tokenApoyo = await token(app, 'prueba_clin_apoyo');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('RN-01: la atención primera cierra el caso abierto y abre uno nuevo con su CIE-10', async () => {
    const idPaciente = await pacienteNuevo(prisma);
    const primera = atencionRegistradaSchema.parse(
      (await registrar(atencion(idPaciente)).expect(201)).body,
    );
    expect(primera.codigo).toMatch(/^ATE-\d{4}-\d{4,}$/);
    expect(primera.codigoEvolucion).toMatch(/^EVO-\d{4}-\d{4,}$/);

    const fecha = haceUnaHora();
    const segunda = atencionRegistradaSchema.parse(
      (await registrar(atencion(idPaciente, { idCie10: 'J06.9', fecha })).expect(201)).body,
    );

    const casos = await prisma.caso.findMany({
      where: { idUsuario: idPaciente },
      orderBy: { idCaso: 'asc' },
    });
    expect(casos).toHaveLength(2);
    expect(casos[0]).toMatchObject({ idCaso: primera.idCaso, estado: 'cerrado', idCie10: 'M54.5' });
    expect(casos[0]?.fechaCierre?.toISOString().slice(0, 10)).toBe(fechaLocal(fecha));
    expect(casos[1]).toMatchObject({ idCaso: segunda.idCaso, estado: 'abierto', idCie10: 'J06.9' });
  });

  it('RN-02: la subsecuente se suma al caso abierto; sin caso abierto responde 409', async () => {
    const sinCaso = await pacienteNuevo(prisma);
    const conflicto = await registrar(atencion(sinCaso, { tipoAtencion: 'subsecuente' })).expect(
      409,
    );
    expect(conflicto.body).toMatchObject({
      status: 409,
      detail: 'El paciente no tiene un caso abierto',
    });
    expect(await prisma.atencion.count({ where: { idUsuario: sinCaso } })).toBe(0);

    const primera = (await registrar(atencion(sinCaso)).expect(201)).body as { idCaso: number };
    const subsecuente = (
      await registrar(atencion(sinCaso, { tipoAtencion: 'subsecuente' })).expect(201)
    ).body as { idCaso: number };
    expect(subsecuente.idCaso).toBe(primera.idCaso);
  });

  it('RN-13: dos atenciones simultáneas obtienen códigos distintos y consecutivos', async () => {
    const [p1, p2] = await Promise.all([pacienteNuevo(prisma), pacienteNuevo(prisma)]);
    // Deja al menos un código del año, para que ambas compitan por el mismo "último código".
    await registrar(atencion(await pacienteNuevo(prisma))).expect(201);

    const respuestas = await Promise.all([
      registrar(atencion(p1, { certificado: { dias: 2, fechaInicio: fechaLocal(new Date()) } })),
      registrar(atencion(p2, { certificado: { dias: 2, fechaInicio: fechaLocal(new Date()) } })),
    ]);
    const [a, b] = respuestas.map((r) => atencionRegistradaSchema.parse(r.body));

    const numero = (codigo: string) => Number(codigo.split('-')[2]);
    for (const campo of ['codigo', 'codigoEvolucion', 'codigoCertificado'] as const) {
      const numeros = [numero(a![campo]!), numero(b![campo]!)].sort((x, y) => x - y);
      expect(numeros[1]! - numeros[0]!).toBe(1);
    }
  });

  it('si falla el detalle de la receta no se guarda nada (rollback)', async () => {
    const idPaciente = await pacienteNuevo(prisma);
    const { idCaso } = (await registrar(atencion(idPaciente)).expect(201)).body as {
      idCaso: number;
    };
    const antes = {
      atenciones: await prisma.atencion.count(),
      evoluciones: await prisma.evolucionMedica.count(),
      recetas: await prisma.recetaMedica.count(),
      casos: await prisma.caso.count(),
    };

    // Datos ya validados, pero con una cantidad que la columna SMALLINT UNSIGNED no admite:
    // el INSERT del detalle falla después de haber escrito caso, atención, evolución y receta.
    const datos = nuevaAtencionSchema.parse(
      atencion(idPaciente, {
        idCie10: 'J06.9',
        receta: {
          medicamentos: [
            {
              idMedicamento: meds.paracetamol,
              cantidad: 10,
              dosis: '1',
              frecuencia: 'c/8 h',
              duracion: '3 días',
            },
          ],
        },
      }),
    );
    datos.receta!.medicamentos[0]!.cantidad = 70_000;

    await expect(registrarAtencion(prisma, datos, idMedico)).rejects.toThrow();

    expect({
      atenciones: await prisma.atencion.count(),
      evoluciones: await prisma.evolucionMedica.count(),
      recetas: await prisma.recetaMedica.count(),
      casos: await prisma.caso.count(),
    }).toEqual(antes);
    // El caso abierto anterior sigue abierto (el cierre de RN-01 también se deshizo)
    expect(await prisma.caso.findUnique({ where: { idCaso } })).toMatchObject({
      estado: 'abierto',
    });
  });

  it('RN-04: fecha futura → 400 con el error del campo', async () => {
    const idPaciente = await pacienteNuevo(prisma);
    const manana = new Date(Date.now() + 86_400_000).toISOString();

    const respuesta = await registrar(atencion(idPaciente, { fecha: manana })).expect(400);

    expect(respuesta.body.errores).toContainEqual({
      campo: 'fecha',
      mensaje: 'La fecha de la atención no puede ser futura',
    });
  });

  it('RN-05: diagnóstico S sin "¿Ocurrió en el trabajo?" → 400', async () => {
    const idPaciente = await pacienteNuevo(prisma);
    const respuesta = await registrar(atencion(idPaciente, { idCie10: 'S61.0' })).expect(400);
    expect(respuesta.body.errores).toContainEqual({
      campo: 'ocurrioEnTrabajo',
      mensaje: 'Indica si ocurrió en el trabajo',
    });
    await registrar(
      atencion(idPaciente, {
        idCie10: 'S61.0',
        tipoEvento: 'accidente_trabajo',
        ocurrioEnTrabajo: true,
      }),
    ).expect(201);
  });

  it('sin el permiso "atenciones" → 403', async () => {
    const idPaciente = await pacienteNuevo(prisma);
    const respuesta = await registrar(atencion(idPaciente), tokenApoyo).expect(403);
    expect(respuesta.body.permisosFaltantes).toEqual(['atenciones']);
  });

  it('RN-06: alergia sin confirmar → 422; confirmada se guarda con la advertencia', async () => {
    const idPaciente = await pacienteNuevo(prisma, { alergias: 'Penicilína' });
    const receta = {
      medicamentos: [
        {
          idMedicamento: meds.amoxicilina,
          cantidad: 21,
          dosis: '1 cápsula',
          frecuencia: 'c/8 h',
          duracion: '7 días',
        },
      ],
    };

    const sinConfirmar = await registrar(atencion(idPaciente, { receta })).expect(422);
    expect(sinConfirmar.body.alergias).toEqual([
      {
        idMedicamento: meds.amoxicilina,
        medicamento: 'Amoxicilina',
        alergia: 'penicilina',
        por: 'grupo',
      },
    ]);

    const creada = atencionRegistradaSchema.parse(
      (
        await registrar(
          atencion(idPaciente, {
            receta: { ...receta, recetarDeTodosModos: true },
            signosVitales: { temperatura: 38.4 },
          }),
        ).expect(201)
      ).body,
    );
    expect(creada.advertencias.alergias).toHaveLength(1);
    expect(creada.advertencias.signosVitales).toEqual([
      { campo: 'temperatura', mensaje: 'Fiebre (38,4 °C)' },
    ]);
    const guardada = await prisma.recetaMedica.findUniqueOrThrow({
      where: { idAtencion: creada.id },
    });
    expect(guardada.advertencias).toContain('Penicilína');
  });

  it('auditoría "crear" con id_paciente y valor_nuevo; "leer" al ver el resumen y el detalle', async () => {
    const idPaciente = await pacienteNuevo(prisma);
    const creada = atencionRegistradaSchema.parse(
      (await registrar(atencion(idPaciente)).expect(201)).body,
    );
    await obtener(`/pacientes/${idPaciente}`).expect(200);
    await obtener(`/atenciones/${creada.id}`).expect(200);

    const filas = await prisma.auditoria.findMany({
      where: { idPaciente },
      orderBy: { idAuditoria: 'asc' },
    });
    expect(filas.map((f) => [f.accion, f.modulo, f.idUsuario])).toEqual([
      ['crear', 'atenciones', idMedico],
      ['leer', 'pacientes', idMedico],
      ['leer', 'atenciones', idMedico],
    ]);
    expect(JSON.parse(filas[0]!.valorNuevo!)).toMatchObject({
      codigo: creada.codigo,
      idCie10: 'M54.5',
    });
    expect(filas[0]!.idSesion).not.toBeNull();
  });

  it('receta, certificado (fecha_fin calculada) y detalle completo', async () => {
    const idPaciente = await pacienteNuevo(prisma, {
      nombres: 'Rosa Elena',
      apellidos: 'Detalle Prueba',
    });
    const creada = atencionRegistradaSchema.parse(
      (
        await registrar(
          atencion(idPaciente, {
            receta: {
              medicamentos: [
                {
                  idMedicamento: meds.paracetamol,
                  cantidad: 9,
                  dosis: '1 tableta',
                  frecuencia: 'c/8 h',
                  duracion: '3 días',
                },
              ],
              recomendaciones: 'Reposo relativo',
            },
            certificado: { dias: 3, fechaInicio: '2026-11-26' },
          }),
        ).expect(201)
      ).body,
    );
    expect(creada.codigoCertificado).toMatch(/^CER-\d{4}-\d{4,}$/);

    const detalle = atencionDetalleSchema.parse(
      (await obtener(`/atenciones/${creada.id}`).expect(200)).body,
    );
    expect(detalle.certificado).toMatchObject({
      dias: 3,
      fechaInicio: '2026-11-26',
      fechaFin: '2026-11-28',
    });
    expect(detalle.receta?.medicamentos[0]).toMatchObject({
      nombre: 'Paracetamol',
      presentacion: 'Tableta',
    });
    expect(detalle.medico).toEqual({
      nombres: 'Usuario',
      apellidos: 'Clínico medico_ocupacional',
      codigoMedico: 'MSP-PRUEBA',
    });
    expect(detalle.paciente.apellidos).toBe('Detalle Prueba');
  });

  it('búsqueda de pacientes (varias palabras, sin tildes), resumen, mes e historial paginado', async () => {
    const apellido = `Pérez${Date.now() % 100000}`;
    const idPaciente = await pacienteNuevo(prisma, {
      nombres: 'José Ángel',
      apellidos: apellido,
      alergias: 'AINE',
    });
    for (let i = 0; i < 12; i++) {
      await registrar(
        atencion(idPaciente, {
          tipoAtencion: i === 0 ? 'primera' : 'subsecuente',
          fecha: new Date(Date.now() - (13 - i) * 3_600_000 * 2).toISOString(),
        }),
      ).expect(201);
    }

    const busqueda = await obtener(
      `/pacientes?q=${encodeURIComponent(`angel ${apellido.replace('é', 'e')}`)}`,
    ).expect(200);
    expect(busqueda.body).toEqual([
      expect.objectContaining({ id: idPaciente, nombres: 'José Ángel', apellidos: apellido }),
    ]);
    await obtener('/pacientes?q=a').expect(400);

    const resumen = resumenPacienteSchema.parse(
      (await obtener(`/pacientes/${idPaciente}`).expect(200)).body,
    );
    expect(resumen).toMatchObject({
      alergias: 'AINE',
      edad: expect.any(Number),
      casoAbierto: { cie10: { codigo: 'M54.5' } },
    });

    const mes = fechaLocal(new Date()).slice(0, 7);
    const delMes = atencionesDelMesSchema.parse(
      (await obtener(`/pacientes/${idPaciente}/atenciones?mes=${mes}`).expect(200)).body,
    );
    expect(delMes.atenciones.length).toBeGreaterThan(0);
    await obtener(`/pacientes/${idPaciente}/atenciones?mes=2026-13`).expect(400);

    const pagina2 = historialAtencionesSchema.parse(
      (
        await obtener(`/pacientes/${idPaciente}/atenciones/historial?pagina=2&tamano=10`).expect(
          200,
        )
      ).body,
    );
    expect(pagina2).toMatchObject({ pagina: 2, tamano: 10, total: 12 });
    expect(pagina2.atenciones).toHaveLength(2);
    // De la más reciente a la más antigua: la última de la página 2 es la primera atención
    expect(pagina2.atenciones.at(-1)?.tipoAtencion).toBe('primera');
  });

  it('buscadores de CIE-10 (código o texto) y de medicamentos (nombre o grupo)', async () => {
    const porCodigo = await obtener('/cie10?q=m54').expect(200);
    expect(porCodigo.body).toContainEqual({
      codigo: 'M54.5',
      descripcion: 'Lumbago no especificado',
    });
    const porTexto = await obtener('/cie10?q=infeccion vias').expect(200);
    expect(porTexto.body.map((c: { codigo: string }) => c.codigo)).toContain('J06.9');

    const porGrupo = await obtener('/medicamentos?q=penicilina').expect(200);
    expect(porGrupo.body).toContainEqual(
      expect.objectContaining({
        nombre: 'Amoxicilina',
        presentacion: 'Cápsula',
        grupoFarmacologico: 'Penicilinas',
      }),
    );
  });
});
