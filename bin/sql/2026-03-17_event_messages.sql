-- Creates event message timeline table.
-- Safe to run multiple times.
CREATE TABLE IF NOT EXISTS `event_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` VARCHAR(32) NOT NULL,
  `user_id` INT NOT NULL,
  `message_text` LONGTEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL,
  `edited_at` DATETIME NULL DEFAULT NULL,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `deleted_by_user_id` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_event_created` (`event_id`, `created_at`),
  KEY `idx_event_active` (`event_id`, `deleted_at`),
  KEY `idx_author_created` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
