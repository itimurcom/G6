<?php
declare(strict_types=1);

namespace App\Models;

/**
 * Lightweight helper to resolve a user's display name by numeric id.
 * Reads from storage/data/users.json directly to avoid coupling with other repos.
 */
final class UserNameResolver
{
    private string $file;

    public function __construct(?string $file = null)
    {
        $root = \dirname(__DIR__, 2);
        $this->file = $file ?: ($root . '/storage/data/users.json');
    }

    /** Returns the preferred display name by user id, or null if not found. */
    public function getNameById(int $id): ?string
    {
        if ($id <= 0) return null;
        if (!is_file($this->file)) return null;

        $raw = file_get_contents($this->file);
        if ($raw === false) return null;

        $data = json_decode($raw, true);
        $rows = [];
        if (isset($data['rows']) && is_array($data['rows'])) {
            $rows = $data['rows'];
        } elseif (is_array($data)) {
            $rows = $data;
        }

        foreach ($rows as $row) {
            if ((int)($row['id'] ?? 0) === $id) {
                $name = (string)($row['name'] ?? '');
                if ($name !== '') return $name;
                $login = (string)($row['login'] ?? '');
                if ($login !== '') return $login;
                return 'User #' . $id;
            }
        }
        return null;
    }
}
