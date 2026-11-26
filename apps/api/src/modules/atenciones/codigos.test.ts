import { describe, expect, it, vi } from 'vitest';

import { formatearCodigo, numeroDeCodigo, siguienteCodigo } from './codigos.js';

describe('códigos correlativos (RN-13)', () => {
  it('formatea con prefijo, año y 4 dígitos', () => {
    expect(formatearCodigo('ATE', 2026, 1)).toBe('ATE-2026-0001');
    expect(formatearCodigo('EVO', 2026, 42)).toBe('EVO-2026-0042');
    expect(formatearCodigo('CER', 2027, 12345)).toBe('CER-2027-12345');
  });

  it('lee el número de un código', () => {
    expect(numeroDeCodigo('ATE-2026-0042')).toBe(42);
    expect(numeroDeCodigo('ATE-2026-10000')).toBe(10000);
    expect(numeroDeCodigo('ATE-26-1')).toBeNull();
  });

  it('el siguiente código suma 1 al último del año (o empieza en 1)', async () => {
    const conUltimo = (ultimo: bigint | null) => ({
      $queryRaw: vi.fn(() => Promise.resolve([{ ultimo }])),
    });

    expect(await siguienteCodigo(conUltimo(41n) as never, 'atencion', 2026)).toBe('ATE-2026-0042');
    expect(await siguienteCodigo(conUltimo(null) as never, 'certificado', 2026)).toBe(
      'CER-2026-0001',
    );
    expect(await siguienteCodigo(conUltimo(9999n) as never, 'evolucion', 2026)).toBe(
      'EVO-2026-10000',
    );
  });

  it('la consulta bloquea las filas del año (FOR UPDATE) de la tabla de la serie', async () => {
    const tx = { $queryRaw: vi.fn(() => Promise.resolve([{ ultimo: 3n }])) };

    await siguienteCodigo(tx as never, 'evolucion', 2026);

    const [plantilla, ...valores] = tx.$queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = plantilla.join('?');
    expect(sql).toMatch(/FOR UPDATE/);
    expect(valores).toContain('EVO-2026-%');
  });
});
