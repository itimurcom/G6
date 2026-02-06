<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\EventMysqlRepository; // <--- ЗМІНЕНО: Використовуємо MySQL репозиторій
use App\Models\LoggingEventRepository;

final class ApiEventsController
{
    /** @var \App\Models\EventRepositoryInterface */
    private $repo;

    public function __construct()
    {
        // <--- ЗМІНЕНО: Передаємо MySQL версію всередину логера
        $this->repo = new LoggingEventRepository(new EventMysqlRepository());
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

    private function parseJson(): ?array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') return [];
        $payload = json_decode($raw, true);
        return is_array($payload) ? $payload : null;
    }

    private function requireCsrf(): bool
    {
        if (\App\Security\Csrf::validateHeader()) {
            return true;
        }
        $this->json([
            'ok'      => false,
            'error'   => 'csrf',
            'message' => 'Invalid or missing CSRF token',
        ], 403);
        return false;
    }


    public function byDate(): void
    {
        $date = (string)($_GET['date'] ?? '');
        if ($date === '') { $this->json(['ok'=>false,'error'=>'date required'], 400); return; }
        try {
            $rows = $this->repo->listByDate($date);
            $this->json(['ok'=>true,'date'=>$date,'events'=>$rows]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    public function byRange(): void
    {
        $start = (string)($_GET['start'] ?? '');
        $end   = (string)($_GET['end'] ?? '');
        if ($start === '' || $end === '') { $this->json(['ok'=>false,'error'=>'start/end required'], 400); return; }
        try {
            $map = $this->repo->listByRange($start, $end);
            $this->json(['ok'=>true,'data'=>$map,'start'=>$start,'end'=>$end]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    public function get(): void
    {
        $id = (string)($_GET['id'] ?? '');
        if ($id === '') { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }
        try {
            $row = $this->repo->getById($id);
            if (!$row) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }
            $this->json(['ok'=>true,'event'=>$row]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    
    public function updates(): void
    {
        // Auth required for user-specific session/cookies
        if (!\App\Core\Auth::check()) { $this->json(['ok'=>false,'error'=>'unauthorized'], 401); return; }

        $since = (string)($_GET['since'] ?? '');
        $since = trim($since);
        $limit = (int)($_GET['limit'] ?? 50);
        if ($limit < 1) { $limit = 1; }
        if ($limit > 200) { $limit = 200; }

        // If no "since" provided, just return server time (baseline for clients)
        $serverNow = date('Y-m-d H:i:s');
        if ($since === '') {
            $this->json(['ok'=>true,'server_now'=>$serverNow,'events'=>[]]);
            return;
        }

        // Basic guard: accept only "YYYY-MM-DD HH:MM:SS" to avoid weird comparisons
        if (!preg_match('/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/', $since)) {
            $this->json(['ok'=>false,'error'=>'bad_since','message'=>'since must be YYYY-MM-DD HH:MM:SS'], 400);
            return;
        }

        try {
            $db = \App\Core\Database::connect();
            $sql = "SELECT * FROM events WHERE created_at > :since ORDER BY created_at ASC LIMIT " . $limit;
            $stmt = $db->prepare($sql);
            $stmt->execute(['since' => $since]);
            $rows = $stmt->fetchAll();
            $out = [];
            if (is_array($rows)) {
                foreach ($rows as $row) {
                    if (!is_array($row)) continue;
                    // Normalize to UI shape
                    $row['urgent'] = (bool)($row['urgent'] ?? false);
                    $row['done']   = (bool)($row['done'] ?? false);
                    $row['_date']  = $row['start_date'] ?? '';
                    $out[] = $row;
                }
            }
            $this->json(['ok'=>true,'server_now'=>$serverNow,'events'=>$out]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

public function create(): void
    {
        if (!$this->requireCsrf()) { return; }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }
        try {
            // never trust client-supplied user_id
            if (isset($payload['event']) && is_array($payload['event'])) { unset($payload['event']['user_id']); }
            
            // MySQL repo повертає масив, старий повертав ID. Уніфікуємо:
            $res = $this->repo->create($payload['date'] ?? '', $payload);
            $id = is_array($res) ? ($res['id'] ?? '') : $res;

            

            // Notify all users about new event (persistent notifications)
            $this->notifyFanoutNewEvent((string)$id);
$this->json(['ok'=>true,'id'=>$id], 201);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>$e->getMessage()], 400);
        }
    }

    public function update(): void
    {
        if (!$this->requireCsrf()) { return; }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }
        $id = (string)($payload['id'] ?? '');
        if ($id === '') { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }
        unset($payload['id']);
        try {
            if (isset($payload['event']) && is_array($payload['event'])) { unset($payload['event']['user_id']); }
            $ok = $this->repo->updateById($id, $payload);
            $this->json(['ok'=>(bool)$ok]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    public function delete(): void
    {
        if (!$this->requireCsrf()) { return; }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }
        $id = (string)($payload['id'] ?? '');
        if ($id === '') { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }


        // ACL: allow delete only for author or admin
        $ev = null;
        try { $ev = $this->repo->getById($id); } catch (\Throwable $__e) { $ev = null; }
        if (!$ev) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }

        $me = \App\Core\Auth::user();
        $me_id = (int)($me['id'] ?? 0);
        $role = strtolower((string)($me['role'] ?? ''));
        $is_admin = ($role === 'admin') || !empty($me['is_admin']);

        $owner_id = (int)($ev['user_id'] ?? 0);
        if (!$is_admin && $owner_id !== $me_id) { $this->json(['ok'=>false,'error'=>'forbidden'], 403); return; }
        try {
            $ok = $this->repo->deleteById($id);
            $this->json(['ok'=>(bool)$ok]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    public function done(): void
    {
        if (!$this->requireCsrf()) { return; }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }
        $id   = (string)($payload['id'] ?? '');
        $done = (bool)($payload['done'] ?? 1);
        if ($id === '') { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }
        try {
            $ok = $this->repo->setDone($id, $done);
            $this->json(['ok'=>(bool)$ok]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

    public function urgent(): void
    {
        if (!$this->requireCsrf()) { return; }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }
        $id     = (string)($payload['id'] ?? '');
        $urgent = (bool)($payload['urgent'] ?? 1);
        if ($id === '') { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }
        try {
            $ok = $this->repo->setUrgent($id, $urgent);
            $this->json(['ok'=>(bool)$ok]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }
    function close(): void
    {
        if (!$this->requireCsrf()) { return; }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }

        $id = (string)($payload['id'] ?? '');
        if ($id === '') { $this->json(['ok'=>false,'error'=>'id required'], 400); return; }

        try {
            $ev = $this->repo->getById($id);
            if (!$ev) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }

            $date = (string)($ev['_date'] ?? ($payload['date'] ?? ''));
            $date = substr($date, 0, 10);
            if ($date === '') { $date = gmdate('Y-m-d'); }

            $event = $ev;
            if (isset($event['_date'])) { unset($event['_date']); }

            // apply provided fields (UI sends close_user_id + close_time, null means reopen)
            if (array_key_exists('close_user_id', $payload)) { $event['close_user_id'] = $payload['close_user_id']; }
            if (array_key_exists('close_time', $payload))    { $event['close_time']    = $payload['close_time']; }

            if (!array_key_exists('close_user_id', $event)) { $event['close_user_id'] = null; }
            if (!array_key_exists('close_time', $event))    { $event['close_time']    = null; }

            $ok = $this->repo->updateById($id, ['date' => $date, 'event' => $event]);

            $this->json([
                'ok'            => (bool)$ok,
                'id'            => $id,
                'close_user_id'=> $event['close_user_id'] ?? null,
                'close_time'   => $event['close_time'] ?? null,
            ]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }


    public function search(): void
    {
        $filters = [
            'text'   => $_GET['text']   ?? null,
            'type'   => $_GET['type']   ?? null,
            'owner'  => $_GET['owner']  ?? null,
            'urgent' => $_GET['urgent'] ?? null,
            'done'   => $_GET['done']   ?? null,
            'date'   => $_GET['date']   ?? null,
            'start'  => $_GET['start']  ?? null,
            'end'    => $_GET['end']    ?? null,
        ];
        $limit  = isset($_GET['limit'])  ? (int)$_GET['limit']  : 200;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        try {
            $rows = $this->repo->search($filters, $limit, $offset);
            $this->json(['ok'=>true,'data'=>$rows,'limit'=>$limit,'offset'=>$offset]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }

private function notifyFanoutNewEvent(string $eventId): void
{
    if ($eventId === '') return;

    // Actor (creator) — stored for future use in UI (optional)
    $actor = null;
    $actorId = 0;
    try {
        $actor = \App\Core\Auth::user();
        $actorId = (int)($actor['id'] ?? 0);
    } catch (\Throwable $e) {
        $actorId = 0;
    }

    try {
        $db = \App\Core\Database::connect();

        // Fetch all users once
        $rows = $db->query("SELECT id FROM users")->fetchAll();
        if (!is_array($rows) || !$rows) return;

        $sql = "INSERT IGNORE INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at)
                VALUES (:user_id, :kind, :event_id, :actor_user_id, :created_at)";
        $stmt = $db->prepare($sql);
        $now = date('Y-m-d H:i:s');

        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $uid = (int)($row['id'] ?? 0);
            if ($uid <= 0) continue;

            $stmt->execute([
                'user_id' => $uid,
                'kind' => 'event_new',
                'event_id' => $eventId,
                'actor_user_id' => ($actorId > 0 ? $actorId : null),
                'created_at' => $now,
            ]);
        }
    } catch (\Throwable $e) {
        // Table might not exist yet or DB error — ignore to not break event creation
        return;
    }
}

}