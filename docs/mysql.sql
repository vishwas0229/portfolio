CREATE DATABASE IF NOT EXISTS portfolio
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE portfolio;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  session_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY admins_email_uq (email),
  KEY admins_active_idx (active),
  CONSTRAINT admins_role_chk CHECK (role = 'admin')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  title VARCHAR(120) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  summary VARCHAR(280) NOT NULL,
  description TEXT NOT NULL,
  tech_stack JSON NOT NULL,
  repository_url VARCHAR(500) NULL,
  demo_url VARCHAR(500) NULL,
  image_url VARCHAR(500) NULL,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY projects_slug_uq (slug),
  KEY projects_published_order_idx (published, display_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificates (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  title VARCHAR(160) NOT NULL,
  issuer VARCHAR(160) NOT NULL DEFAULT '',
  issued_on DATE NULL,
  credential_url VARCHAR(500) NULL,
  image_url VARCHAR(500) NULL,
  description VARCHAR(2000) NOT NULL DEFAULT '',
  display_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY certificates_title_uq (title),
  KEY certificates_published_order_idx (published, display_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  name VARCHAR(70) NOT NULL,
  email VARCHAR(160) NOT NULL,
  subject VARCHAR(160) NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  page_url VARCHAR(500) NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'new',
  email_status VARCHAR(12) NOT NULL DEFAULT 'pending',
  email_error VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  archived_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY contact_messages_status_idx (status, created_at),
  CONSTRAINT contact_messages_status_chk CHECK (status IN ('new','read','archived')),
  CONSTRAINT contact_messages_email_status_chk CHECK (email_status IN ('pending','sent','failed','skipped'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_name VARCHAR(40) NOT NULL,
  event_date DATE NOT NULL,
  section VARCHAR(80) NULL,
  project_slug VARCHAR(100) NULL,
  metadata JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY analytics_events_date_name_idx (event_date, event_name),
  KEY analytics_events_section_idx (event_date, section),
  KEY analytics_events_project_idx (event_date, project_slug),
  CONSTRAINT analytics_event_name_chk CHECK (
    event_name IN (
      'visit','section_view','project_click','repo_click','demo_click',
      'contact_start','contact_submit','game_start','game_complete'
    )
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
