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
primera vez, carga `bd/01-estructura.sql` (19 tablas). Para empezar desde cero:

```bash
pnpm db:down && docker volume rm smo-mariadb-datos && pnpm db:up
```

Después de crear una base nueva, registre la migración base de Prisma:

```bash
pnpm --filter @smo/api exec prisma migrate resolve --applied 0_init
```

## 3. Instalar

```bash
pnpm install
```

## 4. Desarrollo

```bash
pnpm dev
```

- API: http://localhost:3000/api/v1 — salud en `GET /api/v1/salud`
- Swagger: http://localhost:3000/api/docs (solo fuera de producción)
- Web: http://localhost:5173 (el proxy de Vite envía `/api` a la API)
  - Layout de administrador: `/admin` · Layout de médico: `/medico`

Ver la base con Prisma Studio: `pnpm db:studio`.

## 5. Pruebas y calidad

```bash
pnpm test     # Vitest: shared, api (unitarias + integración con la base) y web
pnpm lint     # ESLint
pnpm format   # Prettier
pnpm build    # compila shared, api y web
```

Cada commit pasa por lint-staged (ESLint + Prettier) y commitlint (Conventional Commits:
`feat:`, `fix:`, `chore:`, `docs:`, `test:`…).

## Estructura

```
apps/
  api/                 NestJS 12 + Prisma 7 (adaptador MariaDB)
    prisma/            schema.prisma (de `prisma db pull`) y migraciones
    src/modules/       un módulo por dominio (por ahora: salud)
    src/common/        filtro Problem Details (RFC 9457), pipe de validación Zod
    src/config/        validación de variables de entorno
    test/              pruebas de integración (Supertest)
  web/                 React 19 + Vite 8 + IBM Carbon (tema FIBERCOM)
    src/layouts/       layouts de administrador y médico
    src/paginas/       páginas
    src/lib/           cliente de la API, TanStack Query, formularios, fechas
packages/
  shared/              esquemas Zod y tipos compartidos (salud, cédula)
bd/01-estructura.sql   estructura oficial de la base (no se modifica)
docker/                MariaDB 11.4 para desarrollo
```

## Base de datos y Prisma

- La estructura oficial es `bd/01-estructura.sql`. El `schema.prisma` se obtiene con
  `pnpm --filter @smo/api prisma:pull`; los nombres PascalCase/camelCase se conservan al reintrospectar.
- Prisma no representa los CHECK, la columna generada `caso.caso_abierto` (solo lectura) ni la
  colación `utf8mb4_uca1400_ai_ci`; por eso `0_init` es solo una migración base marcada como aplicada.
