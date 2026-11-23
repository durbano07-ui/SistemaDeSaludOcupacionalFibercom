-- =====================================================================
--  Migración base (baseline) generada con:
--    prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
--  Está marcada como aplicada (prisma migrate resolve --applied 0_init).
--
--  IMPORTANTE: la estructura oficial de la base es bd/01-estructura.sql.
--  Prisma no representa los CHECK, la columna generada caso.caso_abierto,
--  los ON UPDATE CURRENT_TIMESTAMP, los comentarios ni la colación
--  utf8mb4_uca1400_ai_ci. No use este archivo para crear una base nueva:
--  cargue bd/01-estructura.sql y luego ejecute el resolve.
-- =====================================================================
-- CreateTable
CREATE TABLE `atencion` (
    `id_atencion` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(20) NOT NULL,
    `id_usuario` INTEGER UNSIGNED NOT NULL,
    `id_usuario_registra` INTEGER UNSIGNED NOT NULL,
    `id_caso` INTEGER UNSIGNED NOT NULL,
    `id_cie10` VARCHAR(10) NOT NULL,
    `fecha` DATETIME(0) NOT NULL,
    `tipo_atencion` ENUM('primera', 'subsecuente') NOT NULL,
    `tipo_evento` ENUM('enfermedad_comun', 'enfermedad_profesional', 'accidente_trabajo', 'incidente_trabajo') NOT NULL,
    `ocurrio_en_trabajo` BOOLEAN NULL,
    `observaciones` TEXT NULL,
    `proxima_cita` DATE NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_atencion_codigo`(`codigo`),
    INDEX `ix_atencion_caso`(`id_caso`),
    INDEX `ix_atencion_cie10`(`id_cie10`),
    INDEX `ix_atencion_fecha`(`fecha`),
    INDEX `ix_atencion_registra`(`id_usuario_registra`),
    INDEX `ix_atencion_usuario_fecha`(`id_usuario`, `fecha`),
    PRIMARY KEY (`id_atencion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `base` (
    `id_base` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_base_nombre`(`nombre`),
    PRIMARY KEY (`id_base`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cargo` (
    `id_cargo` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_departamento` INTEGER UNSIGNED NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_cargo_nombre`(`nombre`),
    INDEX `ix_cargo_departamento`(`id_departamento`),
    PRIMARY KEY (`id_cargo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `caso` (
    `id_caso` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER UNSIGNED NOT NULL,
    `id_cie10` VARCHAR(10) NOT NULL,
    `estado` ENUM('abierto', 'cerrado') NOT NULL DEFAULT 'abierto',
    `fecha_apertura` DATE NOT NULL,
    `fecha_cierre` DATE NULL,
    `caso_abierto` INTEGER UNSIGNED NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_caso_abierto`(`caso_abierto`),
    INDEX `ix_caso_cie10`(`id_cie10`),
    INDEX `ix_caso_usuario`(`id_usuario`, `estado`),
    PRIMARY KEY (`id_caso`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cie10` (
    `id_cie10` VARCHAR(10) NOT NULL,
    `descripcion` VARCHAR(255) NOT NULL,
    `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    FULLTEXT INDEX `ft_cie10_descripcion`(`descripcion`),
    PRIMARY KEY (`id_cie10`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departamento` (
    `id_departamento` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_departamento_nombre`(`nombre`),
    PRIMARY KEY (`id_departamento`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discapacidad` (
    `id_discapacidad` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_discapacidad_nombre`(`nombre`),
    PRIMARY KEY (`id_discapacidad`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enfermedad_catastrofica` (
    `id_enfermedad` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `id_cie10` VARCHAR(10) NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_enfermedad_nombre`(`nombre`),
    INDEX `ix_enfermedad_cie10`(`id_cie10`),
    PRIMARY KEY (`id_enfermedad`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evolucion_medica` (
    `id_evolucion` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_atencion` INTEGER UNSIGNED NOT NULL,
    `id_usuario_registra` INTEGER UNSIGNED NOT NULL,
    `codigo` VARCHAR(20) NOT NULL,
    `motivo_consulta` TEXT NOT NULL,
    `enfermedad_actual` TEXT NOT NULL,
    `presion_sistolica` SMALLINT UNSIGNED NULL,
    `presion_diastolica` SMALLINT UNSIGNED NULL,
    `frecuencia_cardiaca` SMALLINT UNSIGNED NULL,
    `frecuencia_respiratoria` TINYINT UNSIGNED NULL,
    `saturacion_o2` TINYINT UNSIGNED NULL,
    `temperatura` DECIMAL(4, 1) NULL,
    `examen_fisico` TEXT NULL,
    `tratamiento` TEXT NULL,
    `observaciones` TEXT NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_evolucion_atencion`(`id_atencion`),
    UNIQUE INDEX `uk_evolucion_codigo`(`codigo`),
    INDEX `ix_evolucion_registra`(`id_usuario_registra`),
    PRIMARY KEY (`id_evolucion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grupo_vulnerable` (
    `id_grupo` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(80) NOT NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_grupo_nombre`(`nombre`),
    PRIMARY KEY (`id_grupo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historia_clinica` (
    `id_historia` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER UNSIGNED NOT NULL,
    `numero_historia` VARCHAR(20) NOT NULL,
    `fecha_apertura` DATE NOT NULL,
    `antecedentes_personales` TEXT NULL,
    `antecedentes_quirurgicos` TEXT NULL,
    `antecedentes_familiares` TEXT NULL,
    `alergias` TEXT NULL,
    `consumo_tabaco` ENUM('no', 'ocasional', 'diario', 'ex_fumador') NULL,
    `consumo_alcohol` ENUM('no', 'ocasional', 'semanal', 'ex_consumidor') NULL,
    `otras_sustancias` VARCHAR(255) NULL,
    `actividad_fisica` VARCHAR(255) NULL,
    `medicacion_habitual` TEXT NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_historia_usuario`(`id_usuario`),
    UNIQUE INDEX `uk_historia_numero`(`numero_historia`),
    PRIMARY KEY (`id_historia`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicamento` (
    `id_medicamento` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `id_presentacion` INTEGER UNSIGNED NOT NULL,
    `concentracion` VARCHAR(50) NOT NULL,
    `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `ix_medicamento_presentacion`(`id_presentacion`),
    UNIQUE INDEX `uk_medicamento`(`nombre`, `id_presentacion`, `concentracion`),
    PRIMARY KEY (`id_medicamento`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `presentacion` (
    `id_presentacion` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(50) NOT NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_presentacion_nombre`(`nombre`),
    PRIMARY KEY (`id_presentacion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receta_detalle` (
    `id_detalle` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_receta` INTEGER UNSIGNED NOT NULL,
    `id_medicamento` INTEGER UNSIGNED NOT NULL,
    `cantidad` SMALLINT UNSIGNED NOT NULL,
    `dosis` VARCHAR(50) NOT NULL,
    `frecuencia` VARCHAR(50) NOT NULL,
    `duracion` VARCHAR(50) NOT NULL,
    `indicaciones` VARCHAR(255) NULL,

    INDEX `ix_detalle_medicamento`(`id_medicamento`),
    UNIQUE INDEX `uk_receta_medicamento`(`id_receta`, `id_medicamento`),
    PRIMARY KEY (`id_detalle`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receta_medica` (
    `id_receta` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_atencion` INTEGER UNSIGNED NOT NULL,
    `advertencias` TEXT NULL,
    `signos_alarma` TEXT NULL,
    `recomendaciones` TEXT NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_receta_atencion`(`id_atencion`),
    PRIMARY KEY (`id_receta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario` (
    `id_usuario` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_base` INTEGER UNSIGNED NOT NULL,
    `id_cargo` INTEGER UNSIGNED NOT NULL,
    `cedula` CHAR(10) NOT NULL,
    `nombres` VARCHAR(100) NOT NULL,
    `apellidos` VARCHAR(100) NOT NULL,
    `sexo` ENUM('hombre', 'mujer') NOT NULL,
    `fecha_nacimiento` DATE NOT NULL,
    `correo` VARCHAR(150) NULL,
    `nombre_usuario` VARCHAR(50) NULL,
    `contrasena_hash` VARCHAR(255) NULL,
    `codigo_medico` VARCHAR(20) NULL,
    `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_usuario_cedula`(`cedula`),
    UNIQUE INDEX `uk_usuario_correo`(`correo`),
    UNIQUE INDEX `uk_usuario_nombre_usuario`(`nombre_usuario`),
    INDEX `ix_usuario_apellidos_nombres`(`apellidos`, `nombres`),
    INDEX `ix_usuario_base`(`id_base`),
    INDEX `ix_usuario_cargo`(`id_cargo`),
    PRIMARY KEY (`id_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario_discapacidad` (
    `id_usuario_discapacidad` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER UNSIGNED NOT NULL,
    `id_discapacidad` INTEGER UNSIGNED NOT NULL,
    `porcentaje` TINYINT UNSIGNED NOT NULL,
    `numero_carnet` VARCHAR(30) NULL,
    `fecha_ingreso` DATE NOT NULL,
    `fecha_salida` DATE NULL,
    `observacion` VARCHAR(255) NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `ix_ud_discapacidad`(`id_discapacidad`),
    INDEX `ix_ud_usuario`(`id_usuario`),
    PRIMARY KEY (`id_usuario_discapacidad`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario_enfermedad_catastrofica` (
    `id_usuario_enfermedad` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER UNSIGNED NOT NULL,
    `id_enfermedad` INTEGER UNSIGNED NOT NULL,
    `fecha_ingreso` DATE NOT NULL,
    `fecha_salida` DATE NULL,
    `observacion` VARCHAR(255) NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `ix_uec_enfermedad`(`id_enfermedad`),
    INDEX `ix_uec_usuario`(`id_usuario`),
    PRIMARY KEY (`id_usuario_enfermedad`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario_grupo_vulnerable` (
    `id_usuario_grupo` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER UNSIGNED NOT NULL,
    `id_grupo` INTEGER UNSIGNED NOT NULL,
    `fecha_ingreso` DATE NOT NULL,
    `fecha_salida` DATE NULL,
    `observacion` VARCHAR(255) NULL,
    `creado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `actualizado_en` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `ix_ugv_grupo`(`id_grupo`),
    INDEX `ix_ugv_usuario`(`id_usuario`),
    PRIMARY KEY (`id_usuario_grupo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `atencion` ADD CONSTRAINT `fk_atencion_caso` FOREIGN KEY (`id_caso`) REFERENCES `caso`(`id_caso`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atencion` ADD CONSTRAINT `fk_atencion_cie10` FOREIGN KEY (`id_cie10`) REFERENCES `cie10`(`id_cie10`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atencion` ADD CONSTRAINT `fk_atencion_registra` FOREIGN KEY (`id_usuario_registra`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atencion` ADD CONSTRAINT `fk_atencion_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cargo` ADD CONSTRAINT `fk_cargo_departamento` FOREIGN KEY (`id_departamento`) REFERENCES `departamento`(`id_departamento`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caso` ADD CONSTRAINT `fk_caso_cie10` FOREIGN KEY (`id_cie10`) REFERENCES `cie10`(`id_cie10`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caso` ADD CONSTRAINT `fk_caso_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `enfermedad_catastrofica` ADD CONSTRAINT `fk_enfermedad_cie10` FOREIGN KEY (`id_cie10`) REFERENCES `cie10`(`id_cie10`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evolucion_medica` ADD CONSTRAINT `fk_evolucion_atencion` FOREIGN KEY (`id_atencion`) REFERENCES `atencion`(`id_atencion`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evolucion_medica` ADD CONSTRAINT `fk_evolucion_registra` FOREIGN KEY (`id_usuario_registra`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historia_clinica` ADD CONSTRAINT `fk_historia_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicamento` ADD CONSTRAINT `fk_medicamento_presentacion` FOREIGN KEY (`id_presentacion`) REFERENCES `presentacion`(`id_presentacion`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receta_detalle` ADD CONSTRAINT `fk_detalle_medicamento` FOREIGN KEY (`id_medicamento`) REFERENCES `medicamento`(`id_medicamento`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receta_detalle` ADD CONSTRAINT `fk_detalle_receta` FOREIGN KEY (`id_receta`) REFERENCES `receta_medica`(`id_receta`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receta_medica` ADD CONSTRAINT `fk_receta_atencion` FOREIGN KEY (`id_atencion`) REFERENCES `atencion`(`id_atencion`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `fk_usuario_base` FOREIGN KEY (`id_base`) REFERENCES `base`(`id_base`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `fk_usuario_cargo` FOREIGN KEY (`id_cargo`) REFERENCES `cargo`(`id_cargo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_discapacidad` ADD CONSTRAINT `fk_ud_discapacidad` FOREIGN KEY (`id_discapacidad`) REFERENCES `discapacidad`(`id_discapacidad`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_discapacidad` ADD CONSTRAINT `fk_ud_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_enfermedad_catastrofica` ADD CONSTRAINT `fk_uec_enfermedad` FOREIGN KEY (`id_enfermedad`) REFERENCES `enfermedad_catastrofica`(`id_enfermedad`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_enfermedad_catastrofica` ADD CONSTRAINT `fk_uec_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_grupo_vulnerable` ADD CONSTRAINT `fk_ugv_grupo` FOREIGN KEY (`id_grupo`) REFERENCES `grupo_vulnerable`(`id_grupo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_grupo_vulnerable` ADD CONSTRAINT `fk_ugv_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario`(`id_usuario`) ON DELETE RESTRICT ON UPDATE CASCADE;
