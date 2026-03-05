<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\UserNameResolver;
use App\Controllers\Traits\ApiCommonTrait;

/**
 * GET /api/users/name?id=123
 * Returns { ok:true, id:123, name:"..." } or an error payload.
 */
final class ApiUserNameController
{
    use ApiCommonTrait;

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

    // json() is provided by ApiCommonTrait
}
