# Pruebas de caja blanca — Sistema de Medicina Ocupacional FIBERCOM

Fecha de ejecución: 27/11/2026 · Herramientas: Vitest 5.1 + `@vitest/coverage-v8` 5.1

## 1. Objetivo

Verificar la **estructura interna** de las unidades críticas del sistema: que cada sentencia, cada
rama de decisión y cada camino independiente se ejecute al menos una vez y produzca el resultado
correcto. Complementa las pruebas funcionales (unitarias, de integración y de componentes), que
verifican el comportamiento desde fuera.

## 2. Alcance

Se eligieron las unidades donde un error tiene más impacto: reglas clínicas, seguridad y cálculos
de los reportes oficiales.

| Área                    | Unidades                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atenciones médicas      | `registrarAtencion`, `esChoqueReintentable` (`registro-atencion.ts`), códigos correlativos                                                                                        |
| Seguridad               | `AuthService` (renovar, cerrar sesión, verificar token, usuario de la sesión, perfil, login), `JwtAuthGuard`, `PermisosGuard`, `tokenBearer`, `ContrasenasService`, `permisos.ts` |
| Reportes y estadísticas | `ReportesService`, `RegistroRendimiento`, hora de Ecuador                                                                                                                         |
| Reglas compartidas      | `alertasSignosVitales`, `coincidenciasAlergia`, `nuevaAtencionSchema`, `esCedulaValida`, fechas, cálculos y filtros de reportes                                                   |

**Fuera de alcance** (y por qué):

- Controladores, módulos y decoradores de NestJS: son cableado sin lógica propia; los ejercitan las
  34 pruebas de integración contra MariaDB.
- Esquemas Zod de respuesta (`respuestas.schema.ts`, `paciente.schema.ts`, `estadisticas.schema.ts`):
  solo declaran la forma del JSON; no tienen decisiones.
- Componentes de la interfaz: cubiertos por las 43 pruebas de componentes.

## 3. Técnicas

1. **Prueba del camino básico (McCabe).** Para cada unidad se construyó el grafo de flujo, se
   contaron los nodos de decisión (`if`, `?:`, `switch`, `catch`, condición de bucle) y se calculó
   la complejidad ciclomática **V(G) = decisiones + 1**. Cada camino independiente tiene al menos un
   caso de prueba.
2. **Cobertura de condiciones.** En las decisiones compuestas (`a && b`, `a || b`) se prueba cada
   condición simple por separado (por ejemplo, "paciente inexistente" y "es usuario del sistema"
   son dos casos de la misma decisión).
3. **Prueba de bucles.** El bucle de reintentos de `registrarAtencion` se prueba con 0 reintentos,
   1 reintento y el máximo (3) agotado.
4. **Valores límite** dentro de las decisiones: TA 140/90, SatO2 93/94, T 38,0, provincia 01/24/30,
   tercer dígito 5/6, porcentaje 100, 2000 muestras por minuto.
5. **Medición de cobertura** de sentencias y ramas con V8, antes y después.

Las dependencias externas se reemplazan por **dobles de prueba** (Prisma falso, repositorio SQL
falso, `Reflector` falso, reloj simulado), de modo que cada decisión se pueda forzar sin base de datos.

## 4. Criterios de aceptación

| Criterio                                         | Meta                                | Resultado                                                     |
| ------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------- |
| Cobertura de sentencias de las unidades del plan | 100 %                               | **100 %** (609/609)                                           |
| Cobertura de ramas                               | ≥ 95 % y las faltantes justificadas | **98,9 %** (466/471); las 5 restantes no son alcanzables (§7) |
| Caminos básicos                                  | Un caso por camino independiente    | Cumplido en todas las unidades (§5)                           |
| Pruebas                                          | Todas pasan                         | **98/98** de caja blanca; 189/189 unitarias en total          |

## 5. Unidades, complejidad y caminos

| Unidad                                       | Archivo                                                |                Decisiones |   V(G) |             Casos |
| -------------------------------------------- | ------------------------------------------------------ | ------------------------: | -----: | ----------------: |
| `registrarAtencion`                          | `apps/api/src/modules/atenciones/registro-atencion.ts` |                        21 | **22** |                22 |
| `esChoqueReintentable`                       | ídem                                                   |                         3 |      4 |                 3 |
| `AuthService.renovar`                        | `apps/api/src/modules/auth/auth.service.ts`            |                         6 |      7 |                 9 |
| `AuthService.cerrarSesion`                   | ídem                                                   |                         5 |      6 |                 5 |
| `AuthService.verificarAccessToken`           | ídem                                                   |                         2 |      3 |                 3 |
| `AuthService.usuarioDeSesion`                | ídem                                                   | 2 (una con 6 condiciones) |      3 |                 8 |
| `AuthService.perfil`                         | ídem                                                   |                         1 |      2 |                 2 |
| `JwtAuthGuard.canActivate`                   | `…/auth/guards/jwt-auth.guard.ts`                      |                         5 |      6 |                 6 |
| `PermisosGuard.canActivate`                  | `…/auth/guards/permisos.guard.ts`                      |                         2 |      3 |                 4 |
| `tokenBearer`                                | `…/auth/guards/jwt-auth.guard.ts`                      |         1 (3 condiciones) |      2 |                 2 |
| `ContrasenasService.verificar`               | `…/auth/contrasenas.service.ts`                        |           1 (`try/catch`) |      2 |                 3 |
| `ReportesService.valorIndicador`             | `apps/api/src/modules/reportes/reportes.service.ts`    |             `switch` de 5 |      5 |                 2 |
| `ReportesService.registroMensual`            | ídem                                                   |                         4 |      5 |                 2 |
| `ReportesService.informeTrimestral`          | ídem                                                   |                         3 |      4 |                 2 |
| `ReportesService.morbilidad`                 | ídem                                                   |                         3 |      4 |                 4 |
| `RegistroRendimiento.registrar` / `resumen`  | `…/estadisticas/registro-rendimiento.ts`               |                     3 / 3 |  4 / 4 |  2 + 3 existentes |
| `alertasSignosVitales`                       | `packages/shared/src/atenciones/reglas.ts`             |                         8 |      9 |  3 + 3 existentes |
| `fechaHoraSchema` (en `nuevaAtencionSchema`) | `…/atenciones/atencion.schema.ts`                      |                         3 |      4 |                 3 |
| `esCedulaValida`                             | `packages/shared/src/validadores/cedula.ts`            |                         4 |      5 | 3 + 19 existentes |

Un mismo caso puede recorrer varios caminos de unidades pequeñas; por eso "Casos" puede ser menor
que V(G) cuando la tabla de verdad se cubre en una sola prueba (por ejemplo, el `switch` de
`valorIndicador`: un trimestre con datos en los 5 indicadores recorre los 5 casos).

### 5.1 Detalle: `registrarAtencion` (V(G) = 22)

Nodos de decisión del grafo de flujo:

| Nodo | Línea | Decisión                                         | Casos que la hacen verdadera / falsa |
| ---- | ----: | ------------------------------------------------ | ------------------------------------ |
| D1   |    77 | `!paciente \|\| paciente.nombreUsuario !== null` | C1, C2 / resto                       |
| D2   |    80 | paciente inactivo                                | C3 / resto                           |
| D3   |    86 | `!cie10 \|\| cie10.estado !== 'activo'`          | C4, C5 / resto                       |
| D4   |    91 | hay diagnósticos adicionales                     | C6, C15 / C10                        |
| D5   |    95 | algún adicional no existe                        | C6 / C15                             |
| D6   |   102 | `proximaCita && proximaCita <= día UTC`          | C7 / C19                             |
| D7   |   109 | la receta tiene medicamentos                     | C8, C16 / C17                        |
| D8   |   115 | algún medicamento no existe                      | C8 / C16                             |
| D9   |   122 | alergia `&&` sin "Recetar de todos modos"        | C9 / C16                             |
| D10  |   137 | bucle de reintentos (`for (;;)`)                 | C20–C22                              |
| D11  |   148 | hay caso abierto (fila)                          | C11 / C10                            |
| D12  |   151 | `abierto && día < apertura`                      | C12 / C11                            |
| D13  |   159 | atención primera                                 | C10, C11 / C13, C14                  |
| D14  |   161 | primera con caso abierto (RN-01)                 | C11 / C10                            |
| D15  |   179 | subsecuente sin caso abierto (RN-02)             | C13 / C14                            |
| D16  |   196 | hay próxima cita                                 | C19 / C10                            |
| D17  |   200 | guardar adicionales                              | C15 / C10                            |
| D18  |   230 | hay receta                                       | C16, C17 / C10                       |
| D19  |   237 | `coincidencias && alergias` (advertencia)        | C16 / C17                            |
| D20  |   243 | la receta tiene detalle                          | C16 / C17                            |
| D21  |   259 | hay certificado                                  | C18 / C10                            |
| D22  |   289 | `intento < MAX && esChoqueReintentable`          | C20 / C21, C22                       |

Caminos básicos (archivo `registro-atencion.caja-blanca.test.ts`):

| Camino  | Escenario                                                     | Resultado esperado                                         |
| ------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| C1      | Paciente inexistente                                          | 404                                                        |
| C2      | El id es de un usuario del sistema, no de un paciente         | 404                                                        |
| C3      | Paciente inactivo                                             | 409                                                        |
| C4 / C5 | CIE-10 inexistente / inactivo                                 | 400                                                        |
| C6      | Un diagnóstico adicional no existe                            | 400                                                        |
| C7      | Atención a las 20:00 con cita al día siguiente (CHECK en UTC) | 400, sin abrir transacción                                 |
| C8      | Medicamento de la receta inexistente                          | 400                                                        |
| C9      | Alergia sin confirmar                                         | 422 con las coincidencias, sin transacción                 |
| C10     | Camino mínimo: primera sin caso, sin receta, sin certificado  | Guarda; `idCasoCerrado` null                               |
| C11     | Primera con caso abierto                                      | Cierra el caso (RN-01) y abre otro                         |
| C12     | Fecha anterior a la apertura del caso abierto                 | 409, no inserta                                            |
| C13     | Subsecuente sin caso abierto                                  | 409 (RN-02)                                                |
| C14     | Subsecuente con caso abierto                                  | Se suma al caso, no crea ni cierra                         |
| C15     | Con diagnósticos adicionales                                  | Se guardan con su orden                                    |
| C16     | Receta con medicamentos y alergia confirmada                  | Advertencia guardada y detalle                             |
| C17     | Receta solo con recomendación                                 | Sin detalle ni advertencia; no consulta medicamentos       |
| C18     | Con certificado                                               | Código CER y fecha de fin (RN-08)                          |
| C19     | Con próxima cita válida y signos vitales                      | Guarda la cita; alerta de fiebre                           |
| C20     | Choque P2002 en el primer intento                             | Reintenta y guarda (2 transacciones)                       |
| C21     | Error no reintentable                                         | Se propaga sin reintentar (1 transacción)                  |
| C22     | Choques en todos los intentos                                 | Lanza el choque tras 4 transacciones (máximo 3 reintentos) |

### 5.2 Seguridad (archivos `auth.service.caja-blanca.test.ts` y `guards.caja-blanca.test.ts`)

| Unidad                 | Caminos probados                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renovar`              | R1 cookie ausente o mal formada · R2 sesión inexistente · R3 sesión cerrada · R4 token ya rotado (revoca y audita) · R4b reutilización sobre sesión ya cerrada (no audita dos veces) · R5 sin vencimiento / vencida (expirada) · R6 usuario inactivo / sin rol (revocada) · R7 rotación simultánea (count 0) · R8 rotación correcta |
| `cerrarSesion`         | S1 sin cookie ni token · S2 cookie válida · S3 cookie obsoleta con access token · S4 solo token inválido · S5 sesión ya cerrada                                                                                                                                                                                                     |
| `verificarAccessToken` | V1 válido · V2 `sub`/`sid` no numéricos · V3 firma ajena o texto basura (rama `catch`)                                                                                                                                                                                                                                              |
| `usuarioDeSesion`      | Una prueba por cada una de las 7 condiciones que invalidan la sesión + sesión válida                                                                                                                                                                                                                                                |
| `perfil`               | P1 sin usuario o sin rol · P2 perfil completo                                                                                                                                                                                                                                                                                       |
| `JwtAuthGuard`         | J1 ruta pública · J2 sin token · J3 token inválido · J4 sesión cerrada · J5 fuera de una petición · J6 dentro de una petición (completa el contexto de auditoría)                                                                                                                                                                   |
| `PermisosGuard`        | G1 sin permisos exigidos · G2 con todos los permisos · G3 falta uno (403 con faltantes) · G4 sin usuario                                                                                                                                                                                                                            |

### 5.3 Reportes (archivo `reportes.service.caja-blanca.test.ts`)

T1 trimestre con los 5 indicadores y meta ausente · T2 los 4 trimestres con meses vacíos · M1 un mes
con observación vacía y sin receta · M2 año completo, 31-dic 22:00 de Ecuador en diciembre, tipo de
evento desconocido y varios medicamentos · O período por mes, trimestre y año (rango UTC) · O
tratamiento con los 2 más recetados y "Sin receta" · consolidado y gestión · delegación de opciones.

## 6. Resultados

### 6.1 Cobertura antes y después (solo pruebas unitarias, sin base de datos)

| Archivo                                                          | Sentencias antes | Ramas antes |  Sentencias después |        Ramas después |
| ---------------------------------------------------------------- | ---------------: | ----------: | ------------------: | -------------------: |
| `registro-atencion.ts`                                           |              0 % |         0 % |           **100 %** |            **100 %** |
| `auth.service.ts`                                                |           44,6 % |      30,7 % |           **100 %** |            **100 %** |
| `jwt-auth.guard.ts`                                              |              0 % |         0 % |           **100 %** |             94,4 % ¹ |
| `permisos.guard.ts`                                              |              0 % |         0 % |           **100 %** |             83,3 % ¹ |
| `permisos.ts`                                                    |            100 % |        60 % |               100 % |            **100 %** |
| `token-renovacion.ts`                                            |           45,5 % |         0 % |           **100 %** |            **100 %** |
| `contrasenas.service.ts`                                         |             90 % |       100 % |           **100 %** |            **100 %** |
| `reportes.service.ts`                                            |              0 % |         0 % |           **100 %** |             97,4 % ¹ |
| `registro-rendimiento.ts`                                        |           94,5 % |      81,8 % |           **100 %** |            **100 %** |
| `atencion.schema.ts`                                             |           95,3 % |      90,9 % |           **100 %** |            **100 %** |
| `reglas.ts`                                                      |            100 % |      96,8 % |               100 % |            **100 %** |
| `fechas.ts`                                                      |            100 % |      91,7 % |               100 % |            **100 %** |
| `reportes.schema.ts`                                             |           97,2 % |      92,9 % |           **100 %** |            **100 %** |
| `cedula.ts`                                                      |            100 % |      86,7 % |               100 % |             86,7 % ² |
| `codigos.ts`, `hora-ecuador.ts`, `calculos.ts`, `auth.schema.ts` |            100 % |       100 % |               100 % |                100 % |
| **Total del plan**                                               |                  |             | **100 %** (609/609) | **98,9 %** (466/471) |

¹ Rama generada por el compilador (ver §7). ² Código defensivo no alcanzable (ver §7).

### 6.2 Pruebas

| Archivo                                                                                  | Pruebas de caja blanca |
| ---------------------------------------------------------------------------------------- | ---------------------: |
| `apps/api/src/modules/atenciones/registro-atencion.caja-blanca.test.ts`                  |                     25 |
| `apps/api/src/modules/auth/auth.service.caja-blanca.test.ts`                             |                     27 |
| `apps/api/src/modules/auth/guards/guards.caja-blanca.test.ts`                            |                     15 |
| `apps/api/src/modules/auth/contrasenas.caja-blanca.test.ts`                              |                      3 |
| `apps/api/src/modules/reportes/reportes.service.caja-blanca.test.ts`                     |                     10 |
| `apps/api/src/modules/estadisticas/registro-rendimiento.test.ts` (sección "Caja blanca") |                      2 |
| `packages/shared/src/caja-blanca.test.ts`                                                |                     16 |
| **Total**                                                                                |   **98 — todas pasan** |

Con ellas, las pruebas unitarias del sistema pasan de 91 a 189 (77 en `shared`, 112 en la API).

## 7. Ramas no cubiertas (justificación)

| Ubicación                                                                                  | Ramas | Motivo                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cedula.ts:18` y `:21` (`digitos[2] ?? 9`, `digitos[i] ?? 0`)                              |     2 | **Inalcanzables.** La expresión regular de la línea 13 ya garantiza 10 dígitos, por lo que esos respaldos nunca se usan. Existen para satisfacer `noUncheckedIndexedAccess` de TypeScript. |
| `jwt-auth.guard.ts:24`, `permisos.guard.ts:17`, `reportes.service.ts:79` (`@Injectable()`) |     3 | **No existen en el código fuente.** Las genera el compilador al emitir los metadatos de los decoradores (`typeof X === "undefined" ? Object : X`).                                         |

## 8. Hallazgos

1. **El núcleo transaccional y el control de acceso no tenían pruebas unitarias.**
   `registrarAtencion`, `JwtAuthGuard` y `PermisosGuard` tenían 0 % de cobertura unitaria; solo los
   ejercitaban las pruebas de integración, que no pueden forzar casos como un choque de índice en
   el segundo intento, una rotación simultánea del token o una reutilización sobre una sesión ya
   cerrada. Ahora cada uno de esos caminos tiene su prueba.
2. **Error de tipos en una prueba de integración.** `reportes.integration.test.ts` pasaba a ExcelJS
   un `Buffer` de Node 26 incompatible con el tipo que declara ExcelJS. Vitest no revisa tipos y la
   CI solo compila `src/`, por eso no se detectó. Corregido (commit `1fa0b4d`).
   **Recomendación:** agregar `pnpm -r typecheck` a la CI para revisar también los archivos de prueba.
3. **No se encontraron defectos en el código de producción.** Todos los caminos devolvieron el
   resultado esperado por las reglas de negocio (RN-01 a RN-13) y de seguridad.
4. **Código defensivo inalcanzable** en `esCedulaValida` (§7). No es un defecto; se documenta.

## 9. Cómo ejecutar

```bash
pnpm --filter @smo/shared test:cobertura   # reglas compartidas, con cobertura
pnpm --filter @smo/api test:cobertura      # unitarias de la API (sin base de datos), con cobertura
```

El informe HTML queda en `packages/shared/coverage/index.html` y `apps/api/coverage/index.html`
(la carpeta `coverage/` no se sube al repositorio).
