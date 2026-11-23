-- =====================================================================
--  ERP FIBERCOM — Sistema de Medicina Ocupacional
--  Script de instalación de la base de datos (19 tablas)
--  Motor: MariaDB 11.4 (probado también en 10.11) · InnoDB · utf8mb4
--  Colación: utf8mb4_uca1400_ai_ci (sin distinguir tildes ni mayúsculas;
--            reemplaza a utf8mb4_0900_ai_ci, que solo existe en MySQL 8)
--
--  Cómo ejecutarlo en phpMyAdmin:
--    1. Seleccione la base fiberc1_sistema_medicina_ocupacional a la izquierda.
--    2. Pestaña «Importar» → elija este archivo → «Importar».
--  El script borra y vuelve a crear las tablas: úselo solo en una base vacía.
-- =====================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;
SET time_zone = '-05:00';
SET FOREIGN_KEY_CHECKS = 0;

ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;

DROP TABLE IF EXISTS usuario_enfermedad_catastrofica, enfermedad_catastrofica,
  usuario_discapacidad, discapacidad, usuario_grupo_vulnerable, grupo_vulnerable,
  receta_detalle, receta_medica, evolucion_medica, historia_clinica, atencion,
  caso, medicamento, presentacion, cie10, usuario, cargo, departamento, base;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 1. ACCESO Y PERSONAS
-- =====================================================================

CREATE TABLE base (
  id_base         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(80)   NOT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_base),
  UNIQUE KEY uk_base_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Bases (sedes) de FIBERCOM';

CREATE TABLE departamento (
  id_departamento INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(100)  NOT NULL,
  estado          ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_departamento),
  UNIQUE KEY uk_departamento_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Departamentos de la empresa';

CREATE TABLE cargo (
  id_cargo        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_departamento INT UNSIGNED  NOT NULL,
  nombre          VARCHAR(120)  NOT NULL,
  estado          ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cargo),
  UNIQUE KEY uk_cargo_nombre (nombre),
  KEY ix_cargo_departamento (id_departamento),
  CONSTRAINT fk_cargo_departamento FOREIGN KEY (id_departamento)
    REFERENCES departamento (id_departamento) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Cargos, cada uno dentro de un departamento';

CREATE TABLE usuario (
  id_usuario       INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_base          INT UNSIGNED  NOT NULL,
  id_cargo         INT UNSIGNED  NOT NULL,
  cedula           CHAR(10)      NOT NULL,
  nombres          VARCHAR(100)  NOT NULL,
  apellidos        VARCHAR(100)  NOT NULL,
  sexo             ENUM('hombre','mujer') NOT NULL,
  fecha_nacimiento DATE          NOT NULL,
  correo           VARCHAR(150)  NULL DEFAULT NULL,
  nombre_usuario   VARCHAR(50)   NULL DEFAULT NULL,
  contrasena_hash  VARCHAR(255)  NULL DEFAULT NULL,
  codigo_medico    VARCHAR(20)   NULL DEFAULT NULL,
  estado           ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  creado_en        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uk_usuario_cedula (cedula),
  UNIQUE KEY uk_usuario_correo (correo),
  UNIQUE KEY uk_usuario_nombre_usuario (nombre_usuario),
  KEY ix_usuario_base (id_base),
  KEY ix_usuario_cargo (id_cargo),
  KEY ix_usuario_apellidos_nombres (apellidos, nombres),
  CONSTRAINT ck_usuario_cedula CHECK (cedula REGEXP '^[0-9]{10}$'),
  CONSTRAINT ck_usuario_credenciales CHECK (nombre_usuario IS NULL OR contrasena_hash IS NOT NULL),
  CONSTRAINT fk_usuario_base FOREIGN KEY (id_base)
    REFERENCES base (id_base) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_usuario_cargo FOREIGN KEY (id_cargo)
    REFERENCES cargo (id_cargo) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Personas: quienes inician sesión y trabajadores atendidos';

-- =====================================================================
-- 2. CATÁLOGOS
-- =====================================================================

CREATE TABLE cie10 (
  id_cie10        VARCHAR(10)   NOT NULL,
  descripcion     VARCHAR(255)  NOT NULL,
  estado          ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_cie10),
  FULLTEXT KEY ft_cie10_descripcion (descripcion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Diagnósticos CIE-10 (archivo oficial del MSP)';

CREATE TABLE presentacion (
  id_presentacion INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(50)   NOT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_presentacion),
  UNIQUE KEY uk_presentacion_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Formas de los medicamentos';

CREATE TABLE medicamento (
  id_medicamento  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(150)  NOT NULL,
  id_presentacion INT UNSIGNED  NOT NULL,
  concentracion   VARCHAR(50)   NOT NULL,
  estado          ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_medicamento),
  UNIQUE KEY uk_medicamento (nombre, id_presentacion, concentracion),
  KEY ix_medicamento_presentacion (id_presentacion),
  CONSTRAINT fk_medicamento_presentacion FOREIGN KEY (id_presentacion)
    REFERENCES presentacion (id_presentacion) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Medicamentos del botiquín';

-- =====================================================================
-- 3. ATENCIÓN MÉDICA
-- =====================================================================

CREATE TABLE caso (
  id_caso         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario      INT UNSIGNED  NOT NULL,
  id_cie10        VARCHAR(10)   NOT NULL,
  estado          ENUM('abierto','cerrado') NOT NULL DEFAULT 'abierto',
  fecha_apertura  DATE          NOT NULL,
  fecha_cierre    DATE          NULL DEFAULT NULL,
  -- Igual a id_usuario solo mientras el caso está abierto: el índice único
  -- impide dos casos abiertos del mismo paciente (los NULL no chocan).
  caso_abierto    INT UNSIGNED  AS (IF(estado = 'abierto', id_usuario, NULL)) PERSISTENT,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_caso),
  UNIQUE KEY uk_caso_abierto (caso_abierto),
  KEY ix_caso_usuario (id_usuario, estado),
  KEY ix_caso_cie10 (id_cie10),
  CONSTRAINT ck_caso_fechas CHECK (fecha_cierre IS NULL OR fecha_cierre >= fecha_apertura),
  CONSTRAINT ck_caso_cierre CHECK ((estado = 'abierto' AND fecha_cierre IS NULL)
                                OR (estado = 'cerrado' AND fecha_cierre IS NOT NULL)),
  -- ON UPDATE RESTRICT: MariaDB no admite CASCADE en una columna usada por
  -- una columna generada (caso_abierto). Los id no se modifican nunca.
  CONSTRAINT fk_caso_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_caso_cie10 FOREIGN KEY (id_cie10)
    REFERENCES cie10 (id_cie10) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Agrupa las atenciones de un mismo problema de salud';

CREATE TABLE atencion (
  id_atencion         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo              VARCHAR(20)   NOT NULL,
  id_usuario          INT UNSIGNED  NOT NULL,
  id_usuario_registra INT UNSIGNED  NOT NULL,
  id_caso             INT UNSIGNED  NOT NULL,
  id_cie10            VARCHAR(10)   NOT NULL,
  fecha               DATETIME      NOT NULL,
  tipo_atencion       ENUM('primera','subsecuente') NOT NULL,
  tipo_evento         ENUM('enfermedad_comun','enfermedad_profesional',
                           'accidente_trabajo','incidente_trabajo') NOT NULL,
  ocurrio_en_trabajo  TINYINT(1)    NULL DEFAULT NULL,
  observaciones       TEXT          NULL DEFAULT NULL,
  proxima_cita        DATE          NULL DEFAULT NULL,
  creado_en           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_atencion),
  UNIQUE KEY uk_atencion_codigo (codigo),
  KEY ix_atencion_usuario_fecha (id_usuario, fecha),
  KEY ix_atencion_fecha (fecha),
  KEY ix_atencion_registra (id_usuario_registra),
  KEY ix_atencion_caso (id_caso),
  KEY ix_atencion_cie10 (id_cie10),
  CONSTRAINT ck_atencion_ocurrio CHECK (ocurrio_en_trabajo IS NULL OR ocurrio_en_trabajo IN (0, 1)),
  CONSTRAINT ck_atencion_accidente CHECK (tipo_evento <> 'accidente_trabajo' OR ocurrio_en_trabajo = 1),
  CONSTRAINT ck_atencion_proxima_cita CHECK (proxima_cita IS NULL OR proxima_cita > CAST(fecha AS DATE)),
  CONSTRAINT fk_atencion_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_atencion_registra FOREIGN KEY (id_usuario_registra)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_atencion_caso FOREIGN KEY (id_caso)
    REFERENCES caso (id_caso) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_atencion_cie10 FOREIGN KEY (id_cie10)
    REFERENCES cie10 (id_cie10) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Cada atención del consultorio. Fecha no futura: se valida en la API';

CREATE TABLE historia_clinica (
  id_historia              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario               INT UNSIGNED  NOT NULL,
  numero_historia          VARCHAR(20)   NOT NULL,
  fecha_apertura           DATE          NOT NULL,
  antecedentes_personales  TEXT          NULL DEFAULT NULL,
  antecedentes_quirurgicos TEXT          NULL DEFAULT NULL,
  antecedentes_familiares  TEXT          NULL DEFAULT NULL,
  alergias                 TEXT          NULL DEFAULT NULL,
  consumo_tabaco           ENUM('no','ocasional','diario','ex_fumador') NULL DEFAULT NULL,
  consumo_alcohol          ENUM('no','ocasional','semanal','ex_consumidor') NULL DEFAULT NULL,
  otras_sustancias         VARCHAR(255)  NULL DEFAULT NULL,
  actividad_fisica         VARCHAR(255)  NULL DEFAULT NULL,
  medicacion_habitual      TEXT          NULL DEFAULT NULL,
  creado_en                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historia),
  UNIQUE KEY uk_historia_usuario (id_usuario),
  UNIQUE KEY uk_historia_numero (numero_historia),
  CONSTRAINT fk_historia_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Antecedentes del paciente; una historia por usuario';

CREATE TABLE evolucion_medica (
  id_evolucion            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_atencion             INT UNSIGNED      NOT NULL,
  id_usuario_registra     INT UNSIGNED      NOT NULL,
  codigo                  VARCHAR(20)       NOT NULL,
  motivo_consulta         TEXT              NOT NULL,
  enfermedad_actual       TEXT              NOT NULL,
  presion_sistolica       SMALLINT UNSIGNED NULL DEFAULT NULL,
  presion_diastolica      SMALLINT UNSIGNED NULL DEFAULT NULL,
  frecuencia_cardiaca     SMALLINT UNSIGNED NULL DEFAULT NULL,
  frecuencia_respiratoria TINYINT UNSIGNED  NULL DEFAULT NULL,
  saturacion_o2           TINYINT UNSIGNED  NULL DEFAULT NULL,
  temperatura             DECIMAL(4,1)      NULL DEFAULT NULL,
  examen_fisico           TEXT              NULL DEFAULT NULL,
  tratamiento             TEXT              NULL DEFAULT NULL,
  observaciones           TEXT              NULL DEFAULT NULL,
  creado_en               DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_evolucion),
  UNIQUE KEY uk_evolucion_atencion (id_atencion),
  UNIQUE KEY uk_evolucion_codigo (codigo),
  KEY ix_evolucion_registra (id_usuario_registra),
  CONSTRAINT ck_evolucion_presion CHECK (presion_sistolica IS NULL OR presion_diastolica IS NULL
                                         OR presion_sistolica > presion_diastolica),
  CONSTRAINT ck_evolucion_sato2 CHECK (saturacion_o2 IS NULL OR saturacion_o2 BETWEEN 50 AND 100),
  CONSTRAINT ck_evolucion_temperatura CHECK (temperatura IS NULL OR temperatura BETWEEN 30.0 AND 45.0),
  CONSTRAINT fk_evolucion_atencion FOREIGN KEY (id_atencion)
    REFERENCES atencion (id_atencion) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_evolucion_registra FOREIGN KEY (id_usuario_registra)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Detalle clínico y signos vitales de una atención';

CREATE TABLE receta_medica (
  id_receta       INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_atencion     INT UNSIGNED  NOT NULL,
  advertencias    TEXT          NULL DEFAULT NULL,
  signos_alarma   TEXT          NULL DEFAULT NULL,
  recomendaciones TEXT          NULL DEFAULT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_receta),
  UNIQUE KEY uk_receta_atencion (id_atencion),
  CONSTRAINT fk_receta_atencion FOREIGN KEY (id_atencion)
    REFERENCES atencion (id_atencion) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Receta emitida en una atención';

CREATE TABLE receta_detalle (
  id_detalle      INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_receta       INT UNSIGNED      NOT NULL,
  id_medicamento  INT UNSIGNED      NOT NULL,
  cantidad        SMALLINT UNSIGNED NOT NULL,
  dosis           VARCHAR(50)       NOT NULL,
  frecuencia      VARCHAR(50)       NOT NULL,
  duracion        VARCHAR(50)       NOT NULL,
  indicaciones    VARCHAR(255)      NULL DEFAULT NULL,
  PRIMARY KEY (id_detalle),
  UNIQUE KEY uk_receta_medicamento (id_receta, id_medicamento),
  KEY ix_detalle_medicamento (id_medicamento),
  CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_detalle_receta FOREIGN KEY (id_receta)
    REFERENCES receta_medica (id_receta) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_detalle_medicamento FOREIGN KEY (id_medicamento)
    REFERENCES medicamento (id_medicamento) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Medicamentos de la receta';

-- =====================================================================
-- 4. CONDICIONES PRIORITARIAS
-- =====================================================================

CREATE TABLE grupo_vulnerable (
  id_grupo        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(80)   NOT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_grupo),
  UNIQUE KEY uk_grupo_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Catálogo de grupos vulnerables';

CREATE TABLE usuario_grupo_vulnerable (
  id_usuario_grupo INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario       INT UNSIGNED  NOT NULL,
  id_grupo         INT UNSIGNED  NOT NULL,
  fecha_ingreso    DATE          NOT NULL,
  fecha_salida     DATE          NULL DEFAULT NULL,
  observacion      VARCHAR(255)  NULL DEFAULT NULL,
  creado_en        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario_grupo),
  KEY ix_ugv_usuario (id_usuario),
  KEY ix_ugv_grupo (id_grupo),
  CONSTRAINT ck_ugv_fechas CHECK (fecha_salida IS NULL OR fecha_salida > fecha_ingreso),
  CONSTRAINT fk_ugv_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ugv_grupo FOREIGN KEY (id_grupo)
    REFERENCES grupo_vulnerable (id_grupo) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Usuario en un grupo vulnerable, por período';

CREATE TABLE discapacidad (
  id_discapacidad INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(80)   NOT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_discapacidad),
  UNIQUE KEY uk_discapacidad_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Catálogo de tipos de discapacidad';

CREATE TABLE usuario_discapacidad (
  id_usuario_discapacidad INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  id_usuario              INT UNSIGNED     NOT NULL,
  id_discapacidad         INT UNSIGNED     NOT NULL,
  porcentaje              TINYINT UNSIGNED NOT NULL,
  numero_carnet           VARCHAR(30)      NULL DEFAULT NULL,
  fecha_ingreso           DATE             NOT NULL,
  fecha_salida            DATE             NULL DEFAULT NULL,
  observacion             VARCHAR(255)     NULL DEFAULT NULL,
  creado_en               DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario_discapacidad),
  KEY ix_ud_usuario (id_usuario),
  KEY ix_ud_discapacidad (id_discapacidad),
  CONSTRAINT ck_ud_porcentaje CHECK (porcentaje BETWEEN 1 AND 100),
  CONSTRAINT ck_ud_fechas CHECK (fecha_salida IS NULL OR fecha_salida > fecha_ingreso),
  CONSTRAINT fk_ud_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ud_discapacidad FOREIGN KEY (id_discapacidad)
    REFERENCES discapacidad (id_discapacidad) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Discapacidad calificada de un usuario';

CREATE TABLE enfermedad_catastrofica (
  id_enfermedad   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(150)  NOT NULL,
  id_cie10        VARCHAR(10)   NULL DEFAULT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_enfermedad),
  UNIQUE KEY uk_enfermedad_nombre (nombre),
  KEY ix_enfermedad_cie10 (id_cie10),
  CONSTRAINT fk_enfermedad_cie10 FOREIGN KEY (id_cie10)
    REFERENCES cie10 (id_cie10) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Catálogo de enfermedades catastróficas (MSP)';

CREATE TABLE usuario_enfermedad_catastrofica (
  id_usuario_enfermedad INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario            INT UNSIGNED  NOT NULL,
  id_enfermedad         INT UNSIGNED  NOT NULL,
  fecha_ingreso         DATE          NOT NULL,
  fecha_salida          DATE          NULL DEFAULT NULL,
  observacion           VARCHAR(255)  NULL DEFAULT NULL,
  creado_en             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario_enfermedad),
  KEY ix_uec_usuario (id_usuario),
  KEY ix_uec_enfermedad (id_enfermedad),
  CONSTRAINT ck_uec_fechas CHECK (fecha_salida IS NULL OR fecha_salida > fecha_ingreso),
  CONSTRAINT fk_uec_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_uec_enfermedad FOREIGN KEY (id_enfermedad)
    REFERENCES enfermedad_catastrofica (id_enfermedad) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Enfermedad catastrófica de un usuario, por período';

-- =====================================================================
-- 5. DATOS INICIALES DE CATÁLOGOS
-- =====================================================================

INSERT INTO base (nombre) VALUES
  ('Guaranda'), ('San Miguel');

INSERT INTO presentacion (nombre) VALUES
  ('Tableta'), ('Cápsula'), ('Jarabe'), ('Suspensión'), ('Gotas'),
  ('Gel'), ('Crema'), ('Ungüento'), ('Ampolla'), ('Sobre'), ('Inhalador'), ('Óvulo');

INSERT INTO grupo_vulnerable (nombre) VALUES
  ('Embarazo'), ('Lactancia'), ('Adulto mayor');

INSERT INTO discapacidad (nombre) VALUES
  ('Física'), ('Auditiva'), ('Visual'), ('Intelectual'), ('Psicosocial'), ('Lenguaje');

-- El catálogo CIE-10 completo se carga aparte desde el archivo oficial del MSP.
-- El primer administrador lo crea el backend (seed de Prisma), para que la
-- contraseña se guarde cifrada con bcrypt/argon2 y nunca quede en este script.

-- Fin del script
