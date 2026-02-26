<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

class UserMysqlRepository implements UserRepositoryInterface {
    private PDO $db;
    private static bool $avatarSchemaEnsured = false;

    private const SAFE_SELECT = "id, name, login, email, password_hash, role, is_admin, created_at, updated_at, avatar_mime, avatar_filename, avatar_updated_at";

    public function __construct() {
        $this->db = Database::connect();
        $this->ensureAvatarSchema();
    }

    public function all(): array {
        $rows = $this->db->query("SELECT " . self::SAFE_SELECT . " FROM users ORDER BY id ASC")->fetchAll();
        return array_map([$this, 'decorateUserRow'], is_array($rows) ? $rows : []);
    }

    public function findById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT " . self::SAFE_SELECT . " FROM users WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch() ?: null;
        return is_array($row) ? $this->decorateUserRow($row) : null;
    }

    public function findByLogin(string $login): ?array {
        $stmt = $this->db->prepare("SELECT " . self::SAFE_SELECT . " FROM users WHERE login = ? OR email = ?");
        $stmt->execute([$login, $login]);
        $row = $stmt->fetch() ?: null;
        return is_array($row) ? $this->decorateUserRow($row) : null;
    }
    
    public function findByEmail(string $email): ?array {
        return $this->findByLogin($email);
    }

    public function create(array $data): int {
        $sql = "INSERT INTO users (name, login, email, password_hash, role, is_admin) 
                VALUES (:name, :login, :email, :pass, :role, :admin)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'name' => $data['name'] ?? '',
            'login' => $data['login'],
            'email' => $data['email'] ?? null,
            'pass' => $data['password_hash'] ?? '',
            'role' => $data['role'] ?? 'user',
            'admin' => !empty($data['is_admin']) ? 1 : 0
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function updateById(int $id, array $data): bool {
        $fields = [];
        $params = ['id' => $id];
        foreach ($data as $k => $v) {
            if ($k === 'id') continue;
            $fields[] = "$k = :$k";
            $params[$k] = $v;
        }
        if (!$fields) return false;
        $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = :id";
        return $this->db->prepare($sql)->execute($params);
    }

    /**
     * Lightweight search for autocomplete.
     * Returns only safe fields.
     */
    public function search(string $q, int $limit = 10): array {
        $q = trim((string)$q);
        if ($q === '') return [];

        $limit = max(1, min(25, (int)$limit));
        $like = '%' . $q . '%';

        $sql = "SELECT id, login, name, email, role, is_admin, avatar_mime, avatar_filename, avatar_updated_at
                FROM users
                WHERE login LIKE ? OR name LIKE ? OR email LIKE ?
                ORDER BY login ASC
                LIMIT {$limit}";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$like, $like, $like]);
        $rows = $stmt->fetchAll();
        return array_map([$this, 'decorateUserRow'], is_array($rows) ? $rows : []);
    }

    public function getAvatarById(int $id): ?array
    {
        if ($id <= 0) return null;
        $stmt = $this->db->prepare("SELECT id, avatar_blob, avatar_mime, avatar_filename, avatar_updated_at FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        $blob = $row['avatar_blob'] ?? null;
        if ($blob === null || $blob === '') return null;
        return [
            'id' => (int)($row['id'] ?? 0),
            'blob' => $blob,
            'mime' => (string)($row['avatar_mime'] ?? 'application/octet-stream'),
            'filename' => (string)($row['avatar_filename'] ?? ''),
            'updated_at' => $row['avatar_updated_at'] ?? null,
        ];
    }

    public function setAvatarById(int $id, string $blob, string $mime, string $filename): bool
    {
        if ($id <= 0 || $blob === '' || trim($mime) === '') return false;
        $sql = "UPDATE users
                SET avatar_blob = :blob,
                    avatar_mime = :mime,
                    avatar_filename = :filename,
                    avatar_updated_at = NOW()
                WHERE id = :id";
        return $this->db->prepare($sql)->execute([
            'id' => $id,
            'blob' => $blob,
            'mime' => trim($mime),
            'filename' => trim($filename),
        ]);
    }

    public function clearAvatarById(int $id): bool
    {
        if ($id <= 0) return false;
        $sql = "UPDATE users
                SET avatar_blob = NULL,
                    avatar_mime = NULL,
                    avatar_filename = NULL,
                    avatar_updated_at = NOW()
                WHERE id = :id";
        return $this->db->prepare($sql)->execute(['id' => $id]);
    }

    private function decorateUserRow(array $row): array
    {
        $hasAvatar = !empty($row['avatar_mime']) || !empty($row['avatar_filename']) || !empty($row['avatar_updated_at']);
        $id = (int)($row['id'] ?? 0);
        $row['has_avatar'] = $hasAvatar;
        $row['avatar_url'] = $hasAvatar && $id > 0 ? $this->buildAvatarUrl($id, (string)($row['avatar_updated_at'] ?? '')) : null;
        $row['avatar_version'] = (string)($row['avatar_updated_at'] ?? '');
        return $row;
    }

    private function buildAvatarUrl(int $id, string $version = ''): string
    {
        $url = '/api/users/avatar?id=' . $id;
        if ($version !== '') {
            $url .= '&v=' . rawurlencode($version);
        }
        return $url;
    }

    private function ensureAvatarSchema(): void
    {
        if (self::$avatarSchemaEnsured) return;

        try {
            $existing = [];
            $st = $this->db->query("SHOW COLUMNS FROM users");
            foreach (($st ? $st->fetchAll(PDO::FETCH_ASSOC) : []) as $col) {
                $existing[strtolower((string)($col['Field'] ?? ''))] = true;
            }

            $queries = [];
            if (!isset($existing['avatar_blob'])) {
                $queries[] = "ALTER TABLE users ADD COLUMN avatar_blob MEDIUMBLOB NULL AFTER updated_at";
            }
            if (!isset($existing['avatar_mime'])) {
                $queries[] = "ALTER TABLE users ADD COLUMN avatar_mime VARCHAR(191) NULL AFTER avatar_blob";
            }
            if (!isset($existing['avatar_filename'])) {
                $queries[] = "ALTER TABLE users ADD COLUMN avatar_filename VARCHAR(255) NULL AFTER avatar_mime";
            }
            if (!isset($existing['avatar_updated_at'])) {
                $queries[] = "ALTER TABLE users ADD COLUMN avatar_updated_at DATETIME NULL AFTER avatar_filename";
            }

            foreach ($queries as $sql) {
                $this->db->exec($sql);
            }
        } catch (\Throwable $e) {
            // avatar schema prep must never break auth/app boot
        }

        self::$avatarSchemaEnsured = true;
    }
}
