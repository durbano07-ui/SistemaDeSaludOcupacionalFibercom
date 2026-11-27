# Pruebas de caja negra — Sistema de Medicina Ocupacional FIBERCOM

Fecha de ejecución: 27/11/2026 · Herramientas: Vitest 5.1 + Supertest contra la API HTTP real y
MariaDB 11.4 (base `smo_pruebas`) · Archivo: `apps/api/test/caja-negra.integration.test.ts`

## 1. Objetivo

Verificar que el sistema **cumple los requisitos vistos desde fuera**: las historias de usuario,
las reglas de negocio RN-01 a RN-13 y los permisos por rol. Los casos se diseñaron solo a partir de
la especificación, sin mirar el código, y se ejecutan como lo haría un cliente: peticiones HTTP a
la API, con la base de datos real. Complementan las pruebas de caja blanca
([caja-blanca.md](caja-blanca.md)), que verifican la estructura interna.

## 2. Alcance

| Funcionalidad                        | Requisitos de origen                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Inicio de sesión y bloqueo de cuenta | Módulo de autenticación: longitudes, mensaje único, bloqueo al 5.º intento por 15 min |
| Registro de atención                 | HU-32, HU-33, HU-34; RN-01, RN-02, RN-04 a RN-09                                      |
| Búsqueda de pacientes                | HU-08: desde 2 caracteres, cédula/nombres/apellidos, sin tildes, solo activos         |
| Reportes                             | Filtros de año, mes, trimestre y límite; exportación                                  |
| Metas SST                            | Tipo × límite (porcentaje, casos, informativa)                                        |
| Permisos                             | Rol × operación (médico, administrador, apoyo, apoyo con permiso extra, sin sesión)   |

Fuera de alcance: la interfaz web (cubierta por las pruebas de componentes) y la apariencia de los
documentos exportados (verificada manualmente con capturas).

## 3. Técnicas

| Técnica                    | Sigla | Uso                                                                              |
| -------------------------- | ----- | -------------------------------------------------------------------------------- |
| Partición de equivalencia  | PE    | Clases válidas e inválidas de cada entrada; un representante por clase           |
| Análisis de valores límite | VL    | Para cada rango: mínimo − 1, mínimo, máximo, máximo + 1                          |
| Tablas de decisión         | TD    | Reglas que combinan varias condiciones (RN-05, RN-01/02, RN-06, metas, permisos) |
| Transición de estados      | TE    | Estados de la cuenta de usuario                                                  |

## 4. Diseño de casos

### 4.1 Inicio de sesión

**Particiones y límites** (requisito: usuario de 3 a 50 caracteres, contraseña de 1 a 128):

| Caso  | Técnica | Entrada                        | Esperado                        |
| ----- | ------- | ------------------------------ | ------------------------------- |
| CN-01 | VL      | usuario vacío (0)              | 400                             |
| CN-02 | VL      | usuario de 2 (mínimo − 1)      | 400                             |
| CN-03 | VL      | usuario de 3 (mínimo)          | 401 (formato válido, no existe) |
| CN-04 | VL      | usuario de 50 (máximo)         | 401                             |
| CN-05 | VL      | usuario de 51 (máximo + 1)     | 400                             |
| CN-06 | VL      | contraseña vacía               | 400                             |
| CN-07 | VL      | contraseña de 128 (máximo)     | 401                             |
| CN-08 | VL      | contraseña de 129 (máximo + 1) | 400                             |
| CN-11 | PE      | usuario en mayúsculas          | 200                             |

**Tabla de decisión** (requisito: el mismo 401 sin revelar qué falló):

| Caso  | ¿Existe? | ¿Activo? | ¿Contraseña correcta? | ¿Bloqueado? | Esperado                               |
| ----- | -------- | -------- | --------------------- | ----------- | -------------------------------------- |
| CN-09 | No       | —        | —                     | —           | 401 "Usuario o contraseña incorrectos" |
| CN-10 | Sí       | No       | Sí                    | No          | 401 con el **mismo** mensaje           |
| CN-13 | Sí       | Sí       | No                    | No          | 401 con intentos restantes             |
| CN-18 | Sí       | Sí       | Sí                    | Sí          | 423                                    |
| CN-12 | Sí       | Sí       | Sí                    | No          | 200, token y cookie HttpOnly           |

**Transición de estados** de la cuenta:

```
Activa (0 fallos) ─fallo→ 4 restantes ─fallo→ 3 ─fallo→ 2 ─fallo→ 1 ─fallo→ BLOQUEADA (423)
BLOQUEADA ─contraseña correcta→ BLOQUEADA (423)
BLOQUEADA ─pasan 15 min→ Activa ─login correcto→ 200 ─fallo→ 4 restantes (contador reiniciado)
```

Casos CN-13 a CN-19 (una prueba recorre la secuencia completa).

### 4.2 Registro de atención — valores límite

| Caso          | Requisito                        | Entrada                       | Esperado              |
| ------------- | -------------------------------- | ----------------------------- | --------------------- |
| CN-20 a CN-23 | RN-09 SatO2 50–100               | 49 · 50 · 100 · 101           | 400 · 201 · 201 · 400 |
| CN-24 a CN-27 | RN-09 temperatura 30,0–45,0      | 29,9 · 30,0 · 45,0 · 45,1     | 400 · 201 · 201 · 400 |
| CN-28, CN-29  | RN-09 sistólica > diastólica     | 120/120 · 121/120             | 400 · 201             |
| CN-30 a CN-33 | RN-08 reposo 1–365 días          | 0 · 1 · 365 · 366             | 400 · 201 · 201 · 400 |
| CN-34 a CN-37 | RN-07 cantidad > 0               | 0 · 1 · 9999 · 10000          | 400 · 201 · 201 · 400 |
| CN-38, CN-39  | Hasta 5 diagnósticos adicionales | 5 · 6                         | 201 · 400             |
| CN-40, CN-41  | RN-04 fecha no futura            | hace 1 h · dentro de 1 h      | 201 · 400             |
| CN-42, CN-43  | RN-04 próxima cita posterior     | mismo día · día siguiente     | 400 · 201             |
| CN-44 a CN-46 | Motivo obligatorio               | vacío · espacios · 1 carácter | 400 · 400 · 201       |

### 4.3 Registro de atención — tablas de decisión

**RN-05** (¿CIE-10 S/T? × tipo de evento × "¿Ocurrió en el trabajo?"):

| Caso  | CIE-10 S/T | Tipo de evento       | ¿Ocurrió?       | Esperado |
| ----- | ---------- | -------------------- | --------------- | -------- |
| CN-47 | No         | Enfermedad común     | (sin responder) | 201      |
| CN-48 | No         | Enfermedad común     | No              | 201      |
| CN-49 | Sí         | Enfermedad común     | (sin responder) | 400      |
| CN-50 | Sí         | Enfermedad común     | No              | 201      |
| CN-51 | Sí         | Enfermedad común     | Sí              | 201      |
| CN-52 | No         | Accidente de trabajo | Sí              | 201      |
| CN-53 | No         | Accidente de trabajo | No              | 400      |
| CN-54 | Sí         | Accidente de trabajo | (sin responder) | 400      |

**RN-01 / RN-02** (tipo de atención × caso abierto):

| Caso  | Tipo        | ¿Caso abierto? | Esperado                                                |
| ----- | ----------- | -------------- | ------------------------------------------------------- |
| CN-55 | Subsecuente | No             | 409 "El paciente no tiene un caso abierto"              |
| CN-56 | Primera     | No             | 201, abre un caso                                       |
| CN-57 | Subsecuente | Sí             | 201, en el mismo caso                                   |
| CN-58 | Primera     | Sí             | 201, cierra el anterior y abre otro con el nuevo CIE-10 |

**RN-06** (alergias del paciente × medicamento × "Recetar de todos modos"):

| Caso  | Alergias                          | Medicamento                     | ¿Confirmado? | Esperado               |
| ----- | --------------------------------- | ------------------------------- | ------------ | ---------------------- |
| CN-59 | Ninguna                           | Amoxicilina                     | No           | 201                    |
| CN-60 | Penicilina                        | Paracetamol                     | No           | 201                    |
| CN-61 | Penicilina                        | Amoxicilina (grupo Penicilinas) | No           | 422                    |
| CN-62 | Penicilina                        | Amoxicilina                     | Sí           | 201 con la advertencia |
| CN-63 | "PENICILÍNA" (mayúsculas y tilde) | Amoxicilina                     | No           | 422                    |

### 4.4 Búsqueda de pacientes

| Caso          | Técnica | Entrada                                     | Esperado              |
| ------------- | ------- | ------------------------------------------- | --------------------- |
| CN-64 a CN-67 | VL      | texto de 1 · 2 · 100 · 101 caracteres       | 400 · 200 · 200 · 400 |
| CN-68         | PE      | apellido "Ñúñez…" escrito sin tildes ni eñe | lo encuentra          |
| CN-69         | PE      | nombre + apellido en mayúsculas             | lo encuentra          |
| CN-70         | PE      | inicio de la cédula                         | lo encuentra          |
| CN-71         | PE      | paciente inactivo                           | no aparece            |
| CN-72         | PE      | usuario del sistema (no es paciente)        | no aparece            |

### 4.5 Reportes y metas SST

| Caso          | Técnica | Entrada                                         | Esperado                          |
| ------------- | ------- | ----------------------------------------------- | --------------------------------- |
| CN-73 a CN-78 | VL / PE | año 1999 · 2000 · 2100 · 2101 · "abc" · sin año | 400 · 200 · 200 · 400 · 400 · 400 |
| CN-79 a CN-82 | VL      | mes 0 · 1 · 12 · 13                             | 400 · 200 · 200 · 400             |
| CN-83 a CN-86 | VL      | trimestre 0 · 1 · 4 · 5                         | 400 · 200 · 200 · 400             |
| CN-87 a CN-90 | VL      | límite de morbilidad 0 · 1 · 100 · 101          | 400 · 200 · 200 · 400             |
| CN-91         | TD      | mes y trimestre a la vez                        | 400                               |
| CN-92         | PE      | exportar con una base inexistente               | 400                               |

Metas SST (tipo × límite):

| Caso   | Tipo              | Límite / texto         | Esperado                   |
| ------ | ----------------- | ---------------------- | -------------------------- |
| CN-93  | Porcentaje máximo | sin límite             | 400                        |
| CN-94  | Porcentaje máximo | 100 (máximo)           | 200                        |
| CN-95  | Porcentaje máximo | 100,01                 | 400                        |
| CN-96  | Casos máximos     | 120                    | 200                        |
| CN-97  | Casos máximos     | −1                     | 400                        |
| CN-98  | Informativa       | texto vacío            | 400                        |
| CN-99  | Informativa       | texto de 61 caracteres | 400                        |
| CN-100 | Informativa       | con límite 50          | 200, el límite se descarta |
| CN-101 | —                 | indicador inexistente  | 400                        |

### 4.6 Permisos — tabla de decisión rol × operación

"Pasa" = la autorización lo deja entrar (respuesta 2xx, o 400 porque se envía un cuerpo inválido a
propósito para no crear datos).

| Caso   | Rol                              | Buscar pacientes | Registrar atención | Buscar CIE-10 | Ver reportes | Editar metas | Estadísticas admin |
| ------ | -------------------------------- | ---------------- | ------------------ | ------------- | ------------ | ------------ | ------------------ |
| CN-102 | Médico ocupacional               | Pasa             | Pasa               | Pasa          | Pasa         | Pasa         | 403                |
| CN-103 | Administrador                    | 403              | 403                | 403           | 403          | 403          | Pasa               |
| CN-104 | Apoyo sin permisos               | 403              | 403                | 403           | 403          | 403          | 403                |
| CN-105 | Apoyo + permiso extra "reportes" | 403              | 403                | 403           | Pasa         | Pasa         | 403                |
| CN-106 | Sin sesión                       | 401              | 401                | 401           | 401          | 401          | 401                |

## 5. Resultados

| Grupo                             | Casos (ID) | Pruebas | Resultado               |
| --------------------------------- | ---------: | ------: | ----------------------- |
| Inicio de sesión (PE, VL, TD, TE) |         19 |      13 | 13 pasan                |
| Atención — valores límite         |         27 |      25 | 25 pasan                |
| Atención — tablas de decisión     |         17 |      14 | 14 pasan                |
| Búsqueda de pacientes             |          9 |       9 | 9 pasan                 |
| Reportes — filtros                |         20 |      20 | 20 pasan                |
| Metas SST                         |          9 |       9 | 9 pasan                 |
| Permisos (30 combinaciones)       |          5 |       5 | 5 pasan                 |
| **Total**                         |    **106** |  **95** | **95 pasan · 0 fallan** |

Algunas pruebas agrupan varios casos que forman una secuencia (por ejemplo, CN-13 a CN-19 de la
transición de estados), por eso hay más identificadores que pruebas.

Las 95 pruebas pasaron también junto con las demás suites de integración (129 de 129 en la carpeta
`test/`).

## 6. Hallazgos

1. **El sistema cumple todos los requisitos probados.** Los 106 casos dieron el resultado esperado
   por la especificación; no se encontraron defectos funcionales.
2. **Error de tipos en la propia suite** (el método HTTP de la tabla de permisos quedó tipado como
   texto). Lo detectó el nuevo paso "Tipos" de la CI; corregido antes de subir.
3. **Hallazgo abierto: bloqueo intermitente del proceso de pruebas.** En una corrida conjunta, la
   prueba de rollback de `atenciones.integration.test.ts` tardó 400 s y falló. Es la tercera vez que
   se observa (antes: RN-01 en la CI con 180 s y la preparación de reportes con más de 60 s). Datos:
   - Siempre ocurrió en la **primera llamada a `registrarAtencion`** de una suite.
   - Vitest informa "Test timed out in 5000ms", pero recién después de 180 a 400 s: el temporizador
     de 5 s no pudo dispararse a tiempo, por lo que el **proceso de Node estuvo bloqueado o
     detenido**, no esperando a la base. Con el monitor de MariaDB activo no se registró ninguna
     espera de bloqueo ni transacción larga.
   - No se reprodujo en 4 corridas vigiladas posteriores (129/129 y 241/241).

   **Recomendación:** investigarlo aparte antes de producción, porque si ocurre en la API real
   bloquearía todas las peticiones mientras dura. Próximo paso: correr la suite en bucle con
   `node --cpu-prof` o con el diagnóstico de Vitest para capturar qué ocupa el proceso en ese momento.

## 7. Cómo ejecutar

```bash
pnpm db:pruebas   # solo si smo_pruebas no existe
pnpm --filter @smo/api exec vitest run test/caja-negra.integration.test.ts
```
