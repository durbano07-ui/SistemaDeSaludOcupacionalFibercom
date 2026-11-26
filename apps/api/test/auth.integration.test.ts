import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { perfilSchema, respuestaLoginSchema } from '@smo/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import { validarEntorno } from '../src/config/entorno.js';
import type { UsuarioPeticion } from '../src/modules/auth/auth.types.js';
import { ContrasenasService } from '../src/modules/auth/contrasenas.service.js';
import { RequierePermiso } from '../src/modules/auth/decoradores/requiere-permiso.decorator.js';
import { UsuarioActual } from '../src/modules/auth/decoradores/usuario-actual.decorator.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Prueba de integración: necesita la MariaDB de desarrollo levantada (pnpm db:up).
// Crea (una sola vez) usuarios de prueba propios; la auditoría no se puede borrar.

const CONTRASENA = 'Integracion.2026';

/** Controlador solo para las pruebas: una ruta que exige el permiso "usuarios". */
@Controller('prueba-permisos')
class ControladorPrueba {
  @RequierePermiso('usuarios')
  @Get()
  obtener(@UsuarioActual() usuario: UsuarioPeticion) {
    return { idUsuario: usuario.idUsuario, permisos: usuario.permisos };
  }
}

const USUARIOS_PRUEBA = [
  { nombreUsuario: 'prueba_int_medico', rol: 'medico_ocupacional', cedula: '0200000024' },
  { nombreUsuario: 'prueba_int_apoyo', rol: 'apoyo', cedula: '0200000032' },
] as const;

async function crearApp(conLimiteLogin: boolean): Promise<INestApplication> {
  const entorno = validarEntorno(process.env);
  let constructor = Test.createTestingModule({
    imports: [AppModule.registrar(entorno)],
    controllers: [ControladorPrueba],
  });
  if (!conLimiteLogin) {
    constructor = constructor.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  }
  const app = (await constructor.compile()).createNestApplication({ logger: false });
  configurarApp(app, entorno);
  await app.init();
  return app;
}

/** Crea los usuarios de prueba si no existen y los deja activos, sin bloqueo ni permisos extra. */
async function prepararUsuarios(prisma: PrismaService): Promise<Record<string, number>> {
  const hash = await new ContrasenasService().hash(CONTRASENA);
  const base = await prisma.base.findFirstOrThrow({ orderBy: { idBase: 'asc' } });
  const departamento = await prisma.departamento.upsert({
    where: { nombre: 'Departamento de pruebas' },
    update: {},
    create: { nombre: 'Departamento de pruebas' },
  });
  const cargo = await prisma.cargo.upsert({
    where: { nombre: 'Cargo de pruebas' },
    update: {},
    create: { nombre: 'Cargo de pruebas', idDepartamento: departamento.idDepartamento },
  });

  const ids: Record<string, number> = {};
  for (const datos of USUARIOS_PRUEBA) {
    const rol = await prisma.rol.findUniqueOrThrow({ where: { codigo: datos.rol } });
    const comunes = {
      idRol: rol.idRol,
      contrasenaHash: hash,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      estado: 'activo' as const,
    };
    const usuario = await prisma.usuario.upsert({
      where: { nombreUsuario: datos.nombreUsuario },
      update: comunes,
      create: {
        ...comunes,
        nombreUsuario: datos.nombreUsuario,
        idBase: base.idBase,
        idCargo: cargo.idCargo,
        cedula: datos.cedula,
        nombres: 'Usuario',
        apellidos: `De Prueba ${datos.rol}`,
        sexo: 'mujer',
        fechaNacimiento: new Date('1990-01-01T00:00:00Z'),
      },
    });
    await prisma.usuarioPermiso.deleteMany({ where: { idUsuario: usuario.idUsuario } });
    ids[datos.nombreUsuario] = usuario.idUsuario;
  }
  return ids;
}

function cookieRenovacion(respuesta: request.Response): string | undefined {
  const cabecera = respuesta.headers['set-cookie'] as unknown as string[] | undefined;
  return cabecera?.find((c) => c.startsWith('smo_renovacion='));
}

/** Solo `nombre=valor` de la cookie, para enviarla en la siguiente petición. */
function valorCookie(setCookie: string | undefined): string {
  return setCookie?.split(';')[0] ?? '';
}

describe('Autenticación (integración)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: Record<string, number>;

  beforeAll(async () => {
    app = await crearApp(false);
    prisma = app.get(PrismaService);
    ids = await prepararUsuarios(prisma);
  });

  beforeEach(async () => {
    await prepararUsuarios(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const login = (usuario: string, contrasena = CONTRASENA) =>
    http().post('/api/v1/auth/login').send({ usuario, contrasena });

  async function auditoriaDesde(idUsuario: number, desde: bigint) {
    const filas = await prisma.auditoria.findMany({
      where: { idUsuario, idAuditoria: { gt: desde } },
      orderBy: { idAuditoria: 'asc' },
    });
    return filas.map((f) => ({
      accion: f.accion,
      idSesion: f.idSesion,
      descripcion: f.descripcion,
    }));
  }

  async function ultimaAuditoria(): Promise<bigint> {
    const fila = await prisma.auditoria.findFirst({ orderBy: { idAuditoria: 'desc' } });
    return fila?.idAuditoria ?? 0n;
  }

  it('una ruta protegida sin token responde 401 Problem Details', async () => {
    const respuesta = await http()
      .get('/api/v1/auth/perfil')
      .expect(401)
      .expect('Content-Type', /application\/problem\+json/);

    expect(respuesta.body).toMatchObject({ status: 401, title: 'No autenticado' });
  });

  it('un token inválido responde 401', async () => {
    await http().get('/api/v1/auth/perfil').set('Authorization', 'Bearer a.b.c').expect(401);
  });

  it('login → perfil → refresh (rota; el viejo revoca) → logout, con su auditoría', async () => {
    const idMedico = ids.prueba_int_medico!;
    const desde = await ultimaAuditoria();

    // Login (sin distinguir mayúsculas)
    const respuestaLogin = await login('PRUEBA_INT_MEDICO').expect(200);
    const sesion = respuestaLoginSchema.parse(respuestaLogin.body);
    const cookie1 = cookieRenovacion(respuestaLogin);
    expect(cookie1).toMatch(/HttpOnly/);
    expect(cookie1).toMatch(/SameSite=Strict/);
    expect(cookie1).toMatch(/Path=\/api\/v1\/auth/);
    expect(sesion.usuario.rol.codigo).toBe('medico_ocupacional');

    const filaSesion = await prisma.sesion.findFirstOrThrow({
      where: { idUsuario: idMedico },
      orderBy: { idSesion: 'desc' },
    });
    expect(filaSesion.tokenRenovacionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(cookie1).not.toContain(filaSesion.tokenRenovacionHash);

    // Perfil
    const perfil = await http()
      .get('/api/v1/auth/perfil')
      .set('Authorization', `Bearer ${sesion.accessToken}`)
      .expect(200);
    expect(perfilSchema.parse(perfil.body)).toMatchObject({
      id: idMedico,
      permisos: expect.arrayContaining(['datos_clinicos', 'reportes']),
    });

    // Refresh: rota la cookie y devuelve un access token nuevo
    const respuestaRefresh = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', valorCookie(cookie1))
      .expect(200);
    const cookie2 = cookieRenovacion(respuestaRefresh);
    expect(valorCookie(cookie2)).not.toBe(valorCookie(cookie1));
    const renovada = respuestaLoginSchema.parse(respuestaRefresh.body);
    await http()
      .get('/api/v1/auth/perfil')
      .set('Authorization', `Bearer ${renovada.accessToken}`)
      .expect(200);

    // Reutilizar el refresh viejo: 401, borra la cookie y revoca la sesión
    const reutilizado = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', valorCookie(cookie1))
      .expect(401);
    expect(cookieRenovacion(reutilizado)).toMatch(/smo_renovacion=;/);
    const revocada = await prisma.sesion.findUniqueOrThrow({
      where: { idSesion: filaSesion.idSesion },
    });
    expect(revocada).toMatchObject({ motivoCierre: 'revocada', tokenRenovacionHash: null });
    expect(revocada.fin).not.toBeNull();

    // Tras la revocación, ni el refresh nuevo ni el access token sirven
    await http().post('/api/v1/auth/refresh').set('Cookie', valorCookie(cookie2)).expect(401);
    await http()
      .get('/api/v1/auth/perfil')
      .set('Authorization', `Bearer ${renovada.accessToken}`)
      .expect(401);

    // Nueva sesión y logout (idempotente)
    const otroLogin = await login('prueba_int_medico').expect(200);
    const cookie3 = valorCookie(cookieRenovacion(otroLogin));
    const logout = await http().post('/api/v1/auth/logout').set('Cookie', cookie3).expect(204);
    expect(cookieRenovacion(logout)).toMatch(/smo_renovacion=;/);
    await http().post('/api/v1/auth/logout').set('Cookie', cookie3).expect(204);
    await http().post('/api/v1/auth/logout').expect(204);
    await http().post('/api/v1/auth/refresh').set('Cookie', cookie3).expect(401);

    const cerrada = await prisma.sesion.findFirstOrThrow({
      where: { idUsuario: idMedico },
      orderBy: { idSesion: 'desc' },
    });
    expect(cerrada).toMatchObject({ motivoCierre: 'cerrada', tokenRenovacionHash: null });

    expect(await auditoriaDesde(idMedico, desde)).toEqual([
      { accion: 'iniciar_sesion', idSesion: filaSesion.idSesion, descripcion: null },
      {
        accion: 'cerrar_sesion',
        idSesion: filaSesion.idSesion,
        descripcion: 'Sesión revocada: se reutilizó un token de renovación ya rotado',
      },
      { accion: 'iniciar_sesion', idSesion: cerrada.idSesion, descripcion: null },
      { accion: 'cerrar_sesion', idSesion: cerrada.idSesion, descripcion: null },
    ]);
  });

  it('una ruta con @RequierePermiso responde 403 sin el permiso y 200 con un permiso extra', async () => {
    const idApoyo = ids.prueba_int_apoyo!;
    const { body } = await login('prueba_int_apoyo').expect(200);
    const token = respuestaLoginSchema.parse(body).accessToken;

    const prohibido = await http()
      .get('/api/v1/prueba-permisos')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
      .expect('Content-Type', /application\/problem\+json/);
    expect(prohibido.body).toMatchObject({
      status: 403,
      title: 'Acceso denegado',
      detail: 'No tienes permiso para realizar esta acción.',
      permisosFaltantes: ['usuarios'],
    });

    // Permiso extra (usuario_permiso): se aplica en la siguiente petición, sin volver a entrar.
    const permiso = await prisma.permiso.findUniqueOrThrow({ where: { codigo: 'usuarios' } });
    await prisma.usuarioPermiso.create({
      data: { idUsuario: idApoyo, idPermiso: permiso.idPermiso, idUsuarioOtorga: idApoyo },
    });
    const permitido = await http()
      .get('/api/v1/prueba-permisos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(permitido.body).toEqual({ idUsuario: idApoyo, permisos: ['usuarios'] });
  });

  it('contraseña incorrecta: 401 con intentos restantes; al 5.º, 423 y auditoría de bloqueo', async () => {
    const idApoyo = ids.prueba_int_apoyo!;
    const desde = await ultimaAuditoria();

    for (const restantes of [4, 3, 2, 1]) {
      const fallo = await login('prueba_int_apoyo', 'incorrecta').expect(401);
      expect(fallo.body).toMatchObject({
        detail: 'Usuario o contraseña incorrectos',
        intentosRestantes: restantes,
      });
    }
    const bloqueo = await login('prueba_int_apoyo', 'incorrecta').expect(423);
    expect(bloqueo.body).toMatchObject({ status: 423, title: 'Cuenta bloqueada' });
    expect(new Date(bloqueo.body.bloqueadoHasta as string).getTime()).toBeGreaterThan(Date.now());

    // Bloqueada: ni con la contraseña correcta
    await login('prueba_int_apoyo').expect(423);

    const acciones = (await auditoriaDesde(idApoyo, desde)).map((f) => f.accion);
    expect(acciones).toEqual([
      'login_fallido',
      'login_fallido',
      'login_fallido',
      'login_fallido',
      'login_fallido',
      'cuenta_bloqueada',
      'login_fallido',
    ]);
  });

  it('un usuario inexistente recibe el mismo mensaje y queda auditado el nombre', async () => {
    const nombre = `no_existe_${Date.now()}`;
    const respuesta = await login(nombre, 'x').expect(401);

    expect(respuesta.body.detail).toBe('Usuario o contraseña incorrectos');
    const fila = await prisma.auditoria.findFirst({ where: { usuarioIntentado: nombre } });
    expect(fila).toMatchObject({ accion: 'login_fallido', idUsuario: null });
  });

  it('la auditoría no guarda contraseñas ni tokens', async () => {
    const desde = await ultimaAuditoria();
    await login('prueba_int_medico').expect(200);
    await login('prueba_int_medico', 'otra-clave-secreta').expect(401);

    const filas = await prisma.auditoria.findMany({ where: { idAuditoria: { gt: desde } } });
    const texto = JSON.stringify(filas, (_k, v: unknown) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
    expect(texto).not.toContain(CONTRASENA);
    expect(texto).not.toContain('otra-clave-secreta');
  });
});

describe('Límite de intentos de login (integración)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearApp(true);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('permite 10 logins por minuto por IP y luego responde 429', async () => {
    const intentar = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ usuario: 'no_existe_limite', contrasena: 'x' });

    for (let i = 0; i < 10; i++) await intentar().expect(401);
    const respuesta = await intentar().expect(429);
    expect(respuesta.body).toMatchObject({
      status: 429,
      detail: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
    });
  });
});
