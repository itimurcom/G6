<?php
declare(strict_types=1);

namespace App\Models;

/**
 * Lightweight helper to resolve a user's display name by numeric id.
 *
 * Stage 1 (no JSON as a data source): resolve via MySQL repository.
 * JSON is allowed only for backup import/export; user resolution must not read users.json.
 */
final class UserNameResolver
{
    private UserRepositoryInterface $repo;

    /** @var array<int, string|null> */
    private array $cache = [];

    public function __construct(?UserRepositoryInterface $repo = null)
    {
        $this->repo = $repo ?: new UserMysqlRepository();
    }

    /** Returns the preferred display name by user id, or null if not found. */
    public function getNameById(int $id): ?string
    {
        if ($id <= 0) return null;

        if (array_key_exists($id, $this->cache)) {
            return $this->cache[$id];
        }

        $u = null;
        try {
            $u = $this->repo->findById($id);
        } catch (\Throwable $e) {
            $u = null;
        }

        if (!is_array($u)) {
            $this->cache[$id] = null;
            return null;
        }

        $name = trim((string)($u['name'] ?? ''));
        if ($name !== '') {
            $this->cache[$id] = $name;
            return $name;
        }

        $login = trim((string)($u['login'] ?? ''));
        if ($login !== '') {
            $this->cache[$id] = $login;
            return $login;
        }

        $fallback = 'User #' . $id;
        $this->cache[$id] = $fallback;
        return $fallback;
    }
}
