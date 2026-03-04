<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\DocumentMysqlRepository;
use App\Models\EventMessageMysqlRepository;
use App\Models\EventMysqlRepository; // <--- ЗМІНЕНО: Використовуємо MySQL репозиторій
use App\Models\LoggingEventRepository;
use App\Core\Database;

final class ApiEventsController
{
    /** @var \App\Models\EventRepositoryInterface */
    private $repo;
    private EventMessageMysqlRepository $messageRepo;
    private DocumentMysqlRepository $documentRepo;

    public function __construct()
    {
        // <--- ЗМІНЕНО: Передаємо MySQL версію всередину логера
        $this->repo = new LoggingEventRepository(new EventMysqlRepository());
        $this->messageRepo = new EventMessageMysqlRepository();
        $this->documentRepo = new DocumentMysqlRepository();
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
            $rows = $this->decorateEventListWithActivityCounts($this->repo->listByDate($date));
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
            $map = $this->decorateEventMapWithActivityCounts($this->repo->listByRange($start, $end));
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
            $row = $this->decorateEventRowWithActivityCounts($row, $this->fetchEventActivityCounts([$id]));
            $this->json(['ok'=>true,'event'=>$row]);
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

            // Assign author from session so event owner can edit later
            $meId = (int)(\App\Core\Auth::id() ?? 0);
            if ($meId > 0) {
                if (!isset($payload['event']) || !is_array($payload['event'])) { $payload['event'] = []; }
                $payload['event']['user_id'] = $meId;
            }
            
            // MySQL repo повертає масив, старий повертав ID. Уніфікуємо:
            $res = $this->repo->create($payload['date'] ?? '', $payload);
            $id = is_array($res) ? ($res['id'] ?? '') : $res;

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


    public function searchExtended(): void
    {
        $q = trim((string)($_GET['q'] ?? ''));
        $type = trim((string)($_GET['type'] ?? ''));
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $limit = max(1, min(100, $limit));
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $offset = max(0, $offset);

        if ($q === '') {
            $this->json(['ok' => true, 'comments' => [], 'files' => []]);
            return;
        }

        try {
            $comments = $this->messageRepo->searchText($q, $type !== '' ? $type : null, $limit, $offset);
            $files = $this->documentRepo->searchByOriginalName($q, $type !== '' ? $type : null, $limit, $offset);
            $this->json([
                'ok' => true,
                'comments' => $comments,
                'files' => $files,
                'limit' => $limit,
                'offset' => $offset,
            ]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }


    /** @param array<int|string> $eventIds @return array<string,array{comments_count:int,files_count:int}> */
    private function fetchEventActivityCounts(array $eventIds): array
    {
        $ids = [];
        foreach ($eventIds as $eventId) {
            $eventId = trim((string)$eventId);
            if ($eventId === '') continue;
            $ids[$eventId] = true;
        }
        $ids = array_keys($ids);
        if ($ids === []) {
            return [];
        }

        $pdo = Database::connect();
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $counts = [];
        foreach ($ids as $id) {
            $counts[$id] = ['comments_count' => 0, 'files_count' => 0];
        }

        $sqlComments = "SELECT m.event_id, COUNT(*) AS c
                        FROM event_messages m
                        WHERE m.deleted_at IS NULL
                          AND m.event_id IN ({$placeholders})
                        GROUP BY m.event_id";
        $stComments = $pdo->prepare($sqlComments);
        $stComments->execute($ids);
        foreach (($stComments->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $row) {
            $eventId = trim((string)($row['event_id'] ?? ''));
            if ($eventId === '' || !isset($counts[$eventId])) continue;
            $counts[$eventId]['comments_count'] = (int)($row['c'] ?? 0);
        }

        $sqlFiles = "SELECT d.event_id, COUNT(*) AS c
                     FROM documents d
                     LEFT JOIN event_messages m ON m.id = d.message_id
                     WHERE d.deleted_at IS NULL
                       AND (d.message_id IS NULL OR m.deleted_at IS NULL)
                       AND d.event_id IN ({$placeholders})
                     GROUP BY d.event_id";
        $stFiles = $pdo->prepare($sqlFiles);
        $stFiles->execute($ids);
        foreach (($stFiles->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $row) {
            $eventId = trim((string)($row['event_id'] ?? ''));
            if ($eventId === '' || !isset($counts[$eventId])) continue;
            $counts[$eventId]['files_count'] = (int)($row['c'] ?? 0);
        }

        return $counts;
    }

    /** @param array<string,mixed> $row @param array<string,array{comments_count:int,files_count:int}> $counts */
    private function decorateEventRowWithActivityCounts(array $row, array $counts): array
    {
        $eventId = trim((string)($row['id'] ?? ''));
        $meta = ($eventId !== '' && isset($counts[$eventId]))
            ? $counts[$eventId]
            : ['comments_count' => 0, 'files_count' => 0];
        $row['comments_count'] = (int)($meta['comments_count'] ?? 0);
        $row['files_count'] = (int)($meta['files_count'] ?? 0);
        return $row;
    }

    /** @param array<int,array<string,mixed>> $rows @return array<int,array<string,mixed>> */
    private function decorateEventListWithActivityCounts(array $rows): array
    {
        $ids = [];
        foreach ($rows as $row) {
            $eventId = trim((string)($row['id'] ?? ''));
            if ($eventId !== '') $ids[] = $eventId;
        }
        $counts = $this->fetchEventActivityCounts($ids);
        foreach ($rows as $i => $row) {
            $rows[$i] = $this->decorateEventRowWithActivityCounts($row, $counts);
        }
        return $rows;
    }

    /** @param array<string,array<int,array<string,mixed>>> $map @return array<string,array<int,array<string,mixed>>> */
    private function decorateEventMapWithActivityCounts(array $map): array
    {
        $ids = [];
        foreach ($map as $rows) {
            if (!is_array($rows)) continue;
            foreach ($rows as $row) {
                $eventId = trim((string)($row['id'] ?? ''));
                if ($eventId !== '') $ids[] = $eventId;
            }
        }
        $counts = $this->fetchEventActivityCounts($ids);
        foreach ($map as $date => $rows) {
            if (!is_array($rows)) continue;
            foreach ($rows as $i => $row) {
                $rows[$i] = $this->decorateEventRowWithActivityCounts((array)$row, $counts);
            }
            $map[$date] = $rows;
        }
        return $map;
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

    /**
     * POST /api/events/backfill-authors
     * Admin-only one-time migration:
     * - Fills events.user_id where it is NULL/0 using audit_logs ("calendar.event.create").
     * - Optional JSON: { "mode": "audit" | "force_me" }
     *   - audit (default): infer author from audit_logs
     *   - force_me: set all missing authors to current admin id (use only if audit is incomplete)
     */
    public function backfillAuthors(): void
    {
        if (!$this->requireCsrf()) { return; }

        $me = \App\Core\Auth::user();
        $me_id = (int)($me['id'] ?? 0);
        $role = strtolower((string)($me['role'] ?? ''));
        $is_admin = ($role === 'admin') || !empty($me['is_admin']);
        if (!$is_admin || $me_id <= 0) { $this->json(['ok'=>false,'error'=>'forbidden'], 403); return; }

        $payload = $this->parseJson();
        if ($payload === null) { $this->json(['ok'=>false,'error'=>'invalid json'], 400); return; }
        $mode = strtolower((string)($payload['mode'] ?? 'audit'));
        if ($mode !== 'audit' && $mode !== 'force_me') { $mode = 'audit'; }

        try {
            $pdo = \App\Core\Database::connect();

            // how many candidates exist before update
            $cntStmt = $pdo->query("SELECT COUNT(*) AS c FROM events WHERE user_id IS NULL OR user_id = 0");
            $before = (int)(($cntStmt ? $cntStmt->fetchColumn() : 0) ?: 0);

            $updated = 0;

            if ($before > 0) {
                if ($mode === 'force_me') {
                    $stmt = $pdo->prepare("UPDATE events SET user_id = :uid WHERE user_id IS NULL OR user_id = 0");
                    $stmt->execute(['uid' => $me_id]);
                    $updated = (int)$stmt->rowCount();
                } else {
                    // Update from earliest audit create record per event
                    $sql = "
                        UPDATE events e
                        JOIN (
                            SELECT t.entity_id, t.user_id AS author_id
                            FROM audit_logs t
                            JOIN (
                                SELECT entity_id, MIN(created_at) AS min_created
                                FROM audit_logs
                                WHERE entity_type = 'event'
                                  AND action = 'calendar.event.create'
                                  AND result = 'success'
                                  AND user_id IS NOT NULL
                                GROUP BY entity_id
                            ) m ON m.entity_id = t.entity_id AND m.min_created = t.created_at
                            WHERE t.user_id IS NOT NULL
                        ) a ON a.entity_id = e.id
                        SET e.user_id = a.author_id
                        WHERE (e.user_id IS NULL OR e.user_id = 0)
                    ";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute();
                    $updated = (int)$stmt->rowCount();
                }
            }

            $cntStmt2 = $pdo->query("SELECT COUNT(*) AS c FROM events WHERE user_id IS NULL OR user_id = 0");
            $after = (int)(($cntStmt2 ? $cntStmt2->fetchColumn() : 0) ?: 0);

            $this->json([
                'ok' => true,
                'mode' => $mode,
                'candidates_before' => $before,
                'updated' => $updated,
                'remaining' => $after,
            ]);
        } catch (\Throwable $e) {
            $this->json(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], 500);
        }
    }


}