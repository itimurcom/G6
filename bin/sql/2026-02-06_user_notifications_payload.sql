-- Adds optional payload (JSON snapshot) to user_notifications table.
-- Safe to run multiple times.

SET @db := DATABASE();
SET @col := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'user_notifications'
    AND COLUMN_NAME = 'payload'
);

SET @sql := IF(
  @col = 0,
  'ALTER TABLE user_notifications ADD COLUMN payload LONGTEXT NULL AFTER seen_at',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
