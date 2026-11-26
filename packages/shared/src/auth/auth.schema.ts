import { z } from 'zod';

/** Códigos de rol (tabla `rol`). Los roles son fijos: no se crean desde la interfaz. */
export const CODIGOS_ROL = ['administrador', 'medico_ocupacional', 'apoyo'] as const;
export const codigoRolSchema = z.enum(CODIGOS_ROL);
export type CodigoRol = z.infer<typeof codigoRolSchema>;

/** Códigos de permiso (tabla `permiso`). Deben coincidir con bd/02-ampliacion-modelo.sql. */
export const CODIGOS_PERMISO = [
  'datos_clinicos',
  'atenciones',
  'historia_clinica',
  'fichas_matrices',
  'reportes',
  'trabajadores',
  'nomina',
  'catalogos',
  'usuarios',
  'supervision',
  'base_datos',
] as const;
export const codigoPermisoSchema = z.enum(CODIGOS_PERMISO);
export type CodigoPermiso = z.infer<typeof codigoPermisoSchema>;

/** Cuerpo de `POST /api/v1/auth/login`. */
export const loginSchema = z.object({
  usuario: z
    .string({ error: 'Ingresa tu usuario' })
    .trim()
    .min(1, { error: 'Ingresa tu usuario', abort: true })
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'El usuario no puede tener más de 50 caracteres'),
  contrasena: z
    .string({ error: 'Ingresa tu contraseña' })
    .min(1, 'Ingresa tu contraseña')
    .max(128, 'La contraseña no puede tener más de 128 caracteres'),
});
export type DatosLogin = z.infer<typeof loginSchema>;

/** Usuario autenticado, con su rol y sus permisos efectivos (rol ∪ permisos extra). */
export const usuarioAutenticadoSchema = z.object({
  id: z.number().int().positive(),
  nombreUsuario: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  rol: z.object({ codigo: codigoRolSchema, nombre: z.string() }),
  permisos: z.array(codigoPermisoSchema),
});
export type UsuarioAutenticado = z.infer<typeof usuarioAutenticadoSchema>;

/** Respuesta de `POST /auth/login` y `POST /auth/refresh`. */
export const respuestaLoginSchema = z.object({
  accessToken: z.string().min(1),
  usuario: usuarioAutenticadoSchema,
});
export type RespuestaLogin = z.infer<typeof respuestaLoginSchema>;

/** Respuesta de `GET /auth/perfil`. */
export const perfilSchema = usuarioAutenticadoSchema;
export type Perfil = z.infer<typeof perfilSchema>;

/** Extensiones de Problem Details que devuelve el login cuando falla. */
export const errorLoginSchema = z.object({
  status: z.number(),
  detail: z.string().optional(),
  /** 401: intentos que quedan antes del bloqueo (solo si la cuenta existe y está activa). */
  intentosRestantes: z.number().int().min(0).optional(),
  /** 423: fecha ISO en que se desbloquea la cuenta. */
  bloqueadoHasta: z.iso.datetime({ offset: true }).optional(),
});
export type ErrorLogin = z.infer<typeof errorLoginSchema>;
