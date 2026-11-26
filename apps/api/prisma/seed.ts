/**
 * Datos de desarrollo: un administrador ("admin") y un médico ("medico") con datos FICTICIOS, y
 * los datos clínicos de ejemplo (seed-clinico.ts).
 * Las contraseñas se toman de SEED_ADMIN_PASSWORD y SEED_MEDICO_PASSWORD (.env).
 * Uso: pnpm db:seed. Si los usuarios ya existen, no los modifica. No corre en producción.
 */
import { fileURLToPath } from 'node:url';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { esCedulaValida } from '@smo/shared';
import { config as cargarEnv } from 'dotenv';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { ContrasenasService } from '../src/modules/auth/contrasenas.service.js';
import { configuracionPool } from '../src/prisma/prisma.service.js';
import { sembrarDatosClinicos } from './seed-clinico.js';

cargarEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

interface UsuarioSemilla {
  nombreUsuario: string;
  variableContrasena: 'SEED_ADMIN_PASSWORD' | 'SEED_MEDICO_PASSWORD';
  rol: 'administrador' | 'medico_ocupacional';
  cargo: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  sexo: 'hombre' | 'mujer';
  fechaNacimiento: string;
  correo: string;
  codigoMedico?: string;
}

// Personas inventadas; las cédulas son válidas (módulo 10) pero no pertenecen a nadie conocido.
const USUARIOS: UsuarioSemilla[] = [
  {
    nombreUsuario: 'admin',
    variableContrasena: 'SEED_ADMIN_PASSWORD',
    rol: 'administrador',
    cargo: 'Administrador del sistema',
    cedula: '0200000008',
    nombres: 'Andrea Sofía',
    apellidos: 'Prueba Administradora',
    sexo: 'mujer',
    fechaNacimiento: '1990-03-15',
    correo: 'admin@ejemplo.invalid',
  },
  {
    nombreUsuario: 'medico',
    variableContrasena: 'SEED_MEDICO_PASSWORD',
    rol: 'medico_ocupacional',
    cargo: 'Médico ocupacional',
    cedula: '0200000016',
    nombres: 'Carlos Andrés',
    apellidos: 'Ficticio Médico',
    sexo: 'hombre',
    fechaNacimiento: '1985-07-22',
    correo: 'medico@ejemplo.invalid',
    codigoMedico: 'MSP-0000',
  },
];

const DEPARTAMENTO = 'Seguridad y Salud Ocupacional';

async function sembrar(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de desarrollo no se ejecuta con NODE_ENV=production.');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta DATABASE_URL.');

  const contrasenas = new ContrasenasService();
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(configuracionPool(databaseUrl)) });
  try {
    const base =
      (await prisma.base.findFirst({ orderBy: { idBase: 'asc' } })) ??
      (await prisma.base.create({ data: { nombre: 'Matriz' } }));
    const departamento = await prisma.departamento.upsert({
      where: { nombre: DEPARTAMENTO },
      update: {},
      create: { nombre: DEPARTAMENTO },
    });

    for (const datos of USUARIOS) {
      const existente = await prisma.usuario.findUnique({
        where: { nombreUsuario: datos.nombreUsuario },
        select: { idUsuario: true },
      });
      if (existente) {
        console.warn(`· "${datos.nombreUsuario}" ya existe: no se modifica.`);
        continue;
      }

      const contrasena = process.env[datos.variableContrasena];
      if (!contrasena || contrasena.length < 8) {
        throw new Error(`Defina ${datos.variableContrasena} (mínimo 8 caracteres) en el .env.`);
      }
      if (!esCedulaValida(datos.cedula)) throw new Error(`Cédula inválida: ${datos.cedula}`);

      const rol = await prisma.rol.findUniqueOrThrow({ where: { codigo: datos.rol } });
      const cargo = await prisma.cargo.upsert({
        where: { nombre: datos.cargo },
        update: {},
        create: { nombre: datos.cargo, idDepartamento: departamento.idDepartamento },
      });

      await prisma.usuario.create({
        data: {
          idBase: base.idBase,
          idCargo: cargo.idCargo,
          idRol: rol.idRol,
          cedula: datos.cedula,
          nombres: datos.nombres,
          apellidos: datos.apellidos,
          sexo: datos.sexo,
          fechaNacimiento: new Date(`${datos.fechaNacimiento}T00:00:00Z`),
          correo: datos.correo,
          codigoMedico: datos.codigoMedico,
          nombreUsuario: datos.nombreUsuario,
          contrasenaHash: await contrasenas.hash(contrasena),
        },
      });
      console.warn(`✓ Usuario "${datos.nombreUsuario}" creado (${rol.nombre}).`);
    }

    const medico = await prisma.usuario.findUniqueOrThrow({ where: { nombreUsuario: 'medico' } });
    await sembrarDatosClinicos(prisma, medico.idUsuario);
  } finally {
    await prisma.$disconnect();
  }
}

sembrar().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
