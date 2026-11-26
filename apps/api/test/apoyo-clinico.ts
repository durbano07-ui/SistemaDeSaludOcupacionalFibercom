import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { esCedulaValida, respuestaLoginSchema } from '@smo/shared';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import { validarEntorno } from '../src/config/entorno.js';
import { ContrasenasService } from '../src/modules/auth/contrasenas.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Apoyo para las pruebas de integración del módulo clínico (base smo_pruebas).
// La auditoría no se puede borrar y referencia a los pacientes: cada corrida crea pacientes nuevos.

export const CONTRASENA = 'Integracion.2026';

export async function crearApp(): Promise<INestApplication> {
  const entorno = validarEntorno(process.env);
  const modulo = await Test.createTestingModule({ imports: [AppModule.registrar(entorno)] })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = modulo.createNestApplication({ logger: false });
  configurarApp(app, entorno);
  await app.init();
  return app;
}

async function organizacion(prisma: PrismaService) {
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
  return { idBase: base.idBase, idCargo: cargo.idCargo };
}

let secuencia = 0;
/** Cédula válida (módulo 10) distinta en cada llamada. */
export function cedulaNueva(): string {
  for (;;) {
    secuencia++;
    const cuerpo = `${String(Date.now() % 1e7).padStart(7, '0')}${secuencia % 10}`.slice(-7);
    for (let d = 0; d < 10; d++) {
      const cedula = `09${cuerpo}${d}`;
      if (esCedulaValida(cedula)) return cedula;
    }
  }
}

/** Usuario del sistema (con nombre de usuario), activo y sin bloqueo. */
export async function usuarioSistema(
  prisma: PrismaService,
  nombreUsuario: string,
  rol: 'medico_ocupacional' | 'apoyo',
  cedula: string,
): Promise<number> {
  const { idBase, idCargo } = await organizacion(prisma);
  const { idRol } = await prisma.rol.findUniqueOrThrow({ where: { codigo: rol } });
  const comunes = {
    idRol,
    contrasenaHash: await new ContrasenasService().hash(CONTRASENA),
    intentosFallidos: 0,
    bloqueadoHasta: null,
    estado: 'activo' as const,
  };
  const usuario = await prisma.usuario.upsert({
    where: { nombreUsuario },
    update: comunes,
    create: {
      ...comunes,
      nombreUsuario,
      idBase,
      idCargo,
      cedula,
      nombres: 'Usuario',
      apellidos: `Clínico ${rol}`,
      sexo: 'mujer',
      fechaNacimiento: new Date('1985-05-05T00:00:00Z'),
      codigoMedico: rol === 'medico_ocupacional' ? 'MSP-PRUEBA' : null,
    },
  });
  await prisma.usuarioPermiso.deleteMany({ where: { idUsuario: usuario.idUsuario } });
  return usuario.idUsuario;
}

/** Paciente nuevo (usuario sin nombre de usuario), opcionalmente con alergias. */
export async function pacienteNuevo(
  prisma: PrismaService,
  datos: { nombres?: string; apellidos?: string; alergias?: string } = {},
): Promise<number> {
  const { idBase, idCargo } = await organizacion(prisma);
  const paciente = await prisma.usuario.create({
    data: {
      idBase,
      idCargo,
      cedula: cedulaNueva(),
      nombres: datos.nombres ?? 'Paciente',
      apellidos: datos.apellidos ?? 'De Prueba',
      sexo: 'hombre',
      fechaNacimiento: new Date('1990-03-10T00:00:00Z'),
    },
  });
  if (datos.alergias) {
    await prisma.historiaClinica.create({
      data: {
        idUsuario: paciente.idUsuario,
        numeroHistoria: `HC-P${paciente.idUsuario}`,
        fechaApertura: new Date('2026-01-01T00:00:00Z'),
        alergias: datos.alergias,
      },
    });
  }
  return paciente.idUsuario;
}

export const CIE10_PRUEBA = [
  { idCie10: 'M54.5', descripcion: 'Lumbago no especificado' },
  {
    idCie10: 'J06.9',
    descripcion: 'Infección aguda de las vías respiratorias superiores, no especificada',
  },
  { idCie10: 'S61.0', descripcion: 'Herida de dedo(s) de la mano, sin daño de la(s) uña(s)' },
];

/** CIE-10 y medicamentos que usan las pruebas. Devuelve los ids de los medicamentos. */
export async function catalogos(prisma: PrismaService) {
  for (const c of CIE10_PRUEBA) {
    await prisma.cie10.upsert({ where: { idCie10: c.idCie10 }, update: {}, create: c });
  }
  const tableta = await prisma.presentacion.findUniqueOrThrow({ where: { nombre: 'Tableta' } });
  const cápsula = await prisma.presentacion.findUniqueOrThrow({ where: { nombre: 'Cápsula' } });
  const medicamento = (
    nombre: string,
    idPresentacion: number,
    concentracion: string,
    grupo: string,
  ) =>
    prisma.medicamento.upsert({
      where: {
        nombre_idPresentacion_concentracion: { nombre, idPresentacion, concentracion },
      },
      update: { grupoFarmacologico: grupo, estado: 'activo' },
      create: { nombre, idPresentacion, concentracion, grupoFarmacologico: grupo },
    });
  const amoxicilina = await medicamento(
    'Amoxicilina',
    cápsula.idPresentacion,
    '500 mg',
    'Penicilinas',
  );
  const paracetamol = await medicamento(
    'Paracetamol',
    tableta.idPresentacion,
    '500 mg',
    'Analgésicos',
  );
  return { amoxicilina: amoxicilina.idMedicamento, paracetamol: paracetamol.idMedicamento };
}

/** Inicia sesión y devuelve el access token. */
export async function token(app: INestApplication, usuario: string): Promise<string> {
  const respuesta = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ usuario, contrasena: CONTRASENA })
    .expect(200);
  return respuestaLoginSchema.parse(respuesta.body).accessToken;
}
