<?php
declare(strict_types=1);

namespace App\Controllers\Traits;

use App\Core\Auth;

/**
 * ApiCommonTrait
 *
 * Спільна службова обвʼязка для API-контролерів:
 *  - json()/parseJson()
 *  - requireCsrf()
 *  - currentUser()/isAdmin()/currentUserDisplay()
 */
trait ApiCommonTrait
{
    /**
     * Віддає JSON у відповідь.
     * @param mixed $data
     */
    protected function json($data, int $code = 200): void
    {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            http_response_code($code);
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    protected function parseJson(): ?array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') return [];
        $payload = json_decode($raw, true);
        return is_array($payload) ? $payload : null;
    }

    /**
     * Перевірка CSRF токена: form field або заголовок X-CSRF-Token.
     */
    protected function requireCsrf(?string $provided = null): bool
    {
        if (\App\Security\Csrf::validateAny($provided)) {
            return true;
        }
        $this->json([
            'ok' => false,
            'error' => 'csrf',
            'message' => 'Invalid or missing CSRF token',
        ], 403);
        return false;
    }

    protected function currentUser(): array
    {
        return Auth::user() ?? [];
    }

    protected function isAdmin(array $user): bool
    {
        $role = strtolower((string)($user['role'] ?? ''));
        return $role === 'admin' || !empty($user['is_admin']);
    }

    protected function currentUserDisplay(array $user): string
    {
        $name = trim((string)($user['name'] ?? ''));
        if ($name !== '') return $name;
        $login = trim((string)($user['login'] ?? ''));
        if ($login !== '') return $login;
        $id = (int)($user['id'] ?? 0);
        return $id > 0 ? ('User #' . $id) : 'Користувач';
    }
}
