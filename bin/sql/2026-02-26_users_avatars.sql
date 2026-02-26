ALTER TABLE `users`
    ADD COLUMN `avatar_blob` MEDIUMBLOB NULL AFTER `updated_at`,
    ADD COLUMN `avatar_mime` VARCHAR(191) NULL AFTER `avatar_blob`,
    ADD COLUMN `avatar_filename` VARCHAR(255) NULL AFTER `avatar_mime`,
    ADD COLUMN `avatar_updated_at` DATETIME NULL AFTER `avatar_filename`;
