-- =====================================================================
--  ERP FIBERCOM — Sistema de Medicina Ocupacional
--  03 · Diagnósticos adicionales de una atención (27 → 28 tablas)
--  Motor: MariaDB 11.4 · InnoDB · utf8mb4_uca1400_ai_ci
--
--  Se ejecuta DESPUÉS de 02-ampliacion-modelo.sql. No borra ni modifica datos.
--
--  Agrega:
--    Atención médica ....... atencion_diagnostico
--
--  El diagnóstico PRINCIPAL sigue en atencion.id_cie10 (y es el que abre o
--  continúa el caso). Esta tabla guarda los diagnósticos ADICIONALES
--  (hasta 5), en el orden en que el médico los registró. La API impide
--  repetir el principal entre los adicionales.
-- =====================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;

CREATE TABLE atencion_diagnostico (
  id_atencion     INT UNSIGNED     NOT NULL,
  id_cie10        VARCHAR(10)      NOT NULL,
  orden           TINYINT UNSIGNED NOT NULL,
  creado_en       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_atencion, id_cie10),
  UNIQUE KEY uk_ad_orden (id_atencion, orden),
  KEY ix_ad_cie10 (id_cie10),
  CONSTRAINT ck_ad_orden CHECK (orden BETWEEN 1 AND 5),
  CONSTRAINT fk_ad_atencion FOREIGN KEY (id_atencion)
    REFERENCES atencion (id_atencion) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ad_cie10 FOREIGN KEY (id_cie10)
    REFERENCES cie10 (id_cie10) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci
  COMMENT='Diagnósticos adicionales de una atención (el principal está en atencion.id_cie10)';

-- Fin del script
