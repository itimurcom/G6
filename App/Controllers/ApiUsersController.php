<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\UserMysqlRepository;
use App\Core\Auth;

final class ApiUsersController
{
    private UserMysqlRepository $users;

    public function __construct()
    {
        $this->users = new UserMysqlRepository();
    }

    // --- Допоміжні методи ---

    private function json($data, int $code = 200): void
    {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            http_response_code($code);
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
    }

    private function parseJson(): ?array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') return [];
        $payload = json_decode($raw, true);
        return is_array($payload) ? $payload : null;
    }

    private function checkAdmin(): bool
    {
        $me = Auth::user();
        if (!$me) return false;
        
        $role = strtolower((string)($me['role'] ?? ''));
        return ($role === 'admin' || !empty($me['is_admin']));
    }

    // --- Публічні методи API ---

    /**
     * GET /api/users/search?q=adm&limit=10
     * Autocomplete search for assigning "Responsible".
     * доступно будь-якому авторизованому користувачу
     */
    public function search(): void
    {
        try {
            $uid = Auth::id();
            if (!$uid) {
                $this->json(['ok' => false, 'error' => 'unauthorized'], 401);
                return;
            }

            $q = (string)($_GET['q'] ?? ($_GET['term'] ?? ''));
            $limit = (int)($_GET['limit'] ?? 10);

            $rows = $this->users->search($q, $limit);
            $out = array_map(function($u) {
                return [
                    'id'    => (int)($u['id'] ?? 0),
                    'login' => (string)($u['login'] ?? ''),
                    'name'  => (string)(($u['name'] ?? '') !== '' ? $u['name'] : ($u['login'] ?? '')),
                    'email' => $u['email'] ?? null,
                ];
            }, is_array($rows) ? $rows : []);

            $this->json(['ok' => true, 'users' => $out]);
        } catch (\Throwable $e) {
            $this->json(['ok' => false, 'error' => 'internal', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/users/me
     * Повертає профіль поточного користувача
     */
    public function me(): void
    {
        try {
            $uid = Auth::id();
            if (!$uid) { 
                $this->json(['ok'=>false, 'error'=>'unauthorized'], 401); 
                return; 
            }

            $u = $this->users->findById($uid);
            if (!$u) { 
                $this->json(['ok'=>false, 'error'=>'not_found'], 404); 
                return; 
            }

            // Формуємо безпечну відповідь (без пароля)
            $this->json(['ok'=>true, 'user'=>[
                'id'    => (int)$u['id'],
                'name'  => $u['name'] ?? $u['login'],
                'login' => $u['login'],
                'email' => $u['email'] ?? null,
                'role'  => $u['role'] ?? 'user',
                'is_admin' => !empty($u['is_admin'])
            ]]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false, 'error'=>'internal', 'message'=>$e->getMessage()], 500);
        }
    }

    /**
     * GET /api/users/list
     * Список всіх користувачів (тільки для адміна)
     */
    public function list(): void
    {
        if (!$this->checkAdmin()) {
            $this->json(['ok'=>false, 'error'=>'forbidden'], 403);
            return;
        }

        try {
            $all = $this->users->all();
            // Видаляємо хеші паролів перед відправкою
            $safeList = array_map(function($u) {
                unset($u['password_hash']);
                return $u;
            }, $all);

            $this->json(['ok'=>true, 'users'=>$safeList]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false, 'error'=>'internal', 'message'=>$e->getMessage()], 500);
        }
    }

    /**
     * GET /api/users/get?id=1
     * Отримання одного користувача
     */
    public function get(): void
    {
        if (!$this->checkAdmin()) {
            $this->json(['ok'=>false, 'error'=>'forbidden'], 403);
            return;
        }

        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }

        try {
            $u = $this->users->findById($id);
            if (!$u) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }
            
            unset($u['password_hash']);
            $this->json(['ok'=>true, 'user'=>$u]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    /**
     * POST /api/users/create
     * Створення користувача (Admin only)
     */
    public function create(): void
    {
        if (!$this->checkAdmin()) {
            $this->json(['ok'=>false, 'error'=>'forbidden'], 403);
            return;
        }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }

        try {
            if (empty($payload['login']) || empty($payload['password'])) {
                $this->json(['ok'=>false,'error'=>'login and password required'], 400); 
                return;
            }

            // Перевірка на унікальність логіна
            if ($this->users->findByLogin($payload['login'])) {
                $this->json(['ok'=>false,'error'=>'login_taken'], 400);
                return;
            }

            // Хешування пароля
            $payload['password_hash'] = password_hash($payload['password'], PASSWORD_DEFAULT);
            unset($payload['password']); // Видаляємо відкритий пароль

            // Дефолтні значення
            if (empty($payload['name'])) $payload['name'] = $payload['login'];
            if (empty($payload['role'])) $payload['role'] = 'user';

            $id = $this->users->create($payload);
            
            $this->json(['ok'=>true, 'id'=>$id], 201);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    /**
     * POST /api/users/update
     * Оновлення користувача та зміна пароля
     */
    public function update(): void
    {
        if (!$this->checkAdmin()) {
            $this->json(['ok'=>false, 'error'=>'forbidden'], 403);
            return;
        }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }

        $id = (int)($payload['id'] ?? 0);
        if ($id <= 0) { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }
        unset($payload['id']);

        try {
            // Якщо передано пароль — хешуємо його
            if (!empty($payload['password'])) {
                $payload['password_hash'] = password_hash($payload['password'], PASSWORD_DEFAULT);
                unset($payload['password']);
            }
            
            // Видаляємо поле підтвердження, якщо воно прийшло з форми
            if (isset($payload['password_confirm'])) unset($payload['password_confirm']);

            $ok = $this->users->updateById($id, $payload);
            $this->json(['ok'=>(bool)$ok]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    /**
     * POST /api/users/delete
     * Видалення користувача
     */
    public function delete(): void
    {
        if (!$this->checkAdmin()) {
            $this->json(['ok'=>false, 'error'=>'forbidden'], 403);
            return;
        }

        $payload = $this->parseJson();
        $id = (int)($payload['id'] ?? 0);
        
        if ($id <= 0) { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }
        
        // Захист від самовидалення
        if ($id === Auth::id()) {
            $this->json(['ok'=>false,'error'=>'cannot_delete_self'], 400);
            return;
        }

        try {
            // Перевіряємо, чи є такий юзер
            $u = $this->users->findById($id);
            if (!$u) {
                $this->json(['ok'=>false,'error'=>'not_found'], 404);
                return;
            }
            
            // Якщо методу deleteById немає в інтерфейсі репозиторія, його треба додати
            // Або виконати SQL напряму (але краще через репозиторій)
            // Припускаємо, що метод існує, бо ми його додавали раніше
             if (method_exists($this->users, 'deleteById')) {
                $ok = $this->users->deleteById($id);
                $this->json(['ok'=>(bool)$ok]);
            } else {
                // Fallback якщо забули додати метод в репозиторій
                 $this->json(['ok'=>false,'error'=>'not_implemented_in_repo'], 501);
            }
            
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }
}