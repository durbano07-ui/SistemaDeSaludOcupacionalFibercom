import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/** Parámetros de argon2id (los recomendados por OWASP como mínimo: 19 MiB, t=2, p=1). */
const OPCIONES = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hash y verificación de contraseñas con argon2id. */
@Injectable()
export class ContrasenasService {
  /** Hash con los mismos parámetros, para gastar el mismo tiempo cuando el usuario no existe. */
  private hashFicticio?: Promise<string>;

  hash(contrasena: string): Promise<string> {
    return argon2.hash(contrasena, OPCIONES);
  }

  async verificar(hash: string, contrasena: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, contrasena);
    } catch {
      return false; // hash con formato inválido
    }
  }

  /** Verifica contra un hash ficticio; siempre devuelve false. */
  async verificarFicticio(contrasena: string): Promise<false> {
    this.hashFicticio ??= this.hash(randomBytes(32).toString('base64'));
    await this.verificar(await this.hashFicticio, contrasena);
    return false;
  }
}
