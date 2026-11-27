/**
 * PRUEBAS DE CAJA NEGRA — diseñadas solo a partir de los requisitos (historias de usuario, reglas
 * RN-01…RN-13 y permisos por rol), sin mirar el código. Se ejecutan desde fuera, contra la API HTTP
 * real y la base smo_pruebas. Técnicas: partición de equivalencia (PE), valores límite (VL),
 * tablas de decisión (TD) y transición de estados (TE). Plan y resultados: docs/pruebas/caja-negra.md
 */
import type { INestApplication } from '@nestjs/common';
import type { NuevaAtencionEntrada } from '@smo/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  catalogos,
  cedulaNueva,
  CONTRASENA,
  crearApp,
  pacienteNuevo,
  token,
  usuarioSistema,
} from './apoyo-clinico.js';

/** CIE-10 adicionales (no S/T) para probar el límite de 5 diagnósticos adicionales. */
const CIE10_EXTRA = [
  ['R51', 'Cefalea'],
  ['R50.9', 'Fiebre, no especificada'],
  ['K30', 'Dispepsia'],
  ['I10', 'Hipertensión esencial (primaria)'],
  ['L30.9', 'Dermatitis, no especificada'],
  ['B34.9', 'Infección viral, no especificada'],
] as const;

describe('Caja negra (API)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let meds: Awaited<ReturnType<typeof catalogos>>;
  const tokens: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const login = (usuario: string, contrasena: string) =>
    http().post('/api/v1/auth/login').send({ usuario, contrasena });
  const get = (ruta: string, t = tokens.medico) =>
    http().get(`/api/v1${ruta}`).set('Authorization', `Bearer ${t}`);
  const registrar = (cuerpo: object, t = tokens.medico) =>
    http().post('/api/v1/atenciones').set('Authorization', `Bearer ${t}`).send(cuerpo);

  /** Atención válida y mínima; cada caso cambia solo el dato que prueba. */
  const atencion = (idPaciente: number, cambios: Partial<NuevaAtencionEntrada> = {}) => ({
    idPaciente,
    tipoAtencion: 'primera',
    fecha: '2026-11-20T10:00',
    motivo: 'Dolor lumbar',
    enfermedadActual: 'Dolor de 3 días',
    idCie10: 'M54.5',
    tipoEvento: 'enfermedad_comun',
    ...cambios,
  });
  const nuevo = () => pacienteNuevo(prisma);

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    meds = await catalogos(prisma);
    for (const [idCie10, descripcion] of CIE10_EXTRA) {
      await prisma.cie10.upsert({
        where: { idCie10 },
        update: {},
        create: { idCie10, descripcion },
      });
    }

    await usuarioSistema(prisma, 'prueba_clin_medico', 'medico_ocupacional', '0200000040');
    await usuarioSistema(prisma, 'prueba_clin_apoyo', 'apoyo', '0200000057');
    await usuarioSistema(prisma, 'prueba_cn_admin', 'administrador', cedulaNueva());
    const idApoyoReportes = await usuarioSistema(
      prisma,
      'prueba_cn_apoyo_rep',
      'apoyo',
      cedulaNueva(),
    );
    const reportes = await prisma.permiso.findUniqueOrThrow({ where: { codigo: 'reportes' } });
    await prisma.usuarioPermiso.create({
      data: {
        idUsuario: idApoyoReportes,
        idPermiso: reportes.idPermiso,
        idUsuarioOtorga: idApoyoReportes,
      },
    });

    tokens.medico = await token(app, 'prueba_clin_medico');
    tokens.apoyo = await token(app, 'prueba_clin_apoyo');
    tokens.admin = await token(app, 'prueba_cn_admin');
    tokens.apoyoReportes = await token(app, 'prueba_cn_apoyo_rep');
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  // ===================================================================== LOGIN
  describe('Inicio de sesión', () => {
    it.each([
      ['CN-01', 'VL usuario vacío (0)', '', 'x', 400],
      ['CN-02', 'VL usuario de 2 caracteres (mínimo − 1)', 'ab', 'x', 400],
      ['CN-03', 'VL usuario de 3 caracteres (mínimo)', 'abc', 'x', 401],
      ['CN-04', 'VL usuario de 50 caracteres (máximo)', 'a'.repeat(50), 'x', 401],
      ['CN-05', 'VL usuario de 51 caracteres (máximo + 1)', 'a'.repeat(51), 'x', 400],
      ['CN-06', 'VL contraseña vacía (0)', 'abcd', '', 400],
      ['CN-07', 'VL contraseña de 128 caracteres (máximo)', 'abcd', 'x'.repeat(128), 401],
      ['CN-08', 'VL contraseña de 129 caracteres (máximo + 1)', 'abcd', 'x'.repeat(129), 400],
    ])('%s · %s → %i', async (_id, _caso, usuario, contrasena, estado) => {
      await login(usuario, contrasena).expect(estado);
    });

    it('CN-09 · TD usuario inexistente → 401 con el mensaje genérico', async () => {
      const r = await login(`no_existe_${Date.now()}`, 'x').expect(401);
      expect(r.body.detail).toBe('Usuario o contraseña incorrectos');
    });

    it('CN-10 · TD usuario inactivo con la contraseña correcta → 401 con el MISMO mensaje', async () => {
      await usuarioSistema(prisma, 'prueba_cn_inactivo', 'apoyo', cedulaNueva());
      await prisma.usuario.update({
        where: { nombreUsuario: 'prueba_cn_inactivo' },
        data: { estado: 'inactivo' },
      });
      const r = await login('prueba_cn_inactivo', CONTRASENA).expect(401);
      expect(r.body.detail).toBe('Usuario o contraseña incorrectos');
    });

    it('CN-11 · PE el usuario no distingue mayúsculas → 200', async () => {
      await login('PRUEBA_CLIN_MEDICO', CONTRASENA).expect(200);
    });

    it('CN-12 · TD credenciales correctas de un usuario activo → 200 con token y cookie HttpOnly', async () => {
      const r = await login('prueba_clin_medico', CONTRASENA).expect(200);
      expect(r.body.accessToken).toBeTypeOf('string');
      expect(String(r.headers['set-cookie'])).toMatch(/HttpOnly/);
    });

    it('CN-13…CN-19 · TE estados de la cuenta: activa → 4 fallos → bloqueada → expira → activa', async () => {
      await usuarioSistema(prisma, 'prueba_cn_bloqueo', 'apoyo', cedulaNueva());
      const mala = () => login('prueba_cn_bloqueo', 'incorrecta');

      // CN-13…CN-16: cada fallo descuenta un intento
      for (const restantes of [4, 3, 2, 1]) {
        expect((await mala().expect(401)).body.intentosRestantes).toBe(restantes);
      }
      // CN-17: el 5.º fallo bloquea la cuenta
      const bloqueo = await mala().expect(423);
      expect(new Date(bloqueo.body.bloqueadoHasta as string).getTime()).toBeGreaterThan(Date.now());
      // CN-18: bloqueada, ni siquiera la contraseña correcta entra
      await login('prueba_cn_bloqueo', CONTRASENA).expect(423);
      // CN-19: pasado el tiempo de bloqueo vuelve a entrar y el contador se reinicia
      await prisma.usuario.update({
        where: { nombreUsuario: 'prueba_cn_bloqueo' },
        data: { bloqueadoHasta: new Date(Date.now() - 60_000) },
      });
      await login('prueba_cn_bloqueo', CONTRASENA).expect(200);
      expect((await mala().expect(401)).body.intentosRestantes).toBe(4);
    });
  });

  // ================================================== ATENCIÓN: VALORES LÍMITE
  describe('Registro de atención · valores límite', () => {
    it.each([
      ['CN-20', 'SatO2 49 (mínimo − 1)', { saturacionO2: 49 }, 400],
      ['CN-21', 'SatO2 50 (mínimo)', { saturacionO2: 50 }, 201],
      ['CN-22', 'SatO2 100 (máximo)', { saturacionO2: 100 }, 201],
      ['CN-23', 'SatO2 101 (máximo + 1)', { saturacionO2: 101 }, 400],
      ['CN-24', 'temperatura 29,9 (mínimo − 0,1)', { temperatura: 29.9 }, 400],
      ['CN-25', 'temperatura 30,0 (mínimo)', { temperatura: 30 }, 201],
      ['CN-26', 'temperatura 45,0 (máximo)', { temperatura: 45 }, 201],
      ['CN-27', 'temperatura 45,1 (máximo + 0,1)', { temperatura: 45.1 }, 400],
      [
        'CN-28',
        'TA sistólica igual a la diastólica (120/120)',
        { presionSistolica: 120, presionDiastolica: 120 },
        400,
      ],
      [
        'CN-29',
        'TA sistólica una unidad mayor (121/120)',
        { presionSistolica: 121, presionDiastolica: 120 },
        201,
      ],
    ])('%s · signos vitales: %s → %i', async (_id, _caso, signosVitales, estado) => {
      await registrar(atencion(await nuevo(), { signosVitales })).expect(estado);
    });

    it.each([
      ['CN-30', 0, 400],
      ['CN-31', 1, 201],
      ['CN-32', 365, 201],
      ['CN-33', 366, 400],
    ])('%s · certificado de reposo de %i días → %i', async (_id, dias, estado) => {
      await registrar(
        atencion(await nuevo(), { certificado: { dias, fechaInicio: '2026-11-20' } }),
      ).expect(estado);
    });

    it.each([
      ['CN-34', 0, 400],
      ['CN-35', 1, 201],
      ['CN-36', 9999, 201],
      ['CN-37', 10000, 400],
    ])('%s · cantidad recetada %i → %i', async (_id, cantidad, estado) => {
      const receta = {
        medicamentos: [
          {
            idMedicamento: meds.paracetamol,
            cantidad,
            dosis: '1',
            frecuencia: 'c/8 h',
            duracion: '3 días',
          },
        ],
      };
      await registrar(atencion(await nuevo(), { receta })).expect(estado);
    });

    it('CN-38 · 5 diagnósticos adicionales (máximo) → 201', async () => {
      const adicionales = CIE10_EXTRA.slice(0, 5).map(([c]) => c);
      await registrar(atencion(await nuevo(), { diagnosticosAdicionales: adicionales })).expect(
        201,
      );
    });

    it('CN-39 · 6 diagnósticos adicionales (máximo + 1) → 400', async () => {
      const adicionales = CIE10_EXTRA.map(([c]) => c);
      await registrar(atencion(await nuevo(), { diagnosticosAdicionales: adicionales })).expect(
        400,
      );
    });

    it('CN-40 · fecha de hace 1 hora → 201; CN-41 · dentro de 1 hora (futura) → 400', async () => {
      await registrar(
        atencion(await nuevo(), { fecha: new Date(Date.now() - 3_600_000).toISOString() }),
      ).expect(201);
      const r = await registrar(
        atencion(await nuevo(), { fecha: new Date(Date.now() + 3_600_000).toISOString() }),
      );
      expect(r.status).toBe(400);
      expect(r.body.errores).toContainEqual({
        campo: 'fecha',
        mensaje: 'La fecha de la atención no puede ser futura',
      });
    });

    it('CN-42 · próxima cita el mismo día → 400; CN-43 · al día siguiente → 201', async () => {
      await registrar(atencion(await nuevo(), { proximaCita: '2026-11-20' })).expect(400);
      await registrar(atencion(await nuevo(), { proximaCita: '2026-11-21' })).expect(201);
    });

    it.each([
      ['CN-44', 'vacío', '', 400],
      ['CN-45', 'solo espacios', '   ', 400],
      ['CN-46', 'un carácter', 'a', 201],
    ])('%s · motivo %s → %i', async (_id, _caso, motivo, estado) => {
      await registrar(atencion(await nuevo(), { motivo })).expect(estado);
    });
  });

  // ============================================ ATENCIÓN: TABLAS DE DECISIÓN
  describe('Registro de atención · tablas de decisión', () => {
    // RN-05: ¿CIE-10 S/T? × tipo de evento × "¿Ocurrió en el trabajo?"
    it.each([
      ['CN-47', 'M54.5', 'enfermedad_comun', undefined, 201],
      ['CN-48', 'M54.5', 'enfermedad_comun', false, 201],
      ['CN-49', 'S61.0', 'enfermedad_comun', undefined, 400],
      ['CN-50', 'S61.0', 'enfermedad_comun', false, 201],
      ['CN-51', 'S61.0', 'enfermedad_comun', true, 201],
      ['CN-52', 'M54.5', 'accidente_trabajo', true, 201],
      ['CN-53', 'M54.5', 'accidente_trabajo', false, 400],
      ['CN-54', 'S61.0', 'accidente_trabajo', undefined, 400],
    ])(
      '%s · RN-05: CIE %s, %s, ocurrió en el trabajo = %s → %i',
      async (_id, idCie10, tipoEvento, ocurrio, estado) => {
        await registrar(
          atencion(await nuevo(), {
            idCie10,
            tipoEvento: tipoEvento as NuevaAtencionEntrada['tipoEvento'],
            ...(ocurrio === undefined ? {} : { ocurrioEnTrabajo: ocurrio }),
          }),
        ).expect(estado);
      },
    );

    it('CN-55…CN-58 · RN-01/02: tipo de atención × caso abierto', async () => {
      const p = await nuevo();
      // CN-55: subsecuente sin caso abierto → 409
      const sinCaso = await registrar(atencion(p, { tipoAtencion: 'subsecuente' })).expect(409);
      expect(sinCaso.body.detail).toBe('El paciente no tiene un caso abierto');
      // CN-56: primera sin caso abierto → 201 y abre un caso
      const primera = await registrar(atencion(p, { fecha: '2026-11-18T10:00' })).expect(201);
      // CN-57: subsecuente con caso abierto → 201 en el mismo caso
      const sub = await registrar(
        atencion(p, { tipoAtencion: 'subsecuente', fecha: '2026-11-19T10:00' }),
      ).expect(201);
      expect(sub.body.idCaso).toBe(primera.body.idCaso);
      // CN-58: primera con caso abierto → 201, cierra el anterior y abre otro
      const otra = await registrar(
        atencion(p, { idCie10: 'J06.9', fecha: '2026-11-20T10:00' }),
      ).expect(201);
      expect(otra.body.idCaso).not.toBe(primera.body.idCaso);
      const resumen = await get(`/pacientes/${p}`).expect(200);
      expect(resumen.body.casoAbierto.cie10.codigo).toBe('J06.9');
    });

    // RN-06: alergias del paciente × medicamento recetado × "Recetar de todos modos"
    it.each([
      ['CN-59', null, 'amoxicilina', false, 201],
      ['CN-60', 'Penicilina', 'paracetamol', false, 201],
      ['CN-61', 'Penicilina', 'amoxicilina', false, 422],
      ['CN-62', 'Penicilina', 'amoxicilina', true, 201],
      ['CN-63', 'PENICILÍNA', 'amoxicilina', false, 422],
    ] as const)(
      '%s · RN-06: alergia "%s", recetar %s, confirmado %s → %i',
      async (_id, alergias, medicamento, confirmado, estado) => {
        const p = await pacienteNuevo(prisma, alergias ? { alergias } : {});
        const receta = {
          medicamentos: [
            {
              idMedicamento: meds[medicamento],
              cantidad: 10,
              dosis: '1',
              frecuencia: 'c/8 h',
              duracion: '5 días',
            },
          ],
          recetarDeTodosModos: confirmado,
        };
        const r = await registrar(atencion(p, { receta })).expect(estado);
        if (estado === 201 && alergias && medicamento === 'amoxicilina') {
          expect(r.body.advertencias.alergias).toHaveLength(1);
        }
      },
    );
  });

  // ======================================================= BÚSQUEDA DE PACIENTES
  describe('Búsqueda de pacientes', () => {
    let sello: string;
    let cedula: string;

    beforeAll(async () => {
      sello = `Ñúñez${Date.now() % 1_000_000}`;
      const p = await pacienteNuevo(prisma, { nombres: 'José Ángel', apellidos: sello });
      cedula = (await prisma.usuario.findUniqueOrThrow({ where: { idUsuario: p } })).cedula;
      const inactivo = await pacienteNuevo(prisma, { nombres: 'Inactivo', apellidos: sello });
      await prisma.usuario.update({ where: { idUsuario: inactivo }, data: { estado: 'inactivo' } });
    });

    it.each([
      ['CN-64', 1, 400],
      ['CN-65', 2, 200],
      ['CN-66', 100, 200],
      ['CN-67', 101, 400],
    ])('%s · VL texto de búsqueda de %i caracteres → %i', async (_id, largo, estado) => {
      await get(`/pacientes?q=${'z'.repeat(largo)}`).expect(estado);
    });

    const ids = async (q: string) =>
      (
        (await get(`/pacientes?q=${encodeURIComponent(q)}`).expect(200)).body as {
          nombres: string;
        }[]
      ).map((p) => p.nombres);

    it('CN-68 · PE por apellido sin tildes ni eñe → lo encuentra', async () => {
      expect(await ids(sello.normalize('NFD').replace(/\p{Diacritic}/gu, ''))).toEqual([
        'José Ángel',
      ]);
    });
    it('CN-69 · PE en mayúsculas y con varias palabras (nombre + apellido) → lo encuentra', async () => {
      expect(await ids(`ANGEL ${sello.toUpperCase()}`)).toEqual(['José Ángel']);
    });
    it('CN-70 · PE por el inicio de la cédula → lo encuentra', async () => {
      expect(await ids(cedula.slice(0, 9))).toContain('José Ángel');
    });
    it('CN-71 · PE paciente inactivo → no aparece', async () => {
      expect(await ids(sello)).not.toContain('Inactivo');
    });
    it('CN-72 · PE un usuario del sistema (con nombre de usuario) no es un paciente → no aparece', async () => {
      expect(await ids('Clínico medico_ocupacional')).toEqual([]);
    });
  });

  // ============================================================= REPORTES
  describe('Reportes · filtros (valores límite)', () => {
    it.each([
      ['CN-73', 'anio=1999', 400],
      ['CN-74', 'anio=2000', 200],
      ['CN-75', 'anio=2100', 200],
      ['CN-76', 'anio=2101', 400],
      ['CN-77', 'anio=abc', 400],
      ['CN-78', '', 400],
    ])('%s · consolidado con "%s" → %i', async (_id, q, estado) => {
      await get(`/reportes/consolidado-anual?${q}`).expect(estado);
    });

    it.each([
      ['CN-79', 'mes=0', 400],
      ['CN-80', 'mes=1', 200],
      ['CN-81', 'mes=12', 200],
      ['CN-82', 'mes=13', 400],
    ])('%s · registro mensual con %s → %i', async (_id, q, estado) => {
      await get(`/reportes/registro-mensual?anio=2026&${q}`).expect(estado);
    });

    it.each([
      ['CN-83', 'trimestre=0', 400],
      ['CN-84', 'trimestre=1', 200],
      ['CN-85', 'trimestre=4', 200],
      ['CN-86', 'trimestre=5', 400],
    ])('%s · informe trimestral con %s → %i', async (_id, q, estado) => {
      await get(`/reportes/informe-trimestral?anio=2026&${q}`).expect(estado);
    });

    it.each([
      ['CN-87', 'limite=0', 400],
      ['CN-88', 'limite=1', 200],
      ['CN-89', 'limite=100', 200],
      ['CN-90', 'limite=101', 400],
      ['CN-91', 'mes=3&trimestre=1', 400],
    ])('%s · morbilidad con %s → %i', async (_id, q, estado) => {
      await get(`/reportes/morbilidad?anio=2026&${q}`).expect(estado);
    });

    it('CN-92 · PE exportar con una base que no existe → 400', async () => {
      await get('/reportes/consolidado-anual/excel?anio=2026&base=999999').expect(400);
    });
  });

  describe('Metas SST · tabla de decisión (tipo × límite)', () => {
    let original: {
      texto: string;
      tipo: 'porcentaje_maximo' | 'casos_maximo' | 'informativa';
      limite: unknown;
    };

    beforeAll(async () => {
      original = await prisma.metaSst.findUniqueOrThrow({
        where: { indicador: 'enfermedad_comun' },
      });
    });
    afterAll(async () => {
      await prisma.metaSst.update({
        where: { indicador: 'enfermedad_comun' },
        data: {
          texto: original.texto,
          tipo: original.tipo,
          limite: original.limite as number | null,
        },
      });
    });

    const put = (cuerpo: object, indicador = 'enfermedad_comun') =>
      http()
        .put(`/api/v1/metas-sst/${indicador}`)
        .set('Authorization', `Bearer ${tokens.medico}`)
        .send(cuerpo);

    it.each([
      [
        'CN-93',
        'porcentaje sin límite',
        { texto: 'x', tipo: 'porcentaje_maximo', limite: '' },
        400,
      ],
      [
        'CN-94',
        'porcentaje 100 (máximo)',
        { texto: '≤ 100%', tipo: 'porcentaje_maximo', limite: 100 },
        200,
      ],
      [
        'CN-95',
        'porcentaje 100,01 (máximo + 0,01)',
        { texto: 'x', tipo: 'porcentaje_maximo', limite: 100.01 },
        400,
      ],
      [
        'CN-96',
        'casos 120 (sin tope de 100)',
        { texto: '120 casos', tipo: 'casos_maximo', limite: 120 },
        200,
      ],
      ['CN-97', 'límite negativo', { texto: 'x', tipo: 'casos_maximo', limite: -1 }, 400],
      ['CN-98', 'texto vacío', { texto: '', tipo: 'informativa', limite: null }, 400],
      [
        'CN-99',
        'texto de 61 caracteres',
        { texto: 'x'.repeat(61), tipo: 'informativa', limite: null },
        400,
      ],
    ])('%s · %s → %i', async (_id, _caso, cuerpo, estado) => {
      await put(cuerpo).expect(estado);
    });

    it('CN-100 · informativa con límite → 200 y el límite se descarta', async () => {
      const r = await put({ texto: 'Monitoreo', tipo: 'informativa', limite: 50 }).expect(200);
      expect(r.body.limite).toBeNull();
    });

    it('CN-101 · indicador que no existe → 400', async () => {
      await put({ texto: 'x', tipo: 'informativa', limite: null }, 'no_existe').expect(400);
    });
  });

  // ============================================== PERMISOS (rol × operación)
  describe('Permisos · tabla de decisión rol × operación', () => {
    // 2xx o 400 = la autorización pasó (400 por un cuerpo inválido a propósito, sin crear datos)
    interface Operacion {
      nombre: string;
      metodo: 'get' | 'post' | 'put';
      ruta: string;
      /** Cuerpo inválido a propósito: si la autorización pasa, responde 400 sin crear datos. */
      cuerpo?: object;
    }
    const OPERACIONES: Operacion[] = [
      { nombre: 'buscar pacientes', metodo: 'get', ruta: '/api/v1/pacientes?q=zz' },
      { nombre: 'registrar atención', metodo: 'post', ruta: '/api/v1/atenciones', cuerpo: {} },
      { nombre: 'buscar CIE-10', metodo: 'get', ruta: '/api/v1/cie10?q=zz' },
      {
        nombre: 'ver reportes',
        metodo: 'get',
        ruta: '/api/v1/reportes/consolidado-anual?anio=2026',
      },
      {
        nombre: 'editar metas SST',
        metodo: 'put',
        ruta: '/api/v1/metas-sst/enfermedad_comun',
        cuerpo: {},
      },
      {
        nombre: 'estadísticas del administrador',
        metodo: 'get',
        ruta: '/api/v1/admin/estadisticas/usuarios',
      },
    ];

    // Resultado esperado por rol, en el orden de OPERACIONES (P = pasa, 403 = denegado, 401 = sin sesión)
    const TABLA: [string, string, (string | number)[]][] = [
      ['CN-102', 'médico ocupacional', ['P', 'P', 'P', 'P', 'P', 403]],
      ['CN-103', 'administrador', [403, 403, 403, 403, 403, 'P']],
      ['CN-104', 'apoyo sin permisos', [403, 403, 403, 403, 403, 403]],
      ['CN-105', 'apoyo con el permiso extra "reportes"', [403, 403, 403, 'P', 'P', 403]],
      ['CN-106', 'sin sesión', [401, 401, 401, 401, 401, 401]],
    ];
    const tokenDe: Record<string, () => string | undefined> = {
      'médico ocupacional': () => tokens.medico,
      administrador: () => tokens.admin,
      'apoyo sin permisos': () => tokens.apoyo,
      'apoyo con el permiso extra "reportes"': () => tokens.apoyoReportes,
      'sin sesión': () => undefined,
    };

    it.each(TABLA)('%s · %s', async (_id, rol, esperado) => {
      const obtenidos: (string | number)[] = [];
      for (const { metodo, ruta, cuerpo } of OPERACIONES) {
        let peticion = http()[metodo](ruta);
        const t = tokenDe[rol]!();
        if (t) peticion = peticion.set('Authorization', `Bearer ${t}`);
        const { status } = await (cuerpo === undefined ? peticion : peticion.send(cuerpo));
        obtenidos.push(status < 300 || status === 400 ? 'P' : status);
      }
      expect(obtenidos).toEqual(esperado);
    });
  });
});
