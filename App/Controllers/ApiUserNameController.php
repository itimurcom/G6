<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\UserNameResolver;

/**
 * GET /api/users/name?id=123
 * Returns { ok:true, id:123, name:"..." } or an error payload.
 */
final class ApiUserNameController
{
    private UserNameResolver $resolver;

    public function __construct()
    {
        $this->resolver = new UserNameResolver();
    }

    public function name(): void
    {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if ($id <= 0) {
            $this->json(['ok' => false, 'error' => 'id required'], 400);
            return;
        }
        try {
            $name = $this->resolver->getNameById($id);
            if ($name === null) {
                $this->json(['ok' => false, 'error' => 'not_found'], 404);
                return;
            }
            $this->json(['ok' => true, 'id' => $id, 'name' => $name]);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
        }
    }

    /** Minimal JSON responder (kept local to avoid cross-deps). */
    private function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
