<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\UserMysqlRepository;
use App\Models\EventMysqlRepository;
use App\Core\Auth;

final class ApiUsersController
{
    private UserMysqlRepository $users;
    private EventMysqlRepository $events;

    public function __construct()
    {
        $this->users = new UserMysqlRepository();
        $this->events = new EventMysqlRepository();
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
            $usersOut = array_map(function($u) {
                return [
                    'id'    => (int)($u['id'] ?? 0),
                    'login' => (string)($u['login'] ?? ''),
                    'name'  => (string)(($u['name'] ?? '') !== '' ? $u['name'] : ($u['login'] ?? '')),
                    'email' => $u['email'] ?? null,
                    'kind'  => 'user',
                ];
            }, is_array($rows) ? $rows : []);

            $textRows = $this->events->searchOwnerTextSuggestions($q, $limit);
            $textOut = array_map(function($row) {
                $text = trim((string)($row['text'] ?? ''));
                return [
                    'kind'  => 'text',
                    'text'  => $text,
                    'label' => $text,
                    'source'=> (string)($row['source'] ?? 'events'),
                ];
            }, is_array($textRows) ? $textRows : []);

            $seen = [];
            $items = [];
            foreach ($usersOut as $u) {
                $label = trim((string)(($u['name'] ?? '') !== '' ? ($u['name'] . (!empty($u['login']) ? (' (' . $u['login'] . ')') : '')) : ($u['login'] ?? '')));
                $key = 'user:' . mb_strtolower($label, 'UTF-8');
                if (isset($seen[$key])) continue;
                $seen[$key] = true;
                $items[] = $u;
            }
            foreach ($textOut as $trow) {
                $label = trim((string)($trow['label'] ?? $trow['text'] ?? ''));
                if ($label === '') continue;
                $key = 'text:' . mb_strtolower($label, 'UTF-8');
                if (isset($seen[$key])) continue;
                $seen[$key] = true;
                $items[] = $trow;
            }

            $this->json(['ok' => true, 'users' => $usersOut, 'items' => $items]);
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

}
