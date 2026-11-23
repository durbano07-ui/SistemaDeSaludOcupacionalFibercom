import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { respuestaSaludSchema } from '@smo/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import { validarEntorno } from '../src/config/entorno.js';

// Prueba de integración: necesita la MariaDB de desarrollo levantada (pnpm db:up).
describe('GET /api/v1/salud (integración)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const entorno = validarEntorno(process.env);
    const modulo = await Test.createTestingModule({
      imports: [AppModule.registrar(entorno)],
    }).compile();
    app = modulo.createNestApplication({ logger: false });
    configurarApp(app, entorno);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('responde 200 con la API y la base de datos en "ok"', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/salud').expect(200);

    expect(respuestaSaludSchema.parse(respuesta.body)).toMatchObject({
      estado: 'ok',
      baseDatos: 'ok',
    });
  });

  it('incluye las cabeceras de seguridad de helmet', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/salud');

    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
  });

  it('responde las rutas inexistentes con Problem Details (RFC 9457)', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/no-existe')
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/);

    expect(respuesta.body).toEqual({
      type: 'about:blank',
      title: 'Recurso no encontrado',
      status: 404,
      detail: 'No existe la ruta GET /api/v1/no-existe',
      instance: '/api/v1/no-existe',
    });
  });
});
