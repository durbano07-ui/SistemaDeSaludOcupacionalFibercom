import { z } from 'zod';

const NIVELES_LOG = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/** Duración tipo `15m`, `1h`, `30s` (formato de jsonwebtoken). */
const duracionSchema = z
  .string()
  .regex(/^\d+[smhd]$/, 'debe ser un número seguido de s, m, h o d (por ejemplo 15m)');

/**
 * Variables de entorno que la API necesita para arrancar. Son obligatorias, salvo los
 * parámetros de sesión (JWT_EXPIRES_IN…BLOQUEO_MINUTOS), que tienen un valor por defecto.
 */
export const entornoSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  TZ: z.string().min(1),
  DATABASE_URL: z
    .url()
    .refine((url) => /^(mysql|mariadb):\/\//.test(url), 'debe empezar con mysql:// o mariadb://'),
  CORS_ORIGIN: z.url(),
  JWT_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: duracionSchema.default('15m'),
  REFRESH_EXPIRES_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  MAX_INTENTOS: z.coerce.number().int().min(1).max(20).default(5),
  BLOQUEO_MINUTOS: z.coerce.number().int().min(1).max(1440).default(15),
  JWT_REFRESH_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  TOTP_ENCRYPTION_KEY: z
    .base64('debe estar en base64')
    .refine((clave) => Buffer.from(clave, 'base64').length === 32, 'debe codificar 32 bytes'),
  LOG_LEVEL: z.enum(NIVELES_LOG),
});

export type Entorno = z.infer<typeof entornoSchema>;

/** Token de inyección del entorno validado. */
export const ENTORNO = Symbol('ENTORNO');

export class EntornoInvalidoError extends Error {
  constructor(readonly problemas: string[]) {
    super(
      `Variables de entorno faltantes o inválidas:\n${problemas.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'EntornoInvalidoError';
  }
}

/** Valida las variables de entorno; si alguna falta o es inválida, lanza un error que dice cuál. */
export function validarEntorno(variables: NodeJS.ProcessEnv): Entorno {
  const resultado = entornoSchema.safeParse(variables);
  if (resultado.success) return resultado.data;

  const problemas = resultado.error.issues.map((issue) => {
    const nombre = issue.path.join('.');
    return variables[nombre] === undefined || variables[nombre] === ''
      ? `${nombre}: falta la variable`
      : `${nombre}: ${issue.message}`;
  });
  throw new EntornoInvalidoError([...new Set(problemas)]);
}
