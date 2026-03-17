-- Creates execution confirmation table.
-- Safe to run multiple times on new installs.
CREATE TABLE IF NOT EXISTS `event_confirmations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` VARCHAR(32) NOT NULL,
  `assignee_user_id` INT NOT NULL,
  `created_by_user_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accepted_at` DATETIME NULL,
  `accepted_by_user_id` INT NULL,
  `viewed_at` DATETIME NULL,
  `canceled_at` DATETIME NULL,
  `canceled_by_user_id` INT NULL,
  `pending_slot` TINYINT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_event` (`event_id`),
  KEY `idx_assignee_pending` (`assignee_user_id`, `pending_slot`, `created_at`),
  UNIQUE KEY `ux_pending_event_assignee` (`event_id`, `assignee_user_id`, `pending_slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
