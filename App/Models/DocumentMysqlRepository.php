<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Security\DocumentCrypto;
use PDO;

final class DocumentMysqlRepository
{
    private PDO $db;
    private DocumentCrypto $crypto;
    private static bool $schemaEnsured = false;

    public function __construct()
    {
        $this->db = Database::connect();
        $this->crypto = new DocumentCrypto();
        $this->ensureSchema();
    }

    /**
     * @return array<string,mixed>
     */
    public function createForMessage(
        string $eventId,
        int $messageId,
        int $uploadedByUserId,
        string $originalName,
        string $mimeType,
        string $blob
    ): array {
        $eventId = trim($eventId);
        $originalName = trim($originalName);
        $mimeType = trim($mimeType);

        if ($eventId === '') {
            throw new \InvalidArgumentException('event_id required');
        }
        if ($messageId <= 0) {
            throw new \InvalidArgumentException('message_id required');
        }
        if ($uploadedByUserId <= 0) {
            throw new \InvalidArgumentException('uploaded_by_user_id required');
        }
        if ($originalName === '') {
            throw new \InvalidArgumentException('original_name required');
        }
        if ($mimeType === '') {
            throw new \InvalidArgumentException('mime_type required');
        }
        if ($blob === '') {
            throw new \InvalidArgumentException('blob required');
        }

        $encrypted = $this->crypto->encrypt($blob);
        $fileSize = strlen($blob);
        $sha256 = hash('sha256', $blob);
        $isImage = $this->isImageMime($mimeType) ? 1 : 0;

        $sql = 'INSERT INTO documents (
                    event_id,
                    message_id,
                    uploaded_by_user_id,
                    original_name,
                    mime_type,
                    file_size,
                    is_image,
                    sha256,
                    cipher,
                    key_version,
                    iv,
                    auth_tag,
                    file_blob,
                    created_at
                ) VALUES (
                    :event_id,
                    :message_id,
                    :uploaded_by_user_id,
                    :original_name,
                    :mime_type,
                    :file_size,
                    :is_image,
                    :sha256,
                    :cipher,
                    :key_version,
                    :iv,
                    :auth_tag,
                    :file_blob,
                    NOW()
                )';
        $st = $this->db->prepare($sql);
        $st->bindValue(':event_id', $eventId);
        $st->bindValue(':message_id', $messageId, PDO::PARAM_INT);
        $st->bindValue(':uploaded_by_user_id', $uploadedByUserId, PDO::PARAM_INT);
        $st->bindValue(':original_name', $originalName);
        $st->bindValue(':mime_type', $mimeType);
        $st->bindValue(':file_size', $fileSize, PDO::PARAM_INT);
        $st->bindValue(':is_image', $isImage, PDO::PARAM_INT);
        $st->bindValue(':sha256', $sha256);
        $st->bindValue(':cipher', (string)$encrypted['cipher']);
        $st->bindValue(':key_version', (int)$encrypted['key_version'], PDO::PARAM_INT);
        $st->bindValue(':iv', $encrypted['iv'], PDO::PARAM_LOB);
        $st->bindValue(':auth_tag', $encrypted['auth_tag'], PDO::PARAM_LOB);
        $st->bindValue(':file_blob', $encrypted['ciphertext'], PDO::PARAM_LOB);
        $st->execute();

        $id = (int)$this->db->lastInsertId();
        $row = $this->getById($id, true);
        if (!$row) {
            throw new \RuntimeException('document_create_readback_failed');
        }

        return $row;
    }

    /** @return array<int,array<string,mixed>> */
    public function listByMessageId(int $messageId, bool $includeDeleted = false): array
    {
        if ($messageId <= 0) {
            return [];
        }

        $whereDeleted = $includeDeleted ? '' : ' AND d.deleted_at IS NULL';
        $sql = "SELECT d.*, u.login AS uploaded_by_login, u.name AS uploaded_by_name
                FROM documents d
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                WHERE d.message_id = :message_id{$whereDeleted}
                ORDER BY d.created_at ASC, d.id ASC";
        $st = $this->db->prepare($sql);
        $st->execute(['message_id' => $messageId]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        return array_map([$this, 'mapRow'], is_array($rows) ? $rows : []);
    }

    /** @return array<int,array<string,mixed>> */
    public function listByEventId(string $eventId, bool $includeDeleted = false, int $limit = 500, int $offset = 0): array
    {
        $eventId = trim($eventId);
        if ($eventId === '') {
            return [];
        }

        $limit = max(1, min(1000, $limit));
        $offset = max(0, $offset);
        $whereDeleted = $includeDeleted ? '' : ' AND d.deleted_at IS NULL';
        $sql = "SELECT d.*, u.login AS uploaded_by_login, u.name AS uploaded_by_name
                FROM documents d
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                WHERE d.event_id = :event_id{$whereDeleted}
                ORDER BY d.created_at DESC, d.id DESC
                LIMIT {$limit} OFFSET {$offset}";
        $st = $this->db->prepare($sql);
        $st->execute(['event_id' => $eventId]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        return array_map([$this, 'mapRow'], is_array($rows) ? $rows : []);
    }

    public function countByEventId(string $eventId, bool $includeDeleted = false): int
    {
        $eventId = trim($eventId);
        if ($eventId === '') {
            return 0;
        }

        $sql = 'SELECT COUNT(*) FROM documents WHERE event_id = :event_id';
        if (!$includeDeleted) {
            $sql .= ' AND deleted_at IS NULL';
        }
        $st = $this->db->prepare($sql);
        $st->execute(['event_id' => $eventId]);
        return (int)$st->fetchColumn();
    }

    /**
     * @return array<string,mixed>|null
     */
    public function getById(int $id, bool $includeDeleted = false): ?array
    {
        if ($id <= 0) {
            return null;
        }

        $whereDeleted = $includeDeleted ? '' : ' AND d.deleted_at IS NULL';
        $sql = "SELECT d.*, u.login AS uploaded_by_login, u.name AS uploaded_by_name
                FROM documents d
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                WHERE d.id = :id{$whereDeleted}
                LIMIT 1";
        $st = $this->db->prepare($sql);
        $st->execute(['id' => $id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $this->mapRow($row) : null;
    }

    public function softDeleteById(int $id, int $deletedByUserId): bool
    {
        if ($id <= 0) {
            throw new \InvalidArgumentException('id required');
        }
        if ($deletedByUserId <= 0) {
            throw new \InvalidArgumentException('deleted_by_user_id required');
        }

        $sql = 'UPDATE documents
                SET deleted_at = NOW(),
                    deleted_by_user_id = :deleted_by,
                    updated_at = NOW()
                WHERE id = :id AND deleted_at IS NULL';
        $st = $this->db->prepare($sql);
        return $st->execute([
            'id' => $id,
            'deleted_by' => $deletedByUserId,
        ]);
    }

    /**
     * @return array{meta:array<string,mixed>,blob:string}|null
     */
    public function getDecryptedBlobById(int $id, bool $includeDeleted = false): ?array
    {
        if ($id <= 0) {
            return null;
        }

        $whereDeleted = $includeDeleted ? '' : ' AND d.deleted_at IS NULL';
        $sql = "SELECT d.*, u.login AS uploaded_by_login, u.name AS uploaded_by_name
                FROM documents d
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                WHERE d.id = :id{$whereDeleted}
                LIMIT 1";
        $st = $this->db->prepare($sql);
        $st->execute(['id' => $id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        $blob = $this->crypto->decrypt(
            (string)($row['file_blob'] ?? ''),
            (string)($row['iv'] ?? ''),
            (string)($row['auth_tag'] ?? ''),
            (int)($row['key_version'] ?? 0),
            (string)($row['cipher'] ?? '')
        );

        return [
            'meta' => $this->mapRow($row),
            'blob' => $blob,
        ];
    }

    /** @return array<int,array<string,mixed>> */
    public function listForCabinet(int $viewerUserId, bool $isAdmin = false, int $limit = 500, int $offset = 0): array
    {
        if ($viewerUserId <= 0) {
            return [];
        }

        $limit = max(1, min(1000, $limit));
        $offset = max(0, $offset);
        $params = [];
        $where = 'WHERE d.deleted_at IS NULL';
        if (!$isAdmin) {
            $where .= ' AND d.uploaded_by_user_id = :viewer_user_id';
            $params['viewer_user_id'] = $viewerUserId;
        }

        $sql = "SELECT d.*, u.login AS uploaded_by_login, u.name AS uploaded_by_name, e.title AS event_title
                FROM documents d
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                LEFT JOIN events e ON e.id = d.event_id
                {$where}
                ORDER BY d.created_at DESC, d.id DESC
                LIMIT {$limit} OFFSET {$offset}";
        $st = $this->db->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        return array_map([$this, 'mapRow'], is_array($rows) ? $rows : []);
    }

    /** @return array<string,mixed> */
    private function mapRow(array $row): array
    {
        $uploadedByName = trim((string)($row['uploaded_by_name'] ?? ''));
        $uploadedByLogin = trim((string)($row['uploaded_by_login'] ?? ''));
        $display = $uploadedByName !== '' ? $uploadedByName : ($uploadedByLogin !== '' ? $uploadedByLogin : ('User #' . (int)($row['uploaded_by_user_id'] ?? 0)));

        return [
            'id' => (int)($row['id'] ?? 0),
            'event_id' => (string)($row['event_id'] ?? ''),
            'message_id' => isset($row['message_id']) ? (int)$row['message_id'] : null,
            'uploaded_by_user_id' => (int)($row['uploaded_by_user_id'] ?? 0),
            'original_name' => (string)($row['original_name'] ?? ''),
            'mime_type' => (string)($row['mime_type'] ?? 'application/octet-stream'),
            'file_size' => (int)($row['file_size'] ?? 0),
            'is_image' => !empty($row['is_image']),
            'sha256' => (string)($row['sha256'] ?? ''),
            'cipher' => (string)($row['cipher'] ?? ''),
            'key_version' => (int)($row['key_version'] ?? 0),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => $row['updated_at'] ?? null,
            'deleted_at' => $row['deleted_at'] ?? null,
            'deleted_by_user_id' => isset($row['deleted_by_user_id']) && $row['deleted_by_user_id'] !== null ? (int)$row['deleted_by_user_id'] : null,
            'event_title' => isset($row['event_title']) ? (string)$row['event_title'] : '',
            'uploader' => [
                'id' => (int)($row['uploaded_by_user_id'] ?? 0),
                'name' => $uploadedByName,
                'login' => $uploadedByLogin,
                'display' => $display,
            ],
        ];
    }

    private function isImageMime(string $mimeType): bool
    {
        $mimeType = strtolower(trim($mimeType));
        return $mimeType !== '' && str_starts_with($mimeType, 'image/');
    }

    private function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        $sql = "CREATE TABLE IF NOT EXISTS `documents` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `event_id` VARCHAR(32) NOT NULL,
            `message_id` BIGINT UNSIGNED NULL DEFAULT NULL,
            `uploaded_by_user_id` INT NOT NULL,
            `original_name` VARCHAR(255) NOT NULL,
            `mime_type` VARCHAR(191) NOT NULL DEFAULT 'application/octet-stream',
            `file_size` BIGINT UNSIGNED NOT NULL DEFAULT 0,
            `is_image` TINYINT(1) NOT NULL DEFAULT 0,
            `sha256` CHAR(64) NOT NULL,
            `cipher` VARCHAR(64) NOT NULL DEFAULT 'aes-256-gcm',
            `key_version` INT NOT NULL DEFAULT 1,
            `iv` VARBINARY(32) NOT NULL,
            `auth_tag` VARBINARY(32) NOT NULL,
            `file_blob` LONGBLOB NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NULL DEFAULT NULL,
            `deleted_at` DATETIME NULL DEFAULT NULL,
            `deleted_by_user_id` INT NULL DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_documents_event_created` (`event_id`, `created_at`),
            KEY `idx_documents_event_active` (`event_id`, `deleted_at`),
            KEY `idx_documents_message_created` (`message_id`, `created_at`),
            KEY `idx_documents_message_active` (`message_id`, `deleted_at`),
            KEY `idx_documents_uploader_created` (`uploaded_by_user_id`, `created_at`),
            KEY `idx_documents_sha256` (`sha256`),
            KEY `idx_documents_is_image` (`is_image`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        $this->db->exec($sql);
        self::$schemaEnsured = true;
    }
}
