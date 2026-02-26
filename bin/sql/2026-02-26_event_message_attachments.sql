-- Event message attachments (preparatory schema for future file/image uploads)
-- Safe to run on calendar.localhost database.
CREATE TABLE IF NOT EXISTS `event_message_attachments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT UNSIGNED NOT NULL,
  `stored_name` VARCHAR(255) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(191) NOT NULL DEFAULT '',
  `file_size` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `storage_path` VARCHAR(500) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by_user_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_message_created` (`message_id`, `created_at`),
  KEY `idx_storage_path` (`storage_path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
