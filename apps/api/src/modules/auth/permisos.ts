import {
  type CodigoPermiso,
  codigoPermisoSchema,
  type CodigoRol,
  codigoRolSchema,
  type UsuarioAutenticado,
} from '@smo/shared';

import type { Prisma } from '../../generated/prisma/client.js';

/** Campos del usuario necesarios para saber quién es, su rol y sus permisos efectivos. */
export const SELECCION_USUARIO_AUTENTICADO = {
  idUsuario: true,
  nombreUsuario: true,
  nombres: true,
  apellidos: true,
  estado: true,
  rol: {
    select: {
      codigo: true,
      nombre: true,
      permisos: { select: { permiso: { select: { codigo: true } } } },
    },
  },
  permisosExtra: { select: { permiso: { select: { codigo: true } } } },
} satisfies Prisma.UsuarioSelect;

export type UsuarioConPermisos = Prisma.UsuarioGetPayload<{
  select: typeof SELECCION_USUARIO_AUTENTICADO;
}>;

/** Permisos efectivos = permisos del rol ∪ permisos extra, sin repetir y en orden alfabético. */
export function calcularPermisosEfectivos(
  delRol: readonly string[],
  extra: readonly string[],
): CodigoPermiso[] {
  const codigos = new Set<CodigoPermiso>();
  for (const codigo of [...delRol, ...extra]) {
    const resultado = codigoPermisoSchema.safeParse(codigo);
    if (resultado.success) codigos.add(resultado.data);
  }
  return [...codigos].sort();
}

/** Rol del usuario si es uno de los roles del sistema; `null` si no tiene rol válido. */
export function rolDe(usuario: Pick<UsuarioConPermisos, 'rol'>): CodigoRol | null {
  const resultado = codigoRolSchema.safeParse(usuario.rol?.codigo);
  return resultado.success ? resultado.data : null;
}

export function permisosDe(usuario: Pick<UsuarioConPermisos, 'rol' | 'permisosExtra'>) {
  return calcularPermisosEfectivos(
    usuario.rol?.permisos.map((rp) => rp.permiso.codigo) ?? [],
    usuario.permisosExtra.map((up) => up.permiso.codigo),
  );
}

/** Convierte el usuario de la base en la forma pública `UsuarioAutenticado`. */
export function aUsuarioAutenticado(
  usuario: UsuarioConPermisos,
  rol: CodigoRol,
): UsuarioAutenticado {
  return {
    id: usuario.idUsuario,
    nombreUsuario: usuario.nombreUsuario ?? '',
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    rol: { codigo: rol, nombre: usuario.rol?.nombre ?? rol },
    permisos: permisosDe(usuario),
  };
}
