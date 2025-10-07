<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\UserFileRepository;

final class ApiUsersController
{
    private $users;

    public function __construct()
    {
        $this->users = new UserFileRepository();
    }

    private function json($data, int $code = 200): void
    {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            http_response_code($code);
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
    }

    public function get(): void
    {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }
        try {
            $u = $this->users->findById($id);
            if (!$u) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }
            $name = (string)($u['name'] ?? ($u['login'] ?? ('User #'.$id)));
            $this->json(['ok'=>true, 'user'=>['id'=>$id,'name'=>$name,'login'=>($u['login']??null),'email'=>($u['email']??null)]]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }
}
