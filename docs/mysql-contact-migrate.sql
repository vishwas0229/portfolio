-- One-time migration for existing MySQL volumes.
-- Removes legacy email-notification columns after switching feedback to DB-only storage.
USE portfolio;

SET @has_email_status := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'contact_messages'
    AND column_name = 'email_status'
);

SET @has_email_error := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'contact_messages'
    AND column_name = 'email_error'
);

SET @drop_columns := CONCAT(
  'ALTER TABLE contact_messages ',
  IF(@has_email_status > 0, 'DROP COLUMN email_status', ''),
  IF(@has_email_status > 0 AND @has_email_error > 0, ', ', ''),
  IF(@has_email_error > 0, 'DROP COLUMN email_error', '')
);

SET @migration_sql := IF(
  @has_email_status > 0 OR @has_email_error > 0,
  @drop_columns,
  'SELECT 1'
);

PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;
