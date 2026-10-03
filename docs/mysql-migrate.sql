-- Migration for existing MySQL volumes created before admin session versioning.
USE portfolio;

SET @session_version_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'admins'
    AND column_name = 'session_version'
);

SET @migration_sql := IF(
  @session_version_exists = 0,
  'ALTER TABLE admins ADD COLUMN session_version BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER active',
  'SELECT 1'
);

PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;
