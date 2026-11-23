-- =====================================================================
--  ERP FIBERCOM — Sistema de Medicina Ocupacional
--  02 · Ampliación del modelo de datos (19 → 27 tablas)
--  Motor: MariaDB 11.4 · InnoDB · utf8mb4_uca1400_ai_ci
--
--  Se ejecuta DESPUÉS de 01-estructura.sql, sobre una base que ya tiene
--  las 19 tablas. No borra ni modifica datos existentes.
--
--  Agrega:
--    Acceso y seguridad .... rol, permiso, rol_permiso, usuario_permiso, sesion
--    Auditoría ............. auditoria (no se puede modificar ni borrar)
--    Atención médica ....... certificado_reposo
--    Fichas y matrices ..... asignacion_ficha
--  Cambia:
--    usuario ......... rol, intentos fallidos, bloqueo, doble autenticación, último acceso
--    medicamento ..... grupo farmacológico (para la alerta de alergias)
--
--  Requisito: el usuario de la base necesita el privilegio TRIGGER
--  (en cPanel: Bases de datos MySQL → usuario → marcar TRIGGER).
-- =====================================================================

-- =====================================================================
-- 1. ROLES Y PERMISOS
-- =====================================================================

CREATE TABLE rol (
  id_rol          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(30)   NOT NULL,
  nombre          VARCHAR(80)   NOT NULL,
  descripcion     VARCHAR(255)  NULL DEFAULT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_rol),
  UNIQUE KEY uk_rol_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Roles fijos del sistema; no se crean desde la interfaz';

CREATE TABLE permiso (
  id_permiso      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo          VARCHAR(40)   NOT NULL,
  nombre          VARCHAR(100)  NOT NULL,
  descripcion     VARCHAR(255)  NULL DEFAULT NULL,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_permiso),
  UNIQUE KEY uk_permiso_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Permisos que se verifican en cada endpoint de la API';

CREATE TABLE rol_permiso (
  id_rol          INT UNSIGNED  NOT NULL,
  id_permiso      INT UNSIGNED  NOT NULL,
  PRIMARY KEY (id_rol, id_permiso),
  KEY ix_rp_permiso (id_permiso),
  CONSTRAINT fk_rp_rol FOREIGN KEY (id_rol)
    REFERENCES rol (id_rol) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_rp_permiso FOREIGN KEY (id_permiso)
    REFERENCES permiso (id_permiso) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Permisos que trae cada rol';

-- ---------------------------------------------------------------------
-- Cambios en usuario: rol, seguridad de la sesión y doble autenticación
-- ---------------------------------------------------------------------
ALTER TABLE usuario
  ADD COLUMN id_rol            INT UNSIGNED     NULL DEFAULT NULL AFTER id_cargo,
  ADD COLUMN intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER contrasena_hash,
  ADD COLUMN bloqueado_hasta   DATETIME         NULL DEFAULT NULL AFTER intentos_fallidos,
  ADD COLUMN totp_secreto      VARCHAR(255)     NULL DEFAULT NULL AFTER bloqueado_hasta,
  ADD COLUMN totp_activo       TINYINT(1)       NOT NULL DEFAULT 0 AFTER totp_secreto,
  ADD COLUMN ultimo_acceso     DATETIME         NULL DEFAULT NULL AFTER codigo_medico,
  ADD KEY ix_usuario_rol (id_rol),
  -- ON UPDATE RESTRICT: MariaDB no admite CASCADE en columnas usadas por un CHECK
  ADD CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol)
    REFERENCES rol (id_rol) ON DELETE RESTRICT ON UPDATE RESTRICT,
  -- Quien inicia sesión tiene rol; un trabajador atendido no tiene ni usuario ni rol
  ADD CONSTRAINT ck_usuario_rol CHECK ((nombre_usuario IS NULL AND id_rol IS NULL)
                                    OR (nombre_usuario IS NOT NULL AND id_rol IS NOT NULL)),
  ADD CONSTRAINT ck_usuario_totp CHECK (totp_activo = 0 OR totp_secreto IS NOT NULL);

CREATE TABLE usuario_permiso (
  id_usuario         INT UNSIGNED  NOT NULL,
  id_permiso         INT UNSIGNED  NOT NULL,
  id_usuario_otorga  INT UNSIGNED  NOT NULL,
  otorgado_en        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario, id_permiso),
  KEY ix_up_permiso (id_permiso),
  KEY ix_up_otorga (id_usuario_otorga),
  CONSTRAINT fk_up_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_up_permiso FOREIGN KEY (id_permiso)
    REFERENCES permiso (id_permiso) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_up_otorga FOREIGN KEY (id_usuario_otorga)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Permisos extra de un usuario, además de los de su rol. Quitar un permiso borra la fila (queda en auditoría)';

-- =====================================================================
-- 2. SESIONES Y AUDITORÍA
-- =====================================================================

CREATE TABLE sesion (
  id_sesion             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario            INT UNSIGNED    NOT NULL,
  inicio                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_actividad      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fin                   DATETIME        NULL DEFAULT NULL,
  motivo_cierre         ENUM('cerrada','expirada','revocada') NULL DEFAULT NULL,
  ip                    VARCHAR(45)     NOT NULL,
  agente_usuario        VARCHAR(255)    NULL DEFAULT NULL,
  -- Huella SHA-256 del token de renovación vigente (rota en cada renovación)
  token_renovacion_hash CHAR(64)        NULL DEFAULT NULL,
  renovacion_expira     DATETIME        NULL DEFAULT NULL,
  PRIMARY KEY (id_sesion),
  UNIQUE KEY uk_sesion_token (token_renovacion_hash),
  KEY ix_sesion_usuario (id_usuario, inicio),
  KEY ix_sesion_inicio (inicio),
  CONSTRAINT ck_sesion_fin CHECK (fin IS NULL OR fin >= inicio),
  CONSTRAINT ck_sesion_cierre CHECK ((fin IS NULL AND motivo_cierre IS NULL)
                                  OR (fin IS NOT NULL AND motivo_cierre IS NOT NULL)),
  CONSTRAINT fk_sesion_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Cada inicio de sesión: alimenta Logs (accesos de hoy, tiempo de sesión) y guarda el token de renovación';

CREATE TABLE auditoria (
  id_auditoria      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  fecha             DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  id_usuario        INT UNSIGNED    NULL DEFAULT NULL,
  id_sesion         BIGINT UNSIGNED NULL DEFAULT NULL,
  usuario_intentado VARCHAR(50)     NULL DEFAULT NULL,
  accion            ENUM('iniciar_sesion','cerrar_sesion','login_fallido','cuenta_bloqueada',
                         'leer','crear','actualizar','desactivar','activar',
                         'otorgar_permiso','quitar_permiso',
                         'imprimir','exportar','importar',
                         'acceso_bd','acceso_bd_fallido') NOT NULL,
  modulo            VARCHAR(40)     NOT NULL,
  entidad           VARCHAR(40)     NULL DEFAULT NULL,
  id_entidad        VARCHAR(20)     NULL DEFAULT NULL,
  -- Paciente al que pertenece el dato clínico, para consultar todo lo hecho sobre un paciente
  id_paciente       INT UNSIGNED    NULL DEFAULT NULL,
  descripcion       VARCHAR(255)    NULL DEFAULT NULL,
  valor_anterior    JSON            NULL DEFAULT NULL,
  valor_nuevo       JSON            NULL DEFAULT NULL,
  ip                VARCHAR(45)     NULL DEFAULT NULL,
  PRIMARY KEY (id_auditoria),
  KEY ix_aud_usuario_fecha (id_usuario, fecha),
  KEY ix_aud_sesion (id_sesion),
  KEY ix_aud_paciente_fecha (id_paciente, fecha),
  KEY ix_aud_entidad (entidad, id_entidad),
  KEY ix_aud_fecha (fecha),
  CONSTRAINT ck_aud_quien CHECK (id_usuario IS NOT NULL OR usuario_intentado IS NOT NULL),
  -- ON UPDATE RESTRICT: id_usuario se usa en el CHECK ck_aud_quien (limitación de MariaDB)
  CONSTRAINT fk_aud_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_aud_sesion FOREIGN KEY (id_sesion)
    REFERENCES sesion (id_sesion) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_aud_paciente FOREIGN KEY (id_paciente)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Registro inmutable de accesos y acciones; solo admite INSERT';

-- La auditoría no se puede modificar ni borrar, ni siquiera desde la aplicación
CREATE TRIGGER trg_auditoria_sin_update BEFORE UPDATE ON auditoria FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La auditoría no se puede modificar';

CREATE TRIGGER trg_auditoria_sin_delete BEFORE DELETE ON auditoria FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La auditoría no se puede borrar';

-- =====================================================================
-- 3. CERTIFICADO DE REPOSO
-- =====================================================================

CREATE TABLE certificado_reposo (
  id_certificado  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_atencion     INT UNSIGNED      NOT NULL,
  codigo          VARCHAR(20)       NOT NULL,
  dias            SMALLINT UNSIGNED NOT NULL,
  fecha_inicio    DATE              NOT NULL,
  fecha_fin       DATE              NOT NULL,
  observacion     VARCHAR(255)      NULL DEFAULT NULL,
  creado_en       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_certificado),
  UNIQUE KEY uk_certificado_atencion (id_atencion),
  UNIQUE KEY uk_certificado_codigo (codigo),
  KEY ix_certificado_fechas (fecha_inicio, fecha_fin),
  CONSTRAINT ck_certificado_dias CHECK (dias BETWEEN 1 AND 365),
  CONSTRAINT ck_certificado_fin CHECK (fecha_fin = fecha_inicio + INTERVAL (dias - 1) DAY),
  CONSTRAINT fk_certificado_atencion FOREIGN KEY (id_atencion)
    REFERENCES atencion (id_atencion) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Certificado de reposo emitido en una atención (CER-2026-0001)';

-- =====================================================================
-- 4. FICHAS Y MATRICES
-- =====================================================================

CREATE TABLE asignacion_ficha (
  id_asignacion     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario        INT UNSIGNED  NOT NULL,
  id_usuario_asigna INT UNSIGNED  NOT NULL,
  formato           ENUM('ficha_ingreso','ficha_periodica','ficha_reintegro','ficha_retiro',
                         'matriz_gsg_r_202','matriz_gsg_r_177') NOT NULL,
  fecha             DATE          NOT NULL,
  condicion         VARCHAR(80)   NULL DEFAULT NULL,
  observacion       VARCHAR(255)  NULL DEFAULT NULL,
  estado            ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  -- Igual a id_usuario solo si es una matriz GSG-R-202 activa: el índice único
  -- impide registrar dos veces al mismo paciente en esa matriz (RN-14)
  matriz_202_activa INT UNSIGNED  AS (IF(formato = 'matriz_gsg_r_202' AND estado = 'activo', id_usuario, NULL)) PERSISTENT,
  creado_en         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_asignacion),
  UNIQUE KEY uk_asignacion_matriz_202 (matriz_202_activa),
  KEY ix_asignacion_usuario_fecha (id_usuario, fecha),
  KEY ix_asignacion_asigna (id_usuario_asigna),
  KEY ix_asignacion_formato (formato, fecha),
  -- Las matrices llevan condición; las fichas no
  CONSTRAINT ck_asignacion_condicion CHECK (
    (formato LIKE 'matriz%' AND condicion IS NOT NULL) OR
    (formato LIKE 'ficha%'  AND condicion IS NULL)),
  -- ON UPDATE RESTRICT: id_usuario se usa en la columna generada (limitación de MariaDB)
  CONSTRAINT fk_asignacion_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_asignacion_asigna FOREIGN KEY (id_usuario_asigna)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Fichas de evaluación ocupacional y matrices asignadas a un paciente; el contenido se arma con sus datos al verla';

-- =====================================================================
-- 5. MEDICAMENTO: GRUPO FARMACOLÓGICO
-- =====================================================================

ALTER TABLE medicamento
  ADD COLUMN grupo_farmacologico VARCHAR(80) NULL DEFAULT NULL AFTER concentracion,
  ADD KEY ix_medicamento_grupo (grupo_farmacologico);

-- =====================================================================
-- 6. DATOS INICIALES
-- =====================================================================

INSERT INTO rol (codigo, nombre, descripcion) VALUES
  ('administrador',      'Administrador',      'Gestiona usuarios, organización, catálogos y supervisa el sistema'),
  ('medico_ocupacional', 'Médico ocupacional', 'Atiende pacientes y lleva sus registros clínicos'),
  ('apoyo',              'Personal de apoyo',  'Sin permisos propios; trabaja solo con los permisos extra que se le otorguen');

INSERT INTO permiso (codigo, nombre, descripcion) VALUES
  ('datos_clinicos',   'Ver datos clínicos',            'Diagnósticos, atenciones, evoluciones, recetas, historia clínica'),
  ('atenciones',       'Registrar atenciones',          'Nueva atención, receta y certificado de reposo'),
  ('historia_clinica', 'Editar historia clínica',       'Registrar y actualizar antecedentes'),
  ('fichas_matrices',  'Gestionar fichas y matrices',   'Asignar fichas de evaluación y matrices GSG-R-202 y GSG-R-177'),
  ('reportes',         'Ver y exportar reportes',       'Consolidados, morbilidad y exportaciones'),
  ('trabajadores',     'Gestionar trabajadores',        'Datos de los trabajadores y condiciones prioritarias'),
  ('nomina',           'Importar nómina',               'Carga de la nómina desde Excel'),
  ('catalogos',        'Gestionar catálogos',           'CIE-10, medicamentos y presentaciones'),
  ('usuarios',         'Gestionar usuarios y permisos', 'Usuarios, roles, permisos, departamentos, cargos y bases'),
  ('supervision',      'Supervisar el sistema',         'Estadísticas, rendimiento y logs'),
  ('base_datos',       'Acceder a la base de datos',    'Requiere doble autenticación');

-- Permisos de cada rol
INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso FROM rol r JOIN permiso p
WHERE (r.codigo = 'administrador'
       AND p.codigo IN ('usuarios','catalogos','nomina','trabajadores','supervision','base_datos'))
   OR (r.codigo = 'medico_ocupacional'
       AND p.codigo IN ('datos_clinicos','atenciones','historia_clinica','fichas_matrices',
                        'reportes','trabajadores','catalogos'));

-- Fin del script
