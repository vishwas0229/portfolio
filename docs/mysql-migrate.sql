-- Migration for existing MySQL volumes created before admin session versioning.
USE portfolio;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS session_version BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER active;
