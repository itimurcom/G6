<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\DocumentMysqlRepository;
use App\Models\EventMessageMysqlRepository;
use App\Models\EventMysqlRepository; // <--- ЗМІНЕНО: Використовуємо MySQL репозиторій
use App\Models\LoggingEventRepository;
use App\Models\EventConfirmationMysqlRepository;
use App\Models\UserNameResolver;
use App\Services\Audit\ActionLogger;
use App\Services\EventViewHelper;
use App\Core\Database;
use App\Controllers\Traits\ApiCommonTrait;

final class ApiEventsController
{
    use ApiCommonTrait;

    /** @var \App\Models\EventRepositoryInterface */
    private $repo;
    private EventMessageMysqlRepository $messageRepo;
    private DocumentMysqlRepository $documentRepo;
    private EventConfirmationMysqlRepository $confirmations;
    private UserNameResolver $userNames;
    private ActionLogger $auditLogger;

    public function __construct()
    {
        // <--- ЗМІНЕНО: Передаємо MySQL версію всередину логера
        $this->repo = new LoggingEventRepository(new EventMysqlRepository());
        $this->messageRepo = new EventMessageMysqlRepository();
        $this->documentRepo = new DocumentMysqlRepository();
        $this->confirmations = new EventConfirmationMysqlRepository();
        $this->userNames = new UserNameResolver();
        $this->auditLogger = new ActionLogger();
    }

    
    private function ownerUserIdFromOwnerField(string $ownerRaw): int
    {
        try {
            $parsed = EventViewHelper::parseOwnerField($ownerRaw);
            if (($parsed['type'] ?? '') === 'user') {
                return (int)($parsed['user_id'] ?? 0);
            }
        } catch (\Throwable $e) { }
        return 0;
    }

    private function ownerDisplayFromOwnerField(string $ownerRaw): string
    {
        try {
            $parsed = EventViewHelper::parseOwnerField($ownerRaw);
            return EventViewHelper::ownerDisplay($parsed, fn(int $uid) => $this->userNames->getNameById($uid));
        } catch (\Throwable $e) { }
        return trim($ownerRaw) !== '' ? trim($ownerRaw) : '—';
    }


    private function currentAccessUser(): array
    {
        $me = \App\Core\Auth::user();
        $meId = (int)($me['id'] ?? 0);
        $role = strtolower((string)($me['role'] ?? ''));
        $isAdmin = ($role === 'admin') || !empty($me['is_admin']);
        return ['id' => $meId, 'is_admin' => $isAdmin];
    }

    private function canCurrentUserViewEvent(array $event): bool
    {
        $access = $this->currentAccessUser();
        if (!empty($access['is_admin'])) {
            return true;
        }

        $meId = (int)($access['id'] ?? 0);
        if ($meId <= 0) {
            return false;
        }

        $authorId = (int)($event['user_id'] ?? 0);
        if ($authorId === $meId) {
            return true;
        }

        $ownerRaw = (string)($event['owner'] ?? '');
        return $this->ownerUserIdFromOwnerField($ownerRaw) === $meId;
    }

    private function canCurrentUserFullyEditEvent(array $event): bool
    {
        $access = $this->currentAccessUser();
        if (!empty($access['is_admin'])) {
            return true;
        }

        $meId = (int)($access['id'] ?? 0);
        if ($meId <= 0) {
            return false;
        }

        $authorId = (int)($event['user_id'] ?? 0);
        return $authorId === $meId;
    }

    private function canCurrentUserAssigneeEditEvent(array $event): bool
    {
        if ($this->canCurrentUserFullyEditEvent($event)) {
            return true;
        }

        $access = $this->currentAccessUser();
        $meId = (int)($access['id'] ?? 0);
        if ($meId <= 0) {
            return false;
        }

        $ownerRaw = (string)($event['owner'] ?? '');
        return $this->ownerUserIdFromOwnerField($ownerRaw) === $meId;
    }

    private function canCurrentUserEditEvent(array $event): bool
    {
        return $this->canCurrentUserAssigneeEditEvent($event);
    }

    private function sanitizeLimitedAssigneeUpdatePayload(array $payload, array $before): array
    {
        $sanitized = [];

        if (array_key_exists('date', $payload)) {
            $sanitized['date'] = $payload['date'];
        }

        $eventIn = isset($payload['event']) && is_array($payload['event']) ? $payload['event'] : [];
        $eventOut = [];
        foreach (['time', 'urgent', 'done', 'incoming_no', 'outgoing_no', 'end_date'] as $field) {
            if (array_key_exists($field, $eventIn)) {
                $eventOut[$field] = $eventIn[$field];
            }
        }

        if ($eventOut !== []) {
            $sanitized['event'] = $eventOut;
        }

        return $sanitized;
    }

    private function filterVisibleEventList(array $rows): array
    {
        $filtered = [];
        foreach ($rows as $row) {
            if (is_array($row) && $this->canCurrentUserViewEvent($row)) {
                $filtered[] = $row;
            }
        }
        return $filtered;
    }

    private function filterVisibleEventMap(array $map): array
    {
        foreach ($map as $date => $rows) {
            $map[$date] = is_array($rows) ? $this->filterVisibleEventList($rows) : [];
        }
        return $map;
    }

    private function filterVisibleExtendedRows(array $rows): array
    {
        $filtered = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $eventId = trim((string)($row['event_id'] ?? ''));
            if ($eventId === '') {
                continue;
            }
            $event = $this->repo->getById($eventId);
            if (is_array($event) && $this->canCurrentUserViewEvent($event)) {
                $filtered[] = $row;
            }
        }
        return $filtered;
    }

    private function ensureExecutionConfirmationIfNeeded(string $eventId, array $eventRow, ?int $actorId = null): void
    {
        // Create confirmation only when owner is a system user and event is not done
        $ownerRaw = (string)($eventRow['owner'] ?? '');
        $assigneeId = $this->ownerUserIdFromOwnerField($ownerRaw);
        if ($assigneeId <= 0) return;
        if (!empty($eventRow['done'])) return;

        $payload = [
            'event' => [
                'id' => (string)($eventRow['id'] ?? $eventId),
                'title' => (string)($eventRow['title'] ?? ''),
                'start_date' => (string)($eventRow['start_date'] ?? ''),
                'end_date' => (string)($eventRow['end_date'] ?? ''),
                'time' => (string)($eventRow['time'] ?? ''),
                'owner' => $ownerRaw,
            ],
            'kind' => 'execution_confirmation',
        ];

        try {
            $this->confirmations->ensurePending($eventId, $assigneeId, $actorId, $payload);
        } catch (\Throwable $e) {
            // confirmations must not break event save
        }
    }

public function byDate(): void
    {
        $date = (string)($_GET['date'] ?? '');
        if ($date === '') { $this->json(['ok'=>false,'error'=>'date required'], 400); return; }
        try {
            $rows = $this->decorateEventListWithActivityCounts($this->filterVisibleEventList($this->repo->listByDate($date)));
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
            $map = $this->decorateEventMapWithActivityCounts($this->filterVisibleEventMap($this->repo->listByRange($start, $end)));
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
            if (!$row || !$this->canCurrentUserViewEvent($row)) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }
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

                        // After create: if assigned to a system user, create execution confirmation
            try {
                $created = $this->repo->getById($id);
                if (is_array($created)) {
                    $actorId = (int)(\App\Core\Auth::id() ?? 0);
                    $this->ensureExecutionConfirmationIfNeeded($id, $created, $actorId);
                }
            } catch (\Throwable $e) { /* ignore */ }

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
            $before = null;
            try { $before = $this->repo->getById($id); } catch (\Throwable $__e) { $before = null; }
            if (!$before) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }
            if (!$this->canCurrentUserEditEvent($before)) { $this->json(['ok'=>false,'error'=>'forbidden'], 403); return; }
            $ownerBeforeRaw = is_array($before) ? (string)($before['owner'] ?? '') : '';
            $ownerBeforeUid = $this->ownerUserIdFromOwnerField($ownerBeforeRaw);

            if (isset($payload['event']) && is_array($payload['event'])) { unset($payload['event']['user_id']); }
            if (!$this->canCurrentUserFullyEditEvent($before)) {
                $payload = $this->sanitizeLimitedAssigneeUpdatePayload($payload, $before);
            }
            $ok = $this->repo->updateById($id, $payload);

            // Post-update: detect assignee change and manage confirmation
            try {
                $after = $this->repo->getById($id);
                if (is_array($after)) {
                    $ownerAfterRaw = (string)($after['owner'] ?? '');
                    $ownerAfterUid = $this->ownerUserIdFromOwnerField($ownerAfterRaw);
                    $actorId = (int)(\App\Core\Auth::id() ?? 0);

                    if ($ownerBeforeRaw !== $ownerAfterRaw) {
                        // Journal + Event history: assignee changed
                        $beforeDisp = $this->ownerDisplayFromOwnerField($ownerBeforeRaw);
                        $afterDisp  = $this->ownerDisplayFromOwnerField($ownerAfterRaw);
                        try {
                            $msg = '🔄 Виконавця змінено: ' . $beforeDisp . ' → ' . $afterDisp;
                            if ($actorId > 0) {
                                $this->messageRepo->create($id, $actorId, $msg);
                            }
                        } catch (\Throwable $__e2) { }
                        try {
                            $this->auditLogger->log('calendar.event.assignee_change', 'success', [
                                'entity_type' => 'event',
                                'entity_id' => $id,
                                'event_title' => (string)($after['title'] ?? ''),
                                'assignee_before' => $beforeDisp,
                                'assignee_after' => $afterDisp,
                                'assignee_before_user_id' => $ownerBeforeUid,
                                'assignee_after_user_id' => $ownerAfterUid,
                            ]);
                        } catch (\Throwable $__e3) { }
                    }

                    // If assignee is a system user -> ensure pending confirmation; otherwise cancel pending
                    if ($ownerAfterUid > 0) {
                        $this->ensureExecutionConfirmationIfNeeded($id, $after, $actorId);
                    } else {
                        try { $this->confirmations->cancelPendingForEvent($id, $actorId); } catch (\Throwable $__e4) { }
                    }
                }
            } catch (\Throwable $__e) { }

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
            $ev = $this->repo->getById($id);
            if (!$ev) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }
            if (!$this->canCurrentUserEditEvent($ev)) { $this->json(['ok'=>false,'error'=>'forbidden'], 403); return; }
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
            $ev = $this->repo->getById($id);
            if (!$ev) { $this->json(['ok'=>false,'error'=>'not_found'], 404); return; }
            if (!$this->canCurrentUserEditEvent($ev)) { $this->json(['ok'=>false,'error'=>'forbidden'], 403); return; }
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
            if (!$this->canCurrentUserEditEvent($ev)) { $this->json(['ok'=>false,'error'=>'forbidden'], 403); return; }

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
            $comments = $this->filterVisibleExtendedRows($this->messageRepo->searchText($q, $type !== '' ? $type : null, $limit, $offset));
            $files = $this->filterVisibleExtendedRows($this->documentRepo->searchByOriginalName($q, $type !== '' ? $type : null, $limit, $offset));
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
            $chunk = max($limit, 200);
            if ($chunk > 500) { $chunk = 500; }
            $rows = [];
            $scanOffset = $offset;
            $iterations = 0;
            do {
                $batch = $this->repo->search($filters, $chunk, $scanOffset);
                $rows = array_merge($rows, $this->filterVisibleEventList($batch));
                $scanOffset += count($batch);
                $iterations++;
                if (count($batch) < $chunk) { break; }
            } while (count($rows) < $limit && $iterations < 10);

            if (count($rows) > $limit) {
                $rows = array_slice($rows, 0, $limit);
            }
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