-- ============================================================
-- EduBot — Script 01: Creación del esquema
-- INSTRUCCIONES: Ejecuta este script PRIMERO en pgAdmin
-- ============================================================

-- Tabla de docentes
CREATE TABLE IF NOT EXISTS docentes (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    apellido    VARCHAR(100) NOT NULL,
    curso       VARCHAR(100) NOT NULL,
    email       VARCHAR(150) UNIQUE,
    activo      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Tabla de padres de familia
CREATE TABLE IF NOT EXISTS padres (
    id              SERIAL PRIMARY KEY,
    dni             VARCHAR(8) UNIQUE NOT NULL,
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100) NOT NULL,
    telefono        VARCHAR(15),
    horario_laboral VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Tabla de estudiantes
CREATE TABLE IF NOT EXISTS estudiantes (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    apellido    VARCHAR(100) NOT NULL,
    grado       VARCHAR(20),
    seccion     VARCHAR(5),
    padre_id    INT REFERENCES padres(id),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Tabla de disponibilidad del docente
CREATE TABLE IF NOT EXISTS disponibilidad_docente (
    id          SERIAL PRIMARY KEY,
    docente_id  INT REFERENCES docentes(id),
    fecha       DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL,
    disponible  BOOLEAN DEFAULT TRUE
);

-- Tabla de citas
CREATE TABLE IF NOT EXISTS citas (
    id              SERIAL PRIMARY KEY,
    ticket          VARCHAR(20) UNIQUE NOT NULL,
    padre_id        INT REFERENCES padres(id),
    docente_id      INT REFERENCES docentes(id),
    estudiante_id   INT REFERENCES estudiantes(id),
    fecha           DATE NOT NULL,
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    motivo          VARCHAR(50) NOT NULL,
    estado          VARCHAR(20) DEFAULT 'confirmada',
    asistio         BOOLEAN,
    satisfaccion    INT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios_panel (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,           -- BCrypt hash
    rol         VARCHAR(20)  NOT NULL            -- 'DOCENTE' o 'ADMINISTRATIVO'
                CHECK (rol IN ('DOCENTE', 'ADMINISTRATIVO')),
    docente_id  BIGINT REFERENCES docentes(id),  -- NULL si es ADMINISTRATIVO
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);


-- Índices
CREATE INDEX IF NOT EXISTS idx_citas_padre       ON citas(padre_id);
CREATE INDEX IF NOT EXISTS idx_citas_docente     ON citas(docente_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha       ON citas(fecha);
CREATE INDEX IF NOT EXISTS idx_disp_docente      ON disponibilidad_docente(docente_id, fecha);

-- Índice para búsquedas por username (login)
CREATE INDEX IF NOT EXISTS idx_usuarios_panel_username ON usuarios_panel(username);

-- Índice para buscar el usuario de un docente específico
CREATE INDEX IF NOT EXISTS idx_usuarios_panel_docente ON usuarios_panel(docente_id);


