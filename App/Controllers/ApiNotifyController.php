<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Database;
use App\Core\Auth;
use PDO;

/**
 * API: persistent notifications for users.
 *
 * Endpoints:
 *  - GET  /api/notify/unseen
 *  - POST /api/notify/seen
 *  - POST /api/notify/seen-all
 */
final class ApiNotifyController extends Controller
{
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    private function json(array $data, int $code = 200): string
    {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            http_response_code($code);
        }
        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function parseJson(): ?array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') return [];
        $payload = json_decode($raw, true);
        return is_array($payload) ? $payload : null;
    }

    private function currentUserId(): int
    {
        // IMPORTANT: Auth::check() only guarantees Session::user_id is present.
        // Some sessions may not contain $_SESSION['user'].
        $uid = (int)(Auth::id() ?? 0);
        if ($uid > 0) return $uid;
        $uid = (int)($_SESSION['user_id'] ?? 0);
        if ($uid > 0) return $uid;
        $u = $_SESSION['user'] ?? null;
        if (is_array($u)) return (int)($u['id'] ?? 0);
        return 0;
    }

    private function requireCsrf(): bool
    {
        if (\App\Security\Csrf::validateHeader()) {
            return true;
        }
        echo $this->json([
            'ok'      => false,
            'error'   => 'csrf',
            'message' => 'Invalid or missing CSRF token',
        ], 403);
        return false;
    }

    public function unseen(Request $r): string
    {
        $uid = $this->currentUserId();
        if ($uid <= 0) {
            return $this->json([
                'ok' => false,
                'error' => 'unauthorized',
            ], 401);
        }

        $limit = max(1, min(200, (int)($r->input('limit') ?? 50)));

        try {
            // 1) Fetch unseen notification rows (no JOIN to keep Activity resilient).
            $sql = "
                SELECT id, user_id, kind, event_id, actor_user_id, created_at, seen_at, payload
                FROM user_notifications
                WHERE user_id = :uid AND seen_at IS NULL
                ORDER BY id DESC
                LIMIT {$limit}
            ";

            $st = $this->db->prepare($sql);
            $st->execute(['uid' => $uid]);
            $rows = $st->fetchAll(PDO::FETCH_ASSOC);

            // 2) Fetch referenced events in one query (IN (...)).
            $eventIds = [];
            foreach ($rows as $row) {
                $eid = (string)($row['event_id'] ?? '');
                if ($eid !== '') $eventIds[$eid] = true;
            }
            $eventsById = [];

            if ($eventIds) {
                $ids = array_keys($eventIds);
                $placeholders = implode(',', array_fill(0, count($ids), '?'));

                $sqlE = "
                    SELECT id, title, description, start_date, end_date, time, owner, type, urgent, done
                    FROM events
                    WHERE id IN ({$placeholders})
                ";
                $stE = $this->db->prepare($sqlE);
                $stE->execute($ids);
                $evRows = $stE->fetchAll(PDO::FETCH_ASSOC);

                foreach ($evRows as $e) {
                    $eventsById[(string)$e['id']] = [
                        'id'          => (string)$e['id'],
                        'title'       => (string)($e['title'] ?? ''),
                        'description' => (string)($e['description'] ?? ''),
                        'start_date'  => (string)($e['start_date'] ?? ''),
                        'end_date'    => (string)($e['end_date'] ?? ''),
                        'time'        => (string)($e['time'] ?? ''),
                        'owner'       => (string)($e['owner'] ?? ''),
                        'type'        => (string)($e['type'] ?? ''),
                        'urgent'      => (int)($e['urgent'] ?? 0),
                        'done'        => (int)($e['done'] ?? 0),
                    ];
                }
            }

            $notifications = [];
            foreach ($rows as $row) {
                $eid = (string)($row['event_id'] ?? '');
                $payloadRaw = $row['payload'] ?? null;
                $payload = null;
                if (is_string($payloadRaw) && $payloadRaw !== '') {
                    $tmp = json_decode($payloadRaw, true);
                    if (is_array($tmp)) { $payload = $tmp; }
                }

                $event = $eid !== '' ? ($eventsById[$eid] ?? null) : null;
                if ($event === null && is_array($payload) && isset($payload['event']) && is_array($payload['event'])) {
                    // Deleted/missing event: fall back to snapshot from payload.
                    $event = $payload['event'];
                    if (!isset($event['id']) && $eid !== '') { $event['id'] = $eid; }
                }
                $notifications[] = [
                    'id'            => (int)($row['id'] ?? 0),
                    'user_id'       => (int)($row['user_id'] ?? 0),
                    'kind'          => (string)($row['kind'] ?? ''),
                    'event_id'      => $eid,
                    'actor_user_id' => (int)($row['actor_user_id'] ?? 0),
                    'created_at'    => (string)($row['created_at'] ?? ''),
                    'seen_at'       => $row['seen_at'] ?? null,
                    'event'         => $event,
                    'payload'       => $payload,
                ];
            }

            return $this->json([
                'ok'            => true,
                'server_now'    => date('Y-m-d H:i:s'),
                'notifications' => $notifications,
            ], 200);
        } catch (\Throwable $e) {
            // If table is missing or DB error, do not break the UI.
            return $this->json([
                'ok'            => true,
                'server_now'    => date('Y-m-d H:i:s'),
                'notifications' => [],
            ], 200);
        }
    }


    public function seen(Request $r): string
    {
        if (!$this->requireCsrf()) { return ''; }

        $uid = $this->currentUserId();
        if ($uid <= 0) return $this->json(['ok'=>false,'error'=>'unauthorized'], 401);

        $payload = $this->parseJson();
        if ($payload === null) return $this->json(['ok'=>false,'error'=>'invalid_json'], 400);

        $id = (int)($payload['id'] ?? 0);
        $eventId = (string)($payload['event_id'] ?? '');

        if ($id <= 0 && $eventId === '') {
            return $this->json(['ok'=>false,'error'=>'id_or_event_id_required'], 400);
        }

        try {
            if ($id > 0) {
                // IMPORTANT: execution-confirmation activity cannot be closed via /seen
                // It can only be closed by accepting the task (POST /api/confirmations/accept).
                $stKind = $this->db->prepare('SELECT kind FROM user_notifications WHERE id = :id AND user_id = :uid');
                $stKind->execute(['id' => $id, 'uid' => $uid]);
                $kind = (string)($stKind->fetchColumn() ?: '');
                if ($kind === 'event_exec_confirm') {
                    return $this->json(['ok'=>false,'error'=>'not_allowed'], 409);
                }

                $st = $this->db->prepare('UPDATE user_notifications SET seen_at = NOW() WHERE id = :id AND user_id = :uid');
                $st->execute(['id' => $id, 'uid' => $uid]);
            } else {
                // Do not close execution confirmations here
                $st = $this->db->prepare("UPDATE user_notifications SET seen_at = NOW()\n                    WHERE event_id = :eid AND user_id = :uid AND seen_at IS NULL\n                      AND kind <> 'event_exec_confirm'");
                $st->execute(['eid' => $eventId, 'uid' => $uid]);
            }
            return $this->json(['ok'=>true]);
        } catch (\Throwable $e) {
            return $this->json(['ok'=>false,'error'=>'db_error','message'=>$e->getMessage()], 500);
        }
    }

    public function seenAll(Request $r): string
    {
        if (!$this->requireCsrf()) { return ''; }

        $uid = $this->currentUserId();
        if ($uid <= 0) return $this->json(['ok'=>false,'error'=>'unauthorized'], 401);

        try {
            // Do not close execution confirmations here
            $st = $this->db->prepare("UPDATE user_notifications SET seen_at = NOW()\n                WHERE user_id = :uid AND seen_at IS NULL\n                  AND kind <> 'event_exec_confirm'");
            $st->execute(['uid' => $uid]);
            return $this->json(['ok'=>true]);
        } catch (\Throwable $e) {
            return $this->json(['ok'=>false,'error'=>'db_error','message'=>$e->getMessage()], 500);
        }
    }

    /**
     * GET /api/notify/seen-by-event?event_id=...
     * Admin-only: returns who has seen a notification for the given event.
     */
        public function seenByEvent(Request $r): string
    {
        if (!Auth::check()) {
            return $this->json(['ok' => false, 'error' => 'auth'], 401);
        }

        $eventId = (string)($r->input('event_id') ?? '');
        $eventId = trim($eventId);

        if ($eventId === '') {
            return $this->json(['ok' => false, 'error' => 'bad_request', 'message' => 'event_id is required'], 400);
        }

        // We track "viewed" via a dedicated notification kind to avoid duplicates per event (kind is part of unique key).
        $kind = 'event_view';

        $sql = "
            SELECT u.id AS user_id, n.seen_at, u.name, u.login
            FROM users u
            LEFT JOIN user_notifications n
              ON n.user_id = u.id
             AND n.event_id = :eid
             AND n.kind = :kind
            ORDER BY (n.seen_at IS NULL) ASC, n.seen_at DESC, u.id ASC
        ";
        $st = $this->db->prepare($sql);
        $st->execute(['eid' => $eventId, 'kind' => $kind]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $seen = [];
        $unseen = [];

        foreach ($rows as $row) {
            $uid = (int)($row['user_id'] ?? 0);
            $name = (string)($row['name'] ?? '');
            $login = (string)($row['login'] ?? '');
            $label = $name !== '' ? $name : ($login !== '' ? $login : ('#' . $uid));
            $seenAt = $row['seen_at'] ?? null;

            $item = [
                'user_id'  => $uid,
                'label'    => $label,
                'seen_at'  => $seenAt ? (string)$seenAt : null,
            ];

            if ($seenAt) {
                $seen[] = $item;
            } else {
                $unseen[] = $item;
            }
        }

        return $this->json([
            'ok'       => true,
            'event_id' => $eventId,
            'seen'     => $seen,
            'unseen'   => $unseen,
        ]);
    }



    /**
     * Mark current user as "viewed" for the given event.
     * Uses a dedicated kind = 'event_view' so it does not interfere with activity notifications.
     *
     * Endpoint:
     *  - POST /api/notify/viewed  { event_id: "..." }
     */
    public function viewed(Request $r): string
    {
        if (!$this->requireCsrf()) { return ''; }

        $uid = $this->currentUserId();
        if ($uid <= 0) return $this->json(['ok'=>false,'error'=>'unauthorized'], 401);

        $payload = $this->parseJson();
        if ($payload === null) return $this->json(['ok'=>false,'error'=>'invalid_json'], 400);

        $eventId = trim((string)($payload['event_id'] ?? ''));
        if ($eventId === '') {
            return $this->json(['ok'=>false,'error'=>'event_id_required'], 400);
        }

        $kind = 'event_view';

        try {
            $sql = "
                INSERT INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at, seen_at)
                VALUES (:uid, :kind, :eid, :actor, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    seen_at = NOW(),
                    created_at = VALUES(created_at),
                    actor_user_id = VALUES(actor_user_id)
            ";
            $st = $this->db->prepare($sql);
            $st->execute([
                'uid'   => $uid,
                'kind'  => $kind,
                'eid'   => $eventId,
                'actor' => $uid,
            ]);
            return $this->json(['ok'=>true]);
        } catch (\Throwable $e) {
            return $this->json(['ok'=>false,'error'=>'db_error','message'=>$e->getMessage()], 500);
        }
    }

}
