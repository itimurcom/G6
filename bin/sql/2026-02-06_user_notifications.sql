-- Persistent notifications for calendar (new events)
-- Run once on the database used by calendar.localhost
CREATE TABLE IF NOT EXISTS `user_notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `kind` VARCHAR(32) NOT NULL DEFAULT 'event_new',
  `event_id` VARCHAR(32) NOT NULL,
  `actor_user_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `seen_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_user_kind_event` (`user_id`, `kind`, `event_id`),
  KEY `idx_user_seen` (`user_id`, `seen_at`),
  KEY `idx_event_id` (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
