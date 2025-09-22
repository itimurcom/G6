<?php
namespace App\Models;

final class UserFileRepository implements UserRepositoryInterface
{
    private string $path;

    public function __construct(?string $path=null) {
        $dir = __DIR__ . '/../../storage/data';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        $this->path = $path ?: ($dir . '/users.json');
        if (!file_exists($this->path)) file_put_contents($this->path, json_encode(['last_id'=>0,'rows'=>[]], JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
    }

    private function read(): array {
        $json = @file_get_contents($this->path);
        $data = json_decode($json ?: '', true);
        if (!is_array($data)) $data = ['last_id'=>0,'rows'=>[]];
        if (!isset($data['rows']) || !is_array($data['rows'])) $data['rows'] = [];
        if (!isset($data['last_id'])) $data['last_id'] = 0;
        return $data;
    }

    private function write(array $data): void {
        $json = json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new \RuntimeException('users.json encode failed');
        }
        $bytes = @file_put_contents($this->path, $json, LOCK_EX);
        if ($bytes === false) {
            $err = error_get_last();
            throw new \RuntimeException('users.json write failed: ' . ($err['message'] ?? 'unknown'));
        }
    }

    public function findById(int $id): ?array {
        $data = $this->read();
        foreach ($data['rows'] as $u) if ((int)($u['id'] ?? 0) === $id) return $u;
        return null;
    }

    public function findByLogin(string $login): ?array {
        $login = mb_strtolower(trim($login));
        $data = $this->read();
        foreach ($data['rows'] as $u) {
            $ulog = isset($u['login']) ? mb_strtolower($u['login']) : null;
            $uold = isset($u['email']) ? mb_strtolower($u['email']) : null; // backward-compat
            if ($ulog === $login || $uold === $login) return $u;
        }
        return null;
    }

    public function create(array $data): int {
        $d = $this->read();
        $id = (int)$d['last_id'] + 1;
        $row = [
            'id'            => $id,
            'name'          => (string)($data['name'] ?? ''),
            'login'         => (string)($data['login'] ?? ''),
            'password_hash' => (string)($data['password_hash'] ?? ''),
            'role'          => (string)($data['role'] ?? 'user'),
            'created_at'    => date('c'),
            'updated_at'    => date('c'),
        ];
        $d['rows'][] = $row;
        $d['last_id'] = $id;
        $this->write($d);
        return $id;
    }
}
