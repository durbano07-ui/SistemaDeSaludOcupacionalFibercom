/**
 * PRUEBAS DE CAJA BLANCA — ContrasenasService (V(G) = 2 en verificar: try / catch).
 */
import { describe, expect, it } from 'vitest';

import { ContrasenasService } from './contrasenas.service.js';

describe('Caja blanca · ContrasenasService', () => {
  const servicio = new ContrasenasService();

  it('verificar: camino normal (argon2id) acepta la correcta y rechaza la incorrecta', async () => {
    const hash = await servicio.hash('Correcta.2026');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await servicio.verificar(hash, 'Correcta.2026')).toBe(true);
    expect(await servicio.verificar(hash, 'otra')).toBe(false);
  });

  it('verificar: rama catch — un hash con formato inválido devuelve false sin lanzar', async () => {
    expect(await servicio.verificar('no-es-un-hash', 'x')).toBe(false);
  });

  it('verificarFicticio: siempre false y reutiliza el mismo hash ficticio', async () => {
    expect(await servicio.verificarFicticio('cualquiera')).toBe(false);
    expect(await servicio.verificarFicticio('otra')).toBe(false);
  });
});
