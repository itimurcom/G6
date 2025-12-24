<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

class UserMysqlRepository implements UserRepositoryInterface {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    public function all(): array {
        return $this->db->query("SELECT * FROM users ORDER BY id ASC")->fetchAll();
    }

    public function findById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findByLogin(string $login): ?array {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE login = ? OR email = ?");
        $stmt->execute([$login, $login]);
        return $stmt->fetch() ?: null;
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
}