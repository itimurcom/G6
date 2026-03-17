-- Adds avatar storage columns to users table.
-- Safe to run multiple times.

SET @db := DATABASE();

SET @has_avatar_blob := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'avatar_blob'
);
SET @sql := IF(
  @has_avatar_blob = 0,
  'ALTER TABLE users ADD COLUMN avatar_blob MEDIUMBLOB NULL AFTER updated_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_avatar_mime := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'avatar_mime'
);
SET @sql := IF(
  @has_avatar_mime = 0,
  'ALTER TABLE users ADD COLUMN avatar_mime VARCHAR(191) NULL AFTER avatar_blob',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_avatar_filename := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'avatar_filename'
);
SET @sql := IF(
  @has_avatar_filename = 0,
  'ALTER TABLE users ADD COLUMN avatar_filename VARCHAR(255) NULL AFTER avatar_mime',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_avatar_updated_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'avatar_updated_at'
);
SET @sql := IF(
  @has_avatar_updated_at = 0,
  'ALTER TABLE users ADD COLUMN avatar_updated_at DATETIME NULL AFTER avatar_filename',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
