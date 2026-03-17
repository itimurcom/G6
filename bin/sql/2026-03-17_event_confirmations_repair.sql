-- Repairs event_confirmations schema for older installs.
-- Safe to run multiple times.

SET @db := DATABASE();

SET @has_pending_slot := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'event_confirmations'
    AND COLUMN_NAME = 'pending_slot'
);

SET @sql := IF(
  @has_pending_slot = 0,
  'ALTER TABLE event_confirmations ADD COLUMN pending_slot TINYINT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_event := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'event_confirmations'
    AND INDEX_NAME = 'idx_event'
);
SET @sql := IF(
  @has_idx_event = 0,
  'ALTER TABLE event_confirmations ADD KEY idx_event (event_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx_assignee_pending := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'event_confirmations'
    AND INDEX_NAME = 'idx_assignee_pending'
);
SET @sql := IF(
  @has_idx_assignee_pending = 0,
  'ALTER TABLE event_confirmations ADD KEY idx_assignee_pending (assignee_user_id, pending_slot, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_ux_pending := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'event_confirmations'
    AND INDEX_NAME = 'ux_pending_event_assignee'
);
SET @sql := IF(
  @has_ux_pending > 0,
  'ALTER TABLE event_confirmations DROP INDEX ux_pending_event_assignee',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE event_confirmations
  ADD UNIQUE KEY ux_pending_event_assignee (event_id, assignee_user_id, pending_slot);

UPDATE event_confirmations
SET pending_slot = 1
WHERE accepted_at IS NULL AND canceled_at IS NULL;

UPDATE event_confirmations
SET pending_slot = NULL
WHERE accepted_at IS NOT NULL OR canceled_at IS NOT NULL;
