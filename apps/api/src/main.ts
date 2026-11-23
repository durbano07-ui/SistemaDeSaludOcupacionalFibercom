import 'reflect-metadata';

import { fileURLToPath } from 'node:url';

import { NestFactory } from '@nestjs/core';
import { config as cargarEnv } from 'dotenv';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { configurarApp } from './app.setup.js';
import { EntornoInvalidoError, validarEntorno } from './config/entorno.js';

// En desarrollo se lee el .env de la raíz; en producción las variables vienen del sistema.
cargarEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

async function iniciar(): Promise<void> {
  let entorno;
  try {
    entorno = validarEntorno(process.env);
  } catch (error) {
    if (error instanceof EntornoInvalidoError) {
      console.error(`No se puede iniciar la API. ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const app = await NestFactory.create(AppModule.registrar(entorno), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configurarApp(app, entorno);

  await app.listen(entorno.PORT);
  app.get(Logger).log(`API escuchando en http://localhost:${entorno.PORT}/api/v1`, 'Inicio');
}

void iniciar();
