<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

final class AppSettingMysqlRepository
{
    private PDO $db;
    public function __construct()
    {
        $this->db = Database::connect();
        // Ensure defaults exist (global settings)
        $this->ensureDefaultInt('upload.max_file_mb', 100);
    }

    public function getInt(string $key, int $default = 0): int
    {
        $key = trim($key);
        if ($key === '') {
            return $default;
        }

        $sql = 'SELECT `value` FROM `app_settings` WHERE `key` = :k LIMIT 1';
        $st = $this->db->prepare($sql);
        $st->execute(['k' => $key]);
        $row = $st->fetch(PDO::FETCH_ASSOC) ?: null;
        if (!$row) {
            // Store default value so it becomes a global setting visible in DB
            if ($default !== 0) {
                try { $this->ensureDefaultInt($key, $default); } catch (\Throwable $e) { /* no-op */ }
            }
            return $default;
        }

        $v = (string)($row['value'] ?? '');
        if ($v === '') {
            return $default;
        }

        $n = (int)$v;
        return $n;
    }

    public function setInt(string $key, int $value): void
    {
        $key = trim($key);
        if ($key === '') {
            throw new \InvalidArgumentException('key_required');
        }

        $sql = 'INSERT INTO `app_settings` (`key`, `value`, `updated_at`)
                VALUES (:k, :v, NOW())
                ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()';
        $st = $this->db->prepare($sql);
        $st->execute(['k' => $key, 'v' => (string)$value]);
    }

    private function ensureDefaultInt(string $key, int $value): void
    {
        $key = trim($key);
        if ($key === '') {
            return;
        }
        // Insert default if missing; do not overwrite existing value
        $sql = 'INSERT IGNORE INTO `app_settings` (`key`, `value`, `updated_at`) VALUES (:k, :v, NOW())';
        $st = $this->db->prepare($sql);
        $st->execute(['k' => $key, 'v' => (string)$value]);
    }
}
