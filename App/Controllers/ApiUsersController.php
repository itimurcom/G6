<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\UserMysqlRepository;
use App\Models\EventMysqlRepository;
use App\Core\Auth;
use App\Controllers\Traits\ApiCommonTrait;

final class ApiUsersController
{
    use ApiCommonTrait;

    private UserMysqlRepository $users;
    private EventMysqlRepository $events;

    public function __construct()
    {
        $this->users = new UserMysqlRepository();
        $this->events = new EventMysqlRepository();
    }

    private function checkAdmin(): bool
    {
        $me = $this->currentUser();
        if (!$me) return false;
        return $this->isAdmin($me);
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
                    'has_avatar' => !empty($u['has_avatar']),
                    'avatar_url' => $u['avatar_url'] ?? null,
                    'avatar_version' => $u['avatar_version'] ?? null,
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
                'is_admin' => !empty($u['is_admin']),
                'has_avatar' => !empty($u['has_avatar']),
                'avatar_url' => $u['avatar_url'] ?? null,
                'avatar_version' => $u['avatar_version'] ?? null
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


    /**
     * GET /api/users/avatar?id=1
     * Streams avatar binary from DB.
     */
    public function avatar(): void
    {
        try {
            $id = (int)($_GET['id'] ?? 0);
            if ($id <= 0) {
                http_response_code(400);
                echo 'Bad Request';
                return;
            }

            $avatar = $this->users->getAvatarById($id);
            if (!$avatar) {
                http_response_code(404);
                echo 'Not Found';
                return;
            }

            $mime = trim((string)($avatar['mime'] ?? 'application/octet-stream')) ?: 'application/octet-stream';
            $blob = $avatar['blob'] ?? null;
            if ($blob === null || $blob === '') {
                http_response_code(404);
                echo 'Not Found';
                return;
            }

            if (!headers_sent()) {
                header('Content-Type: ' . $mime);
                header('Content-Length: ' . strlen($blob));
                header('Cache-Control: private, max-age=86400');
                $filename = trim((string)($avatar['filename'] ?? 'avatar'));
                if ($filename !== '') {
                    header('Content-Disposition: inline; filename="' . addslashes($filename) . '"');
                }
            }
            echo $blob;
        } catch (\Throwable $e) {
            http_response_code(500);
            echo 'Internal Server Error';
        }
    }

}
