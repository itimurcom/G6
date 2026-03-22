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
        $deletedSql = $includeDeleted
            ? ''
            : ' AND d.deleted_at IS NULL AND (d.message_id IS NULL OR m.deleted_at IS NULL)';
        $sql = $this->metadataSelectSql() .
                $this->metadataFromSql() .
               " WHERE d.message_id = :message_id{$deletedSql}
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
        $deletedSql = $includeDeleted
            ? ''
            : ' AND d.deleted_at IS NULL AND (d.message_id IS NULL OR m.deleted_at IS NULL)';
        $sql = $this->metadataSelectSql() .
                $this->metadataFromSql() .
               " WHERE d.event_id = :event_id{$deletedSql}
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

        if ($includeDeleted) {
            $sql = 'SELECT COUNT(*) FROM documents WHERE event_id = :event_id';
        } else {
            $sql = 'SELECT COUNT(*)
                    FROM documents d
                    LEFT JOIN event_messages m ON m.id = d.message_id
                    WHERE d.event_id = :event_id
                      AND d.deleted_at IS NULL
                      AND (d.message_id IS NULL OR m.deleted_at IS NULL)';
        }

        $st = $this->db->prepare($sql);
        $st->execute(['event_id' => $eventId]);
        return (int)$st->fetchColumn();
    }

    public function countByMessageId(int $messageId, bool $includeDeleted = false): int
    {
        if ($messageId <= 0) return 0;

        if ($includeDeleted) {
            $sql = 'SELECT COUNT(*) FROM documents WHERE message_id = :message_id';
        } else {
            $sql = 'SELECT COUNT(*)
                    FROM documents d
                    LEFT JOIN event_messages m ON m.id = d.message_id
                    WHERE d.message_id = :message_id
                      AND d.deleted_at IS NULL
                      AND (d.message_id IS NULL OR m.deleted_at IS NULL)';
        }

        $st = $this->db->prepare($sql);
        $st->execute(['message_id' => $messageId]);
        return (int)$st->fetchColumn();
    }

    public function getById(int $id, bool $includeDeleted = true): ?array
    {
        if ($id <= 0) return null;
        $deletedSql = $includeDeleted
            ? ''
            : ' AND d.deleted_at IS NULL AND (d.message_id IS NULL OR m.deleted_at IS NULL)';
        $sql = $this->metadataSelectSql() .
                $this->metadataFromSql() .
               " WHERE d.id = :id{$deletedSql}
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
        $deletedSql = $includeDeleted
            ? ''
            : ' AND d.deleted_at IS NULL AND (d.message_id IS NULL OR m.deleted_at IS NULL)';
        $sql = $this->binarySelectSql() .
                $this->metadataFromSql() .
               " WHERE d.id = :id{$deletedSql}
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

    public function softDeleteByMessageId(int $messageId, int $deleterUserId): int
    {
        if ($messageId <= 0) {
            throw new \InvalidArgumentException('message_id required');
        }
        if ($deleterUserId <= 0) {
            throw new \InvalidArgumentException('deleter_user_id required');
        }

        $sql = 'UPDATE documents
                SET deleted_at = NOW(),
                    deleted_by_user_id = :uid
                WHERE message_id = :message_id
                  AND deleted_at IS NULL';
        $st = $this->db->prepare($sql);
        $st->execute([
            'message_id' => $messageId,
            'uid' => $deleterUserId,
        ]);

        return (int)$st->rowCount();
    }

    public function searchByOriginalName(string $query, ?string $eventType = null, int $limit = 50, int $offset = 0): array
    {
        $query = trim($query);
        if ($query === '') return [];

        $limit = max(1, min(200, $limit));
        $offset = max(0, $offset);
        $params = [];
        $tokens = $this->tokenizeSearchQuery($query);
        $searchSql = $this->buildLikeOrSqlMulti(
            ['d.original_name', 'e.title', 'm.message_text', 'u.name', 'u.login', 'd.mime_type'],
            $tokens,
            'dq',
            $params
        );

        $typeSql = '';
        $eventType = trim((string)($eventType ?? ''));
        if ($eventType !== '' && $eventType !== 'all') {
            $typeSql = ' AND e.type = :event_type';
            $params['event_type'] = $eventType;
        }

        $sql = $this->metadataSelectSql() .
                $this->metadataFromSql() .
               " WHERE d.deleted_at IS NULL
                  AND (d.message_id IS NULL OR m.deleted_at IS NULL)
                  AND {$searchSql}{$typeSql}
                ORDER BY d.created_at DESC, d.id DESC
                LIMIT {$limit} OFFSET {$offset}";
        $st = $this->db->prepare($sql);
        $st->execute($params);
        return array_map([$this, 'mapRow'], $st->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function listForCabinet(
        int $viewerUserId,
        bool $isAdmin,
        int $limit = 200,
        int $offset = 0,
        string $q = '',
        string $scope = 'mine',
        string $type = 'all',
        string $sort = 'newest'
    ): array {
        $limit = max(1, min(500, $limit));
        $offset = max(0, $offset);
        $params = [];
        $where = $this->buildCabinetWhereSql($viewerUserId, $isAdmin, $q, $scope, $type, $params);
        $order = $this->buildCabinetOrderSql($sort);

        $sql = $this->metadataSelectSql() .
                $this->metadataFromSql() .
                $where .
                $order .
               " LIMIT {$limit} OFFSET {$offset}";
        $st = $this->db->prepare($sql);
        $st->execute($params);
        return array_map([$this, 'mapRow'], $st->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function countForCabinet(
        int $viewerUserId,
        bool $isAdmin,
        string $q = '',
        string $scope = 'mine',
        string $type = 'all'
    ): int {
        $params = [];
        $where = $this->buildCabinetWhereSql($viewerUserId, $isAdmin, $q, $scope, $type, $params);
        $sql = 'SELECT COUNT(*)' .
               $this->metadataFromSql() .
               $where;
        $st = $this->db->prepare($sql);
        $st->execute($params);
        return (int)$st->fetchColumn();
    }

    /** @param array<string> $columns @param array<string> $tokens @param array<string,mixed> $params */
    private function buildLikeOrSqlMulti(array $columns, array $tokens, string $paramPrefix, array &$params): string
    {
        $parts = [];
        foreach ($tokens as $tokenIndex => $token) {
            foreach ($columns as $columnIndex => $column) {
                $paramName = $paramPrefix . '_' . $tokenIndex . '_' . $columnIndex;
                $parts[] = $column . ' LIKE :' . $paramName;
                $params[$paramName] = '%' . $token . '%';
            }
        }

        if ($parts === []) {
            $paramName = $paramPrefix . '_fallback';
            $params[$paramName] = '%%';
            return 'd.original_name LIKE :' . $paramName;
        }

        return '(' . implode(' OR ', $parts) . ')';
    }

    /** @return array<int,string> */
    private function tokenizeSearchQuery(string $query): array
    {
        $query = trim($query);
        if ($query === '') {
            return [];
        }

        $parts = preg_split('/[\s\p{Zs}]+/u', $query) ?: [];
        $tokens = [];
        $seen = [];

        foreach ($parts as $part) {
            $part = trim((string)$part);
            if ($part === '') {
                continue;
            }

            $length = function_exists('mb_strlen')
                ? (int)mb_strlen($part, 'UTF-8')
                : strlen($part);

            if ($length < 2 && !preg_match('/^\d+$/', $part)) {
                continue;
            }

            $key = function_exists('mb_strtolower')
                ? (string)mb_strtolower($part, 'UTF-8')
                : strtolower($part);

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $tokens[] = $part;
        }

        if ($tokens === []) {
            $tokens[] = $query;
        }

        return $tokens;
    }

    private function metadataSelectSql(): string
    {
        return "SELECT d.id, d.event_id, d.message_id, d.uploaded_by_user_id,
                       d.original_name, d.mime_type, d.file_size, d.is_image, d.sha256,
                       d.created_at, d.deleted_at, d.deleted_by_user_id,
                       e.title AS event_title,
                       e.start_date AS event_date,
                       e.time AS event_time,
                       e.type AS event_type,
                       u.name AS uploader_name, u.login AS uploader_login,
                       m.user_id AS message_user_id,
                       m.message_text AS message_text";
    }

    private function binarySelectSql(): string
    {
        return "SELECT d.id, d.event_id, d.message_id, d.uploaded_by_user_id,
                       d.original_name, d.mime_type, d.file_size, d.is_image, d.sha256,
                       d.cipher, d.key_version, d.iv, d.auth_tag, d.file_blob,
                       d.created_at, d.deleted_at, d.deleted_by_user_id,
                       e.title AS event_title,
                       e.start_date AS event_date,
                       e.time AS event_time,
                       e.type AS event_type,
                       u.name AS uploader_name, u.login AS uploader_login,
                       m.user_id AS message_user_id,
                       m.message_text AS message_text";
    }

    private function metadataFromSql(): string
    {
        return ' FROM documents d
                LEFT JOIN events e ON e.id COLLATE utf8mb4_unicode_ci = d.event_id
                LEFT JOIN users u ON u.id = d.uploaded_by_user_id
                LEFT JOIN event_messages m ON m.id = d.message_id';
    }

    /** @param array<string,mixed> $params */
    private function buildCabinetWhereSql(
        int $viewerUserId,
        bool $isAdmin,
        string $q,
        string $scope,
        string $type,
        array &$params
    ): string {
        $where = ' WHERE d.deleted_at IS NULL AND (d.message_id IS NULL OR m.deleted_at IS NULL)';

        $scope = $this->normalizeCabinetScope($scope, $isAdmin);
        if ($scope !== 'all') {
            $where .= ' AND d.uploaded_by_user_id = :viewer';
            $params['viewer'] = max(0, $viewerUserId);
        }

        $q = trim($q);
        if ($q !== '') {
            $tokens = $this->tokenizeSearchQuery($q);
            $where .= ' AND ' . $this->buildLikeOrSqlMulti(
                ['d.original_name', 'e.title', 'm.message_text', 'u.name', 'u.login', 'd.mime_type', 'd.event_id'],
                $tokens,
                'cabq',
                $params
            );
        }

        $typeWhere = $this->buildCabinetTypeWhereSql($this->normalizeCabinetType($type));
        if ($typeWhere !== '') {
            $where .= ' AND ' . $typeWhere;
        }

        return $where;
    }

    private function buildCabinetOrderSql(string $sort): string
    {
        return match ($this->normalizeCabinetSort($sort)) {
            'oldest' => ' ORDER BY d.created_at ASC, d.id ASC',
            'name_asc' => ' ORDER BY d.original_name ASC, d.id ASC',
            'name_desc' => ' ORDER BY d.original_name DESC, d.id DESC',
            'size_desc' => ' ORDER BY d.file_size DESC, d.id DESC',
            'size_asc' => ' ORDER BY d.file_size ASC, d.id ASC',
            default => ' ORDER BY d.created_at DESC, d.id DESC',
        };
    }

    private function normalizeCabinetScope(string $scope, bool $isAdmin): string
    {
        $scope = strtolower(trim($scope));
        if ($isAdmin && $scope === 'all') {
            return 'all';
        }
        return 'mine';
    }

    private function normalizeCabinetType(string $type): string
    {
        $type = strtolower(trim($type));
        return in_array($type, ['all', 'image', 'pdf', 'spreadsheet', 'archive', 'other'], true)
            ? $type
            : 'all';
    }

    private function normalizeCabinetSort(string $sort): string
    {
        $sort = strtolower(trim($sort));
        return in_array($sort, ['newest', 'oldest', 'name_asc', 'name_desc', 'size_desc', 'size_asc'], true)
            ? $sort
            : 'newest';
    }

    private function buildCabinetTypeWhereSql(string $type): string
    {
        $pdf = $this->sqlPredicatePdf();
        $spreadsheet = $this->sqlPredicateSpreadsheet();
        $archive = $this->sqlPredicateArchive();

        return match ($type) {
            'image' => 'd.is_image = 1',
            'pdf' => $pdf,
            'spreadsheet' => $spreadsheet,
            'archive' => $archive,
            'other' => '(d.is_image = 0 AND NOT (' . $pdf . ' OR ' . $spreadsheet . ' OR ' . $archive . '))',
            default => '',
        };
    }

    private function sqlPredicatePdf(): string
    {
        return "(LOWER(d.mime_type) = 'application/pdf' OR LOWER(d.original_name) LIKE '%.pdf')";
    }

    private function sqlPredicateSpreadsheet(): string
    {
        return "(
            LOWER(d.mime_type) IN (
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/csv',
                'application/csv',
                'application/vnd.oasis.opendocument.spreadsheet'
            )
            OR LOWER(d.original_name) LIKE '%.xls'
            OR LOWER(d.original_name) LIKE '%.xlsx'
            OR LOWER(d.original_name) LIKE '%.csv'
            OR LOWER(d.original_name) LIKE '%.ods'
        )";
    }

    private function sqlPredicateArchive(): string
    {
        return "(
            LOWER(d.mime_type) IN (
                'application/zip',
                'application/x-zip-compressed',
                'application/x-7z-compressed',
                'application/x-rar-compressed',
                'application/vnd.rar',
                'application/gzip',
                'application/x-gzip',
                'application/x-tar'
            )
            OR LOWER(d.original_name) LIKE '%.zip'
            OR LOWER(d.original_name) LIKE '%.7z'
            OR LOWER(d.original_name) LIKE '%.rar'
            OR LOWER(d.original_name) LIKE '%.tar'
            OR LOWER(d.original_name) LIKE '%.gz'
            OR LOWER(d.original_name) LIKE '%.tgz'
        )";
    }

    private function detectTypeGroup(array $row): string
    {
        if (!empty($row['is_image'])) {
            return 'image';
        }

        $mime = strtolower(trim((string)($row['mime_type'] ?? '')));
        $name = strtolower(trim((string)($row['original_name'] ?? '')));

        $isPdf = $mime === 'application/pdf' || str_ends_with($name, '.pdf');
        if ($isPdf) {
            return 'pdf';
        }

        $spreadsheetMimes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'application/csv',
            'application/vnd.oasis.opendocument.spreadsheet',
        ];
        if (in_array($mime, $spreadsheetMimes, true)
            || preg_match('/\.(xls|xlsx|csv|ods)$/', $name)) {
            return 'spreadsheet';
        }

        $archiveMimes = [
            'application/zip',
            'application/x-zip-compressed',
            'application/x-7z-compressed',
            'application/x-rar-compressed',
            'application/vnd.rar',
            'application/gzip',
            'application/x-gzip',
            'application/x-tar',
        ];
        if (in_array($mime, $archiveMimes, true)
            || preg_match('/\.(zip|7z|rar|tar|gz|tgz)$/', $name)) {
            return 'archive';
        }

        return 'other';
    }

    private function mapRow(array $row): array
    {
        $uploaderName = trim((string)($row['uploader_name'] ?? ''));
        $uploaderLogin = trim((string)($row['uploader_login'] ?? ''));
        $uploaderDisplay = $uploaderName !== '' ? $uploaderName : ($uploaderLogin !== '' ? $uploaderLogin : ('User #' . (int)($row['uploaded_by_user_id'] ?? 0)));
        $id = (int)($row['id'] ?? 0);
        $typeGroup = $this->detectTypeGroup($row);
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
            'event_date' => (string)($row['event_date'] ?? ''),
            'event_time' => (string)($row['event_time'] ?? ''),
            'event_type' => (string)($row['event_type'] ?? ''),
            'message_preview' => (string)($row['message_text'] ?? ''),
            'type_group' => $typeGroup,
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
