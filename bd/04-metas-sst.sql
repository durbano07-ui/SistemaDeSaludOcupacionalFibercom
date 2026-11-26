-- =====================================================================
--  ERP FIBERCOM — Sistema de Medicina Ocupacional
--  04 · Metas SST del informe trimestral (28 → 29 tablas)
--  Motor: MariaDB 11.4 · InnoDB · utf8mb4_uca1400_ai_ci
--
--  Se ejecuta DESPUÉS de 03-diagnosticos-adicionales.sql. No borra ni
--  modifica datos existentes.
--
--  Agrega:
--    Reportes .............. meta_sst (una meta por indicador del informe
--                            trimestral de Seguridad y Salud en el Trabajo)
--
--  "Cumple" se calcula en la API:
--    porcentaje_maximo → % del trimestre <= limite
--    casos_maximo .... → total del trimestre <= limite
--    informativa ..... → no se evalúa (se muestra "—")
-- =====================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;

CREATE TABLE meta_sst (
  id_meta               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  indicador             ENUM('enfermedad_comun','enfermedad_profesional','accidente_trabajo',
                             'incidente_trabajo','total_atenciones') NOT NULL,
  -- Lo que se imprime en la columna "Meta SST" del informe
  texto                 VARCHAR(60)   NOT NULL,
  tipo                  ENUM('porcentaje_maximo','casos_maximo','informativa') NOT NULL,
  limite                DECIMAL(7,2)  NULL DEFAULT NULL,
  id_usuario_actualiza  INT UNSIGNED  NULL DEFAULT NULL,
  creado_en             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_meta),
  UNIQUE KEY uk_meta_indicador (indicador),
  KEY ix_meta_actualiza (id_usuario_actualiza),
  CONSTRAINT ck_meta_limite CHECK (tipo = 'informativa' OR limite IS NOT NULL),
  CONSTRAINT ck_meta_limite_positivo CHECK (limite IS NULL OR limite >= 0),
  CONSTRAINT fk_meta_actualiza FOREIGN KEY (id_usuario_actualiza)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Metas SST del informe trimestral; el médico las edita desde Reportes';

-- Metas iniciales (las del Excel actual del consultorio)
INSERT INTO meta_sst (indicador, texto, tipo, limite) VALUES
  ('enfermedad_comun',       '< 15%',           'porcentaje_maximo', 15),
  ('enfermedad_profesional', '0 casos',         'casos_maximo',       0),
  ('accidente_trabajo',      '0 accidentes',    'casos_maximo',       0),
  ('incidente_trabajo',      'Prevención 100%', 'informativa',     NULL),
  ('total_atenciones',       'Monitoreo',       'informativa',     NULL);

-- Fin del script
