# Sistema de Medicina Ocupacional — FIBERCOM ECUADOR

Monolito modular en TypeScript: API REST en NestJS + aplicación web en React, sobre MariaDB 11.4.

## Requisitos

- Node.js 26 LTS (`nvm use` lee `.nvmrc`)
- pnpm 12
- Docker 29 con Docker Compose
- VS Code con las extensiones recomendadas (`.vscode/extensions.json`)

## 1. Variables de entorno

```bash
cp .env.example .env
```

Si el puerto 3306 ya está ocupado (por ejemplo, por una MariaDB instalada en el sistema),
cambie `DB_PUERTO_HOST=3307` y el puerto de `DATABASE_URL` en `.env`.

## 2. Levantar la base de datos

```bash
pnpm db:up
```

Crea el contenedor `smo-mariadb` (MariaDB 11.4, base `smo_desarrollo`, usuario `smo`) y, la
primera vez, carga `bd/01-estructura.sql` y `bd/02-ampliacion-modelo.sql` (27 tablas).
En una base recién creada, registre en Prisma que esas migraciones ya están aplicadas
(después de `pnpm install`):

```bash
pnpm --filter @smo/api exec prisma migrate resolve --applied 0_init
pnpm --filter @smo/api exec prisma migrate resolve --applied 1_ampliacion_modelo
```

Para empezar desde cero:

```bash
pnpm db:down && docker volume rm smo-mariadb-datos && pnpm db:up
```

## 3. Instalar

```bash
pnpm install
```

## 4. Usuarios de desarrollo

Defina `SEED_ADMIN_PASSWORD` y `SEED_MEDICO_PASSWORD` en `.env` y ejecute:

```bash
pnpm db:seed
```

Crea `admin` (Administrador) y `medico` (Médico ocupacional) con datos ficticios. Si ya existen,
no los modifica. No corre con `NODE_ENV=production`.

## 5. Desarrollo

```bash
pnpm dev
```

- API: http://localhost:3000/api/v1 — salud en `GET /api/v1/salud`
- Swagger: http://localhost:3000/api/docs (solo fuera de producción)
- Web: http://localhost:5173 (el proxy de Vite envía `/api` a la API)
  - `/login` → el administrador va a `/admin`; el médico y el personal de apoyo a `/medico`
  - `/estado`: estado de la API y de la base (público)

Ver la base con Prisma Studio: `pnpm db:studio`.

## 6. Pruebas y calidad

```bash
pnpm test     # Vitest: shared, api (unitarias + integración con la base) y web
pnpm lint     # ESLint
pnpm format   # Prettier
pnpm build    # compila shared, api y web
```

Cada commit pasa por lint-staged (ESLint + Prettier) y commitlint (Conventional Commits:
`feat:`, `fix:`, `chore:`, `docs:`, `test:`…).

## Autenticación y permisos

- `POST /api/v1/auth/login` → `{ accessToken, usuario }`; en la web el access token (JWT, 15 min)
  vive solo en memoria. El refresh token (7 días) viaja en la cookie HttpOnly `smo_renovacion`
  (`Path=/api/v1/auth`, `SameSite=Strict`) y en la base solo se guarda su SHA-256.
- `POST /auth/refresh` rota el refresh token; reutilizar uno ya rotado revoca la sesión.
- `POST /auth/logout` (idempotente) · `GET /auth/perfil`.
- 5 intentos fallidos bloquean la cuenta 15 minutos (`MAX_INTENTOS`, `BLOQUEO_MINUTOS`).
- Toda ruta exige token salvo las marcadas con `@Publico()`. Para exigir permisos:

```ts
@Controller('pacientes')
@RequierePermiso('datos_clinicos') // para todo el controlador
export class PacientesController {
  @Get(':id')
  obtener(@UsuarioActual() usuario: UsuarioPeticion) {
    // usuario: { idUsuario, idSesion, rol, permisos }
  }

  @Post()
  @RequierePermiso('datos_clinicos', 'atenciones') // reemplaza al del controlador: exige ambos
  crear() {}
}
```

En la web, `usePermiso('codigo')` o `<Permitido permiso="codigo">` ocultan lo que el usuario no
puede usar. Auditoría: `AuditoriaService.registrar({ accion, modulo, ... })` toma el usuario, la
sesión y la IP de la petición.

## Estructura

```
apps/
  api/                 NestJS 12 + Prisma 7 (adaptador MariaDB)
    prisma/            schema.prisma (de `prisma db pull`), migraciones y seed.ts
    src/modules/       un módulo por dominio (salud, auth, auditoria)
    src/common/        filtro Problem Details (RFC 9457), pipe Zod, contexto de petición
    src/config/        validación de variables de entorno
    test/              pruebas de integración (Supertest)
  web/                 React 19 + Vite 8 + IBM Carbon (tema FIBERCOM)
    src/layouts/       layouts de administrador y médico
    src/auth/          sesión (ProveedorAuth), rutas protegidas, usePermiso
    src/paginas/       páginas (Login, Estado)
    src/lib/           cliente de la API, TanStack Query, formularios, fechas
packages/
  shared/              esquemas Zod y tipos compartidos (auth, salud, cédula)
bd/                    01-estructura.sql y 02-ampliacion-modelo.sql (estructura oficial)
docker/                MariaDB 11.4 para desarrollo
```

## Base de datos y Prisma

- La estructura oficial es `bd/01-estructura.sql`. El `schema.prisma` se obtiene con
  `pnpm --filter @smo/api prisma:pull`; los nombres PascalCase/camelCase se conservan al reintrospectar.
- Prisma no representa los CHECK, la columna generada `caso.caso_abierto` (solo lectura) ni la
  colación `utf8mb4_uca1400_ai_ci`; por eso `0_init` es solo una migración base marcada como aplicada.
