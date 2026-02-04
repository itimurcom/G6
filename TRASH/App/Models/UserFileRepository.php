<?php
namespace App\Models;

final class UserFileRepository implements UserRepositoryInterface
{
    private string $file;
    private string $root;

    public function __construct()
    {
        $this->root = \dirname(__DIR__, 2);
        $this->file = $this->root . '/storage/data/users.json';
    }

    /** Return all users (normalized) */
    public function all(): array
    {
        $db = $this->loadDb();
        return $db['rows'];
    }

    public function findById(int $id): ?array
    {
        if ($id <= 0) return null;
        foreach ($this->all() as $u) {
            if ((int)($u['id'] ?? 0) === $id) return $u;
        }
        return null;
    }

    public function findByEmail(string $email): ?array
    {
        $needle = mb_strtolower(trim($email));
        if ($needle === '') return null;
        foreach ($this->all() as $u) {
            if (mb_strtolower((string)($u['email'] ?? '')) === $needle) return $u;
        }
        return null;
    }

    public function findByLogin(string $login): ?array
    {
        $needle = mb_strtolower(trim($login));
        if ($needle === '') return null;
        foreach ($this->all() as $u) {
            $log = mb_strtolower((string)($u['login'] ?? ($u['username'] ?? '')));
            if ($log === $needle) return $u;
            if (mb_strtolower((string)($u['email'] ?? '')) === $needle) return $u; // allow email in login field
        }
        return null;
    }

    /** Update fields for user by id; supports wrapper {last_id, rows} and flat array */
    public function updateById(int $id, array $data): bool
    {
        $db = $this->loadDb(raw: true); // raw to preserve wrapper if present
        $changed = false;

        if (isset($db['rows']) && is_array($db['rows'])) {
            foreach ($db['rows'] as &$row) {
                if ((int)($row['id'] ?? 0) === $id) {
                    foreach ($data as $k => $v) $row[$k] = $v;
                    if (!isset($row['updated_at'])) $row['updated_at'] = date('c');
                    $changed = true;
                    break;
                }
            }
            unset($row);
            if ($changed) return $this->saveDb($db);
        } elseif (is_array($db)) {
            // flat array format
            foreach ($db as &$row) {
                if ((int)($row['id'] ?? 0) === $id) {
                    foreach ($data as $k => $v) $row[$k] = $v;
                    if (!isset($row['updated_at'])) $row['updated_at'] = date('c');
                    $changed = true;
                    break;
                }
            }
            unset($row);
            if ($changed) {
                $wrapped = ['last_id' => $this->maxId($db), 'rows' => $db];
                return $this->saveDb($wrapped);
            }
        }
        return false;
    }

    // ------------- internal helpers -------------

    private function loadDb(bool $raw = false): array
    {
        $path = $this->file;
        if (!is_file($path)) {
            // prefer storage path if directory exists
            $storage = $this->root . '/storage/data/users.json';
            if (is_file($storage)) $path = $storage;
        }
        $json = @file_get_contents($path);
        $db = $json ? json_decode($json, true) : null;

        if (!is_array($db)) {
            $db = ['last_id' => 0, 'rows' => []];
        }

        if ($raw) return $db;

        if (isset($db['rows']) && is_array($db['rows'])) {
            $rows = $db['rows'];
            $last = (int)($db['last_id'] ?? $this->maxId($rows));
        } else {
            $rows = is_array($db) ? $db : [];
            $last = $this->maxId($rows);
        }
        return ['last_id' => $last, 'rows' => $rows];
    }

    private function saveDb(array $db): bool
    {
        $storageDir = $this->root . '/storage/data';
        $path = is_dir($storageDir) ? ($storageDir . '/users.json') : $this->file;

        // ensure dir exists
        @mkdir(dirname($path), 0775, true);

        // backup
        @mkdir($this->root . '/storage/backups', 0775, true);
        if (is_file($path)) {
            @copy($path, $this->root . '/storage/backups/users_' . date('Ymd_His') . '.json');
        }

        $json = json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) return false;
        return (file_put_contents($path, $json, LOCK_EX) !== false);
    }

    private function maxId(array $rows): int
    {
        $m = 0;
        foreach ($rows as $r) {
            $id = (int)($r['id'] ?? 0);
            if ($id > $m) $m = $id;
        }
        return $m;
    }
    
     /** Create a user and return its numeric ID */
    public function create(array $data): int
    {
        // Load raw DB to preserve wrapper shape if present
        $db = $this->loadDb(raw: true);

        // Normalize to wrapper format { last_id, rows }
        if (!isset($db['rows']) || !is_array($db['rows'])) {
            $rows = is_array($db) ? $db : [];
            $db = [
                'last_id' => $this->maxId($rows),
                'rows'    => $rows,
            ];
        }

        $rows = $db['rows'];
        $last = (int)($db['last_id'] ?? 0);
        // Be safe if file was edited manually
        $nextId = max($last, $this->maxId($rows)) + 1;

        $row = $data;
        $row['id'] = $nextId;
        if (!isset($row['created_at'])) $row['created_at'] = date('c');
        if (!isset($row['updated_at'])) $row['updated_at'] = $row['created_at'];

        $db['rows'][] = $row;
        $db['last_id'] = $nextId;

        if (!$this->saveDb($db)) {
            throw new \RuntimeException('Failed to save users.json');
        }
        return $nextId;
    }
}
