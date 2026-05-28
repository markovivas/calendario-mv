-- Compatível com hospedagem compartilhada / phpMyAdmin

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- =========================
-- TABELA: settings
-- =========================
CREATE TABLE IF NOT EXISTS settings (
    id INT NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_settings_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- TABELA: users
-- =========================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- TABELA: categories
-- =========================
CREATE TABLE IF NOT EXISTS categories (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    `order` INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- CATEGORIAS PADRÃO
-- =========================
INSERT IGNORE INTO categories (name, label, color, `order`) VALUES
('pessoal', 'Pessoal', '#8b5cf6', 1),
('trabalho', 'Trabalho', '#3b82f6', 2),
('urgente', 'Urgente', '#ef4444', 3);

-- =========================
-- TABELA: events
-- =========================
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    `from` TIME NOT NULL,
    `to` TIME NOT NULL,
    title VARCHAR(255) NOT NULL,
    note TEXT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'pessoal',
    owner_id VARCHAR(20) NOT NULL,
    all_day TINYINT(1) NOT NULL DEFAULT 0,
    `repeat` VARCHAR(20) NOT NULL DEFAULT 'none',
    series_id VARCHAR(20) DEFAULT NULL,
    files LONGTEXT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_date (date),
    KEY idx_owner_id (owner_id),
    KEY idx_series_id (series_id),

    CONSTRAINT fk_events_owner
        FOREIGN KEY (owner_id)
        REFERENCES users(id)
        ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
