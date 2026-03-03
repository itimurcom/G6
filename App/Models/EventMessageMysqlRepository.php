<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

final class EventMessageMysqlRepository implements EventMessageRepositoryInterface
{
    private PDO $db;
    private static bool $schemaEnsured = false;

    public function __construct()
    {
        $this->db = Database::connect();
        $this->ensureSchema();
    }

    public function listByEvent(string $eventId, bool $includeDeleted = false, int $limit = 200, int $offset = 0): array
    {
        $eventId = trim($eventId);
        if ($eventId === '') {
            return [];
        }

        $limit = max(1, min(500, $limit));
        $offset = max(0, $offset);

        $whereDeleted = $includeDeleted ? '' : ' AND m.deleted_at IS NULL';
        $sql = "SELECT
                    m.id,
                    m.event_id,
                    m.user_id,
                    m.message_text,
                    m.created_at,
                    m.updated_at,
                    m.edited_at,
                    m.deleted_at,
                    m.deleted_by_user_id,
                    u.name  AS author_name,
                    u.login AS author_login,
                    u.role  AS author_role,
                    u.is_admin AS author_is_admin,
                    u.avatar_mime AS author_avatar_mime,
                    u.avatar_filename AS author_avatar_filename,
                    u.avatar_updated_at AS author_avatar_updated_at
                FROM event_messages m
                LEFT JOIN users u ON u.id = m.user_id
                WHERE m.event_id = :event_id{$whereDeleted}
                ORDER BY m.created_at ASC, m.id ASC
                LIMIT {$limit} OFFSET {$offset}";

        $st = $this->db->prepare($sql);
        $st->execute(['event_id' => $eventId]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        return array_map([$this, 'mapRow'], $rows);
    }

    public function countByEvent(string $eventId, bool $includeDeleted = false): int
    {
        $eventId = trim($eventId);
        if ($eventId === '') {
            return 0;
        }

        $sql = 'SELECT COUNT(*) FROM event_messages WHERE event_id = :event_id';
        if (!$includeDeleted) {
            $sql .= ' AND deleted_at IS NULL';
        }

        $st = $this->db->prepare($sql);
        $st->execute(['event_id' => $eventId]);
        return (int)$st->fetchColumn();
    }

    public function getById(int $id): ?array
    {
        if ($id <= 0) {
            return null;
        }

        $sql = "SELECT
                    m.id,
                    m.event_id,
                    m.user_id,
                    m.message_text,
                    m.created_at,
                    m.updated_at,
                    m.edited_at,
                    m.deleted_at,
                    m.deleted_by_user_id,
                    u.name  AS author_name,
                    u.login AS author_login,
                    u.role  AS author_role,
                    u.is_admin AS author_is_admin,
                    u.avatar_mime AS author_avatar_mime,
                    u.avatar_filename AS author_avatar_filename,
                    u.avatar_updated_at AS author_avatar_updated_at
                FROM event_messages m
                LEFT JOIN users u ON u.id = m.user_id
                WHERE m.id = :id
                LIMIT 1";

        $st = $this->db->prepare($sql);
        $st->execute(['id' => $id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->mapRow($row) : null;
    }

    public function create(string $eventId, int $userId, string $messageText): array
    {
        $eventId = trim($eventId);
        $messageText = $this->normalizeMessageText($messageText);
        if ($eventId === '') {
            throw new \InvalidArgumentException('event_id required');
        }
        if ($userId <= 0) {
            throw new \InvalidArgumentException('user_id required');
        }
        if ($messageText === '') {
            throw new \InvalidArgumentException('message_text required');
        }

        $sql = 'INSERT INTO event_messages (event_id, user_id, message_text, created_at) VALUES (:event_id, :user_id, :message_text, NOW())';
        $st = $this->db->prepare($sql);
        $st->execute([
            'event_id' => $eventId,
            'user_id' => $userId,
            'message_text' => $messageText,
        ]);

        $id = (int)$this->db->lastInsertId();
        $row = $this->getById($id);
        if (!$row) {
            throw new \RuntimeException('message_create_readback_failed');
        }
        return $row;
    }

    public function updateById(int $id, string $messageText, int $editorUserId): ?array
    {
        $messageText = $this->normalizeMessageText($messageText);
        if ($id <= 0) {
            throw new \InvalidArgumentException('id required');
        }
        if ($editorUserId <= 0) {
            throw new \InvalidArgumentException('editor_user_id required');
        }
        if ($messageText === '') {
            throw new \InvalidArgumentException('message_text required');
        }

        $current = $this->getById($id);
        if (!$current || !empty($current['deleted_at'])) {
            return null;
        }

        $sql = 'UPDATE event_messages
                SET message_text = :message_text,
                    updated_at = NOW(),
                    edited_at = NOW()
                WHERE id = :id AND deleted_at IS NULL';
        $st = $this->db->prepare($sql);
        $st->execute([
            'id' => $id,
            'message_text' => $messageText,
        ]);

        return $this->getById($id);
    }



    public function searchText(string $query, ?string $eventType = null, ?string $startDate = null, ?string $endDate = null, int $limit = 25, int $offset = 0): array
    {
        $query = trim($query);
        if ($query === '') {
            return [];
        }

        $limit = max(1, min(100, $limit));
        $offset = max(0, $offset);

        $params = ['q' => '%' . $query . '%'];
        $where = ['m.deleted_at IS NULL', 'm.message_text LIKE :q'];

        if ($eventType !== null && $eventType !== '' && $eventType !== 'all') {
            $where[] = 'e.type = :event_type';
            $params['event_type'] = $eventType;
        }
        if ($startDate !== null && $startDate !== '') {
            $where[] = 'e.start_date >= :start_date';
            $params['start_date'] = $startDate;
        }
        if ($endDate !== null && $endDate !== '') {
            $where[] = 'e.start_date <= :end_date';
            $params['end_date'] = $endDate;
        }

        $sql = "SELECT
                    m.id,
                    m.event_id,
                    m.user_id,
                    m.message_text,
                    m.created_at,
                    m.updated_at,
                    m.edited_at,
                    m.deleted_at,
                    m.deleted_by_user_id,
                    u.name  AS author_name,
                    u.login AS author_login,
                    u.role  AS author_role,
                    u.is_admin AS author_is_admin,
                    u.avatar_mime AS author_avatar_mime,
                    u.avatar_filename AS author_avatar_filename,
                    u.avatar_updated_at AS author_avatar_updated_at,
                    e.title AS event_title,
                    e.start_date AS event_date,
                    e.time AS event_time,
                    e.type AS event_type
                FROM event_messages m
                INNER JOIN events e ON e.id COLLATE utf8mb4_unicode_ci = m.event_id
                LEFT JOIN users u ON u.id = m.user_id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY m.created_at DESC, m.id DESC
                LIMIT {$limit} OFFSET {$offset}";

        $st = $this->db->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $out = [];
        foreach ($rows as $row) {
            $mapped = $this->mapRow($row);
            $mapped['event_title'] = (string)($row['event_title'] ?? '');
            $mapped['event_date'] = (string)($row['event_date'] ?? '');
            $mapped['event_time'] = (string)($row['event_time'] ?? '');
            $mapped['event_type'] = (string)($row['event_type'] ?? '');
            $out[] = $mapped;
        }
        return $out;
    }
    public function softDeleteById(int $id, int $deleterUserId): ?array
    {
        if ($id <= 0) {
            throw new \InvalidArgumentException('id required');
        }
        if ($deleterUserId <= 0) {
            throw new \InvalidArgumentException('deleter_user_id required');
        }

        $current = $this->getById($id);
        if (!$current || !empty($current['deleted_at'])) {
            return null;
        }

        $sql = 'UPDATE event_messages
                SET deleted_at = NOW(),
                    deleted_by_user_id = :deleter,
                    updated_at = NOW()
                WHERE id = :id AND deleted_at IS NULL';
        $st = $this->db->prepare($sql);
        $st->execute([
            'id' => $id,
            'deleter' => $deleterUserId,
        ]);

        return $this->getById($id);
    }

    private function normalizeMessageText(string $messageText): string
    {
        $messageText = str_replace(["\r\n", "\r"], "\n", $messageText);
        $messageText = trim($messageText);
        if ($messageText === '') {
            return '';
        }

        if (function_exists('mb_strlen')) {
            if (mb_strlen($messageText, 'UTF-8') > 20000) {
                throw new \InvalidArgumentException('message_text too long');
            }
            return $messageText;
        }

        if (strlen($messageText) > 20000) {
            throw new \InvalidArgumentException('message_text too long');
        }
        return $messageText;
    }

    private function mapRow(array $row): array
    {
        $authorName = trim((string)($row['author_name'] ?? ''));
        $authorLogin = trim((string)($row['author_login'] ?? ''));
        $display = $authorName !== '' ? $authorName : ($authorLogin !== '' ? $authorLogin : ('User #' . (int)($row['user_id'] ?? 0)));

        $authorHasAvatar = ((int)($row['user_id'] ?? 0) > 0)
            && (!empty($row['author_avatar_mime']) || !empty($row['author_avatar_filename']));

        return [
            'id' => (int)($row['id'] ?? 0),
            'event_id' => (string)($row['event_id'] ?? ''),
            'user_id' => (int)($row['user_id'] ?? 0),
            'message_text' => (string)($row['message_text'] ?? ''),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => $row['updated_at'] ?? null,
            'edited_at' => $row['edited_at'] ?? null,
            'deleted_at' => $row['deleted_at'] ?? null,
            'deleted_by_user_id' => isset($row['deleted_by_user_id']) ? (int)($row['deleted_by_user_id']) : null,
            'author' => [
                'id' => (int)($row['user_id'] ?? 0),
                'name' => $authorName,
                'login' => $authorLogin,
                'display' => $display,
                'role' => (string)($row['author_role'] ?? ''),
                'is_admin' => !empty($row['author_is_admin']),
                'has_avatar' => $authorHasAvatar,
                'avatar_url' => $authorHasAvatar
                    ? ('/api/users/avatar?id=' . (int)($row['user_id'] ?? 0) . (!empty($row['author_avatar_updated_at']) ? ('&v=' . rawurlencode((string)$row['author_avatar_updated_at'])) : ''))
                    : null,
                'avatar_version' => (string)($row['author_avatar_updated_at'] ?? ''),
            ],
        ];
    }

    private function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        $sqlMessages = "CREATE TABLE IF NOT EXISTS `event_messages` (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        $sqlAttachments = "CREATE TABLE IF NOT EXISTS `event_message_attachments` (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        $this->db->exec($sqlMessages);
        $this->db->exec($sqlAttachments);
        self::$schemaEnsured = true;
    }
}
