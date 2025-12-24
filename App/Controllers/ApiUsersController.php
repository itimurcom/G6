<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\UserMysqlRepository; // <--- ЗМІНЕНО: Підключаємо MySQL репозиторій

final class ApiUsersController
{
    private $users;

    public function __construct()
    {
        // <--- ЗМІНЕНО: Створюємо екземпляр MySQL репозиторія
        $this->users = new UserMysqlRepository();
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

    public function me(): void
    {
        try {
            // Fast path: use cached session profile if available
            $sessUser = null;
            try { $sessUser = \App\Core\Session::get('user', null); } catch (\Throwable $__){ }

            if (is_array($sessUser) && (int)($sessUser['id'] ?? 0) > 0) {
                $id   = (int)$sessUser['id'];
                $name = (string)($sessUser['name'] ?? ($sessUser['login'] ?? ('User #'.$id)));
                $this->json(['ok'=>true, 'user'=>[
                    'id'    => $id,
                    'name'  => $name,
                    'login' => $sessUser['login'] ?? null,
                    'email' => $sessUser['email'] ?? null,
                    'role'  => $sessUser['role'] ?? null,
                ]]);
                return;
            }

            $uid = (int)(\App\Core\Session::get('user_id', 0));
            if ($uid <= 0) { $this->json(['ok'=>false,'error'=>'unauthorized'], 401); return; }

            $u = $this->users->findById($uid);
            if (!$u) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }

            $name = (string)($u['name'] ?? ($u['login'] ?? ('User #'.$uid)));

            $this->json(['ok'=>true, 'user'=>[
                'id'    => (int)($u['id'] ?? $uid),
                'name'  => $name,
                'login' => $u['login'] ?? null,
                'email' => $u['email'] ?? null,
                'role'  => $u['role'] ?? null,
            ]]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
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