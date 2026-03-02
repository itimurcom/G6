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

    public function __construct()
    {
        $this->db = Database::connect();
        $this->crypto = new DocumentCrypto();
    }

    public function createForMessage(
        string $eventId,
        ?int $messageId,
        int $uploadedByUserId,
        string $originalName,
        string $mimeType,
        int $fileSize,
        bool $isImage,
        string $sha256,
        string $plaintextBlob
    ): array {
        $eventId = trim($eventId);
        $originalName = trim($originalName);
        $mimeType = trim($mimeType);
        $sha256 = strtolower(trim($sha256));
        if ($eventId === '') throw new \InvalidArgumentException('event_id required');
        if ($uploadedByUserId <= 0) throw new \InvalidArgumentException('uploaded_by_user_id required');
        if ($originalName === '') throw new \InvalidArgumentException('original_name required');
        if ($mimeType === '') throw new \InvalidArgumentException('mime_type required');
        if ($fileSize < 0) throw new \InvalidArgumentException('file_size invalid');
        if ($sha256 === '') throw new \InvalidArgumentException('sha256 required');
        if ($plaintextBlob === '') throw new \InvalidArgumentException('file_blob required');

        $enc = $this->crypto->encrypt($plaintextBlob);

        $sql = 'INSERT INTO documents (
                    event_id, message_id, uploaded_by_user_id,
                    original_name, mime_type, file_size, is_image, sha256,
                    cipher, key_version, iv, auth_tag, file_blob, created_at
                ) VALUES (
                    :event_id, :message_id, :uploaded_by_user_id,
                    :original_name, :mime_type, :file_size, :is_image, :sha256,
                    :cipher, :key_version, :iv, :auth_tag, :file_blob, NOW()
                )';
        $st = $this->db->prepare($sql);
        $st->bindValue(':event_id', $eventId);
        if ($messageId !== null && $messageId > 0) {
            $st->bindValue(':message_id', $messageId, PDO::PARAM_INT);
        } else {
            $st->bindValue(':message_id', null, PDO::PARAM_NULL);
        }
        $st->bindValue(':uploaded_by_user_id', $uploadedByUserId, PDO::PARAM_INT);
        $st->bindValue(':original_name', $originalName);
        $st->bindValue(':mime_type', $mimeType);
        $st->bindValue(':file_size', $fileSize, PDO::PARAM_INT);
        $st->bindValue(':is_image', $isImage ? 1 : 0, PDO::PARAM_INT);
        $st->bindValue(':sha256', $sha256);
        $st->bindValue(':cipher', $enc['cipher']);
        $st->bindValue(':key_version', $enc['key_version'], PDO::PARAM_INT);
        $st->bindValue(':iv', $enc['iv'], PDO::PARAM_LOB);
        $st->bindValue(':auth_tag', $enc['auth_tag'], PDO::PARAM_LOB);
        $st->bindValue(':file_blob', $enc['ciphertext'], PDO::PARAM_LOB);
        $st->execute();

        return $this->getById((int)$this->db->lastInsertId()) ?? throw new \RuntimeException('document_create_readback_failed');
    }

    public function listByMessageId(int $messageId, bool $includeDeleted = false): array
    {
        if ($messageId <= 0) return [];
        $deletedSql = $includeDeleted ? '' : ' AND d.deleted_at IS NULL';
        $sql = "SELECT d.*, e.title AS event_title,
                       u.name AS uploader_name, u.login AS uploader_login,
                       m.user_id AS message_user_id
                FROM documents d
                LEFT JOIN events e ON e.id COLLATE utf8mb4_unicode_ci = d.event_id
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                LEFT JOIN event_messages m ON m.id = d.message_id
                WHERE d.message_id = :message_id{$deletedSql}
                ORDER BY d.created_at ASC, d.id ASC";
        $st = $this->db->prepare($sql);
        $st->execute(['message_id' => $messageId]);
        return array_map([$this, 'mapRow'], $st->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function listByEventId(string $eventId, bool $includeDeleted = false, int $limit = 200, int $offset = 0): array
    {
        $eventId = trim($eventId);
        if ($eventId === '') return [];
        $limit = max(1, min(500, $limit));
        $offset = max(0, $offset);
        $deletedSql = $includeDeleted ? '' : ' AND d.deleted_at IS NULL';
        $sql = "SELECT d.*, e.title AS event_title,
                       u.name AS uploader_name, u.login AS uploader_login,
                       m.user_id AS message_user_id
                FROM documents d
                LEFT JOIN events e ON e.id COLLATE utf8mb4_unicode_ci = d.event_id
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                LEFT JOIN event_messages m ON m.id = d.message_id
                WHERE d.event_id = :event_id{$deletedSql}
                ORDER BY d.created_at DESC, d.id DESC
                LIMIT {$limit} OFFSET {$offset}";
        $st = $this->db->prepare($sql);
        $st->execute(['event_id' => $eventId]);
        return array_map([$this, 'mapRow'], $st->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function countByEventId(string $eventId, bool $includeDeleted = false): int
    {
        $eventId = trim($eventId);
        if ($eventId === '') return 0;
        $sql = 'SELECT COUNT(*) FROM documents WHERE event_id = :event_id';
        if (!$includeDeleted) {
            $sql .= ' AND deleted_at IS NULL';
        }
        $st = $this->db->prepare($sql);
        $st->execute(['event_id' => $eventId]);
        return (int)$st->fetchColumn();
    }

    public function countByMessageId(int $messageId, bool $includeDeleted = false): int
    {
        if ($messageId <= 0) return 0;
        $sql = 'SELECT COUNT(*) FROM documents WHERE message_id = :message_id';
        if (!$includeDeleted) {
            $sql .= ' AND deleted_at IS NULL';
        }
        $st = $this->db->prepare($sql);
        $st->execute(['message_id' => $messageId]);
        return (int)$st->fetchColumn();
    }

    public function getById(int $id, bool $includeDeleted = true): ?array
    {
        if ($id <= 0) return null;
        $deletedSql = $includeDeleted ? '' : ' AND d.deleted_at IS NULL';
        $sql = "SELECT d.*, e.title AS event_title,
                       u.name AS uploader_name, u.login AS uploader_login,
                       m.user_id AS message_user_id
                FROM documents d
                LEFT JOIN events e ON e.id COLLATE utf8mb4_unicode_ci = d.event_id
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                LEFT JOIN event_messages m ON m.id = d.message_id
                WHERE d.id = :id{$deletedSql}
                LIMIT 1";
        $st = $this->db->prepare($sql);
        $st->execute(['id' => $id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->mapRow($row) : null;
    }

    /** @return array<string,mixed>|null */
    public function getDecryptedBlobById(int $id, bool $includeDeleted = false): ?array
    {
        if ($id <= 0) return null;
        $deletedSql = $includeDeleted ? '' : ' AND d.deleted_at IS NULL';
        $sql = "SELECT d.*, e.title AS event_title,
                       u.name AS uploader_name, u.login AS uploader_login,
                       m.user_id AS message_user_id
                FROM documents d
                LEFT JOIN events e ON e.id COLLATE utf8mb4_unicode_ci = d.event_id
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                LEFT JOIN event_messages m ON m.id = d.message_id
                WHERE d.id = :id{$deletedSql}
                LIMIT 1";
        $st = $this->db->prepare($sql);
        $st->execute(['id' => $id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;

        $mapped = $this->mapRow($row);
        $blob = $this->crypto->decrypt(
            (string)($row['file_blob'] ?? ''),
            (string)($row['iv'] ?? ''),
            (string)($row['auth_tag'] ?? ''),
            (int)($row['key_version'] ?? 0),
            (string)($row['cipher'] ?? '')
        );
        $mapped['blob'] = $blob;
        return $mapped;
    }

    public function softDeleteById(int $id, int $deleterUserId): ?array
    {
        if ($id <= 0) throw new \InvalidArgumentException('id required');
        if ($deleterUserId <= 0) throw new \InvalidArgumentException('deleter_user_id required');
        $current = $this->getById($id, false);
        if (!$current) return null;
        $sql = 'UPDATE documents
                SET deleted_at = NOW(), deleted_by_user_id = :uid
                WHERE id = :id AND deleted_at IS NULL';
        $st = $this->db->prepare($sql);
        $st->execute(['id' => $id, 'uid' => $deleterUserId]);
        return $this->getById($id, true);
    }

    public function listForCabinet(int $viewerUserId, bool $isAdmin, int $limit = 200, int $offset = 0): array
    {
        $limit = max(1, min(500, $limit));
        $offset = max(0, $offset);
        $where = 'WHERE d.deleted_at IS NULL';
        $params = [];
        if (!$isAdmin) {
            $where .= ' AND d.uploaded_by_user_id = :viewer';
            $params['viewer'] = $viewerUserId;
        }
        $sql = "SELECT d.*, e.title AS event_title,
                       u.name AS uploader_name, u.login AS uploader_login,
                       m.user_id AS message_user_id
                FROM documents d
                LEFT JOIN events e ON e.id COLLATE utf8mb4_unicode_ci = d.event_id
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                LEFT JOIN event_messages m ON m.id = d.message_id
                {$where}
                ORDER BY d.created_at DESC, d.id DESC
                LIMIT {$limit} OFFSET {$offset}";
        $st = $this->db->prepare($sql);
        $st->execute($params);
        return array_map([$this, 'mapRow'], $st->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function mapRow(array $row): array
    {
        $uploaderName = trim((string)($row['uploader_name'] ?? ''));
        $uploaderLogin = trim((string)($row['uploader_login'] ?? ''));
        $uploaderDisplay = $uploaderName !== '' ? $uploaderName : ($uploaderLogin !== '' ? $uploaderLogin : ('User #' . (int)($row['uploaded_by_user_id'] ?? 0)));
        $id = (int)($row['id'] ?? 0);
        return [
            'id' => $id,
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
            'deleted_at' => $row['deleted_at'] ?? null,
            'deleted_by_user_id' => isset($row['deleted_by_user_id']) ? (int)$row['deleted_by_user_id'] : null,
            'event_title' => (string)($row['event_title'] ?? ''),
            'uploader' => [
                'id' => (int)($row['uploaded_by_user_id'] ?? 0),
                'name' => $uploaderName,
                'login' => $uploaderLogin,
                'display' => $uploaderDisplay,
            ],
            'message_user_id' => isset($row['message_user_id']) ? (int)$row['message_user_id'] : null,
            'view_url' => '/api/documents/view?id=' . $id,
            'download_url' => '/api/documents/download?id=' . $id,
        ];
    }
}
