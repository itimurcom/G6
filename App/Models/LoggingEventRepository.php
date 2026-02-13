<?php
declare(strict_types=1);

namespace App\Models;

use App\Services\Audit\ActionLogger;
use App\Core\Auth;
use App\Core\Database;

/**
 * LoggingEventRepository — тонкий декоратор над файловим репозиторієм подій,
 * який НІЧОГО не змінює у бізнес‑логіці збереження подій, а лише:
 *   1) делегує виклики у FileEventRepository;
 *   2) після успішних змін записує дію в audit.ndjson через ActionLogger.
 *
 * ВАЖЛИВО:
 *  - Сигнатури методів підлаштовані під те, як ApiEventsController викликає $this->repo.
 *  - Всередині ми адаптуємо payload до формату FileEventRepository.
 */
final class LoggingEventRepository
{
    /** @var object */
    private $inner;

    private ActionLogger $logger;

    /**
     * @param object $inner Очікується екземпляр FileEventRepository
     *                      (але навмисно не типізуємо жорстко, щоб не ловити TypeError).
     */
    public function __construct($inner)
    {
        $this->inner  = $inner;
        $this->logger = new ActionLogger();
    }

    /**
     * Поточний користувач для метаданих аудиту.
     */
    private function userContext(): array
    {
        $u = Auth::user();
        if (!is_array($u)) {
            return [
                'user_id'   => null,
                'user_name' => null,
            ];
        }

        return [
            'user_id'   => $u['id']   ?? null,
            'user_name' => $u['name'] ?? null,
        ];
    }

    // ---------------------------------------------------------------------
    // PERSISTENT NOTIFICATIONS (user_notifications)
    // ---------------------------------------------------------------------

    private function notifyHasPayloadColumn(\PDO $db): bool
    {
        static $cached = null;
        if ($cached !== null) {
            return (bool)$cached;
        }

        try {
            $st = $db->prepare(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS\n".
                "WHERE TABLE_SCHEMA = DATABASE()\n".
                "  AND TABLE_NAME = 'user_notifications'\n".
                "  AND COLUMN_NAME = 'payload'"
            );
            $st->execute();
            $cached = ((int)$st->fetchColumn() > 0);
        } catch (\Throwable $e) {
            $cached = false;
        }

        return (bool)$cached;
    }

    private function snapshotEvent(?array $row, string $fallbackId = ''): ?array
    {
        if (!is_array($row)) {
            if ($fallbackId === '') return null;
            return [
                'id' => $fallbackId,
                'title' => '',
                'description' => '',
                'start_date' => '',
                'end_date' => '',
                'time' => '',
                'owner' => '',
                'type' => 'other',
                'urgent' => 0,
                'done' => 0,
            ];
        }

        $id = (string)($row['id'] ?? $fallbackId);
        return [
            'id'          => $id,
            'title'       => (string)($row['title'] ?? ''),
            'description' => (string)($row['description'] ?? ''),
            'start_date'  => (string)($row['start_date'] ?? ($row['_date'] ?? '')),
            'end_date'    => (string)($row['end_date'] ?? ''),
            'time'        => (string)($row['time'] ?? ''),
            'owner'       => (string)($row['owner'] ?? ''),
            'type'        => (string)($row['type'] ?? 'other'),
            'urgent'      => (int)(!empty($row['urgent']) ? 1 : 0),
            'done'        => (int)(!empty($row['done']) ? 1 : 0),
        ];
    }

    private function notifyFanout(string $kind, string $eventId, ?array $payload = null): void
    {
        $eventId = (string)$eventId;
        $kind    = (string)$kind;
        if ($eventId === '' || $kind === '') return;

        // Allow multiple activities for the same event/kind (table has UNIQUE user/kind/event)
        // We add a short time-suffix to kind for repeatable activity kinds so each change becomes a new row.
        $repeatableKinds = [
            'event_time_changed',
            'event_closed',
            'event_reopened',
            'event_done_changed',
            'event_urgent_changed',
            'event_title_changed',
            'event_desc_changed',
            'event_docs_changed',
            'event_owner_changed',
            'event_date_changed',
        ];
        if (in_array($kind, $repeatableKinds, true)) {
            $ts = date('His');
            $ms = (int)round((microtime(true) - floor(microtime(true))) * 1000);
            $suffix = $ts . sprintf('%03d', $ms); // HHMMSSmmm
            $kind = $kind . '@' . $suffix;
            if (strlen($kind) > 32) {
                $kind = substr($kind, 0, 32);
            }
        }


        $actorId = (int)(Auth::id() ?? 0);

        try {
            $db = Database::connect();

            $stU = $db->query('SELECT id FROM users');
            $users = $stU ? $stU->fetchAll(\PDO::FETCH_ASSOC) : [];
            if (!$users) return;

            $hasPayload = $this->notifyHasPayloadColumn($db);

            if ($hasPayload) {
                $sql = "INSERT INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at, payload)\n".
                       "VALUES (:uid, :kind, :eid, :actor, NOW(), :payload)\n".
                       "ON DUPLICATE KEY UPDATE seen_at = NULL, created_at = VALUES(created_at), actor_user_id = VALUES(actor_user_id), payload = VALUES(payload)";
                $st = $db->prepare($sql);

                $payloadJson = $payload !== null
                    ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    : null;

                foreach ($users as $u) {
                    $uid = (int)($u['id'] ?? 0);
                    if ($uid <= 0) continue;
                    $st->execute([
                        'uid' => $uid,
                        'kind' => $kind,
                        'eid' => $eventId,
                        'actor' => $actorId,
                        'payload' => $payloadJson,
                    ]);
                }
            } else {
                $sql = "INSERT INTO user_notifications (user_id, kind, event_id, actor_user_id, created_at)\n".
                       "VALUES (:uid, :kind, :eid, :actor, NOW())\n".
                       "ON DUPLICATE KEY UPDATE seen_at = NULL, created_at = VALUES(created_at), actor_user_id = VALUES(actor_user_id)";
                $st = $db->prepare($sql);
                foreach ($users as $u) {
                    $uid = (int)($u['id'] ?? 0);
                    if ($uid <= 0) continue;
                    $st->execute([
                        'uid' => $uid,
                        'kind' => $kind,
                        'eid' => $eventId,
                        'actor' => $actorId,
                    ]);
                }
            }
        } catch (\Throwable $e) {
            // Notifications must never break business logic.
        }
    }

    // ---------------------------------------------------------------------
    // READ‑операції (без логування)
    // ---------------------------------------------------------------------

    public function listByDate(string $date): array
    {
        return $this->inner->listByDate($date);
    }

    public function listByRange(string $from, string $to): array
    {
        return $this->inner->listByRange($from, $to);
    }

    public function getById(string $id): ?array
    {
        // У FileEventRepository метод називається get()
        return $this->inner->get($id);
    }

    public function search(array $filters, int $limit, int $offset): array
    {
        // Normalize filters
        $type  = isset($filters['type'])  && $filters['type']  !== '' && $filters['type']  !== null ? (string)$filters['type']  : null;
        $owner = isset($filters['owner']) && $filters['owner'] !== '' && $filters['owner'] !== null ? (string)$filters['owner'] : null;

        $toBoolOrNull = static function($v): ?bool {
            if ($v === null || $v === '') return null;
            if (is_bool($v)) return $v;
            $s = strtolower(trim((string)$v));
            if ($s === '1' || $s === 'true' || $s === 'yes' || $s === 'on') return true;
            if ($s === '0' || $s === 'false' || $s === 'no'  || $s === 'off') return false;
            return null;
        };

        $urgent = $toBoolOrNull($filters['urgent'] ?? null);
        $done   = $toBoolOrNull($filters['done']   ?? null);

        $date  = isset($filters['date'])  && $filters['date']  !== null ? (string)$filters['date']  : '';
        $start = isset($filters['start']) && $filters['start'] !== null ? (string)$filters['start'] : '';
        $end   = isset($filters['end'])   && $filters['end']   !== null ? (string)$filters['end']   : '';

        $date  = substr($date,  0, 10);
        $start = substr($start, 0, 10);
        $end   = substr($end,   0, 10);

        $offset = max(0, (int)$offset);
        $limit  = max(0, (int)$limit);

        if ($limit === 0) {
            return [];
        }

        // Fetch rows from inner repository.
        // MySQL repository: search(array $filters, int $limit, int $offset)
        // Legacy repository: search(string $q)
        $fetchLimit = max(500, $limit + $offset);
        if ($fetchLimit > 5000) { $fetchLimit = 5000; }

        try {
            $rows = $this->inner->search($filters, $fetchLimit, 0);
        } catch (\TypeError $__e) {
            $q = (string)($filters['text'] ?? '');
            $rows = $this->inner->search($q);
        }

        // If inner returned a date->events map (defensive), flatten it.
        if (is_array($rows) && $rows !== [] && array_keys($rows) !== range(0, count($rows) - 1)) {
            $flat = [];
            foreach ($rows as $k => $v) {
                if (!is_array($v)) { continue; }
                foreach ($v as $ev) {
                    if (!is_array($ev)) { continue; }
                    if (!isset($ev['_date']) && is_string($k)) { $ev['_date'] = $k; }
                    $flat[] = $ev;
                }
            }
            $rows = $flat;
        }

        $out = [];
        foreach ($rows as $ev) {
            if (!is_array($ev)) continue;

            // exact filters
            if ($type !== null && (string)($ev['type'] ?? '') !== $type) continue;
            if ($owner !== null && (string)($ev['owner'] ?? '') !== $owner) continue;

            if ($urgent !== null && (bool)($ev['urgent'] ?? false) !== $urgent) continue;
            if ($done !== null && (bool)($ev['done'] ?? false) !== $done) continue;

            // date filters (inclusive)
            $d = (string)($ev['_date'] ?? ($ev['start_date'] ?? ''));
            $d = substr($d, 0, 10);

            if ($date !== '') {
                if ($d !== $date) continue;
            } else {
                if ($start !== '' && $d !== '' && $d < $start) continue;
                if ($end   !== '' && $d !== '' && $d > $end)   continue;
            }

            $out[] = $ev;
        }

        return array_values(array_slice($out, $offset, $limit));
    }

    // ---------------------------------------------------------------------
    // WRITE‑операції (із логуванням)
    // ---------------------------------------------------------------------

    /**
     * Створення події.
     *
     * Викликається з ApiEventsController::create():
     *   $this->repo->create($payload['date'] ?? '', $payload);
     *
     * $date   — день (YYYY-MM-DD),
     * $payload — обгортка, в якій зазвичай є ключ 'event' з власне подією.
     *
     * Повертаємо ID події (а не масив), бо контролер очікує саме id.
     */
    public     function create(string $date, array $payload): string
    {
        // Витягуємо саму подію з payload
        $event = isset($payload['event']) && is_array($payload['event'])
            ? $payload['event']
            : $payload;

        // якщо у payload був id — не губимо його
        if (isset($payload['id']) && !isset($event['id'])) {
            $event['id'] = $payload['id'];
        }

        $res = $this->inner->create($date, $event);
        $id  = (string)($res['id'] ?? ($event['id'] ?? ''));

        $ok = ($id !== '');

        $this->logger->log(
            'calendar.event.create',
            $ok ? 'success' : 'error',
            array_merge(
                $this->userContext(),
                [
                    'entity_type' => 'event',
                    'entity_id'   => $ok ? $id : null,
                    'date'        => $res['date'] ?? $date,
                    'payload'     => $event,
                ]
            )
        );

        // Activity notification: new event
        if ($ok) {
            try {
                $after = null;
                try { $after = $this->inner->get($id); } catch (\Throwable $__) { $after = null; }

                $this->notifyFanout('event_new', $id, [
                    'event' => $this->snapshotEvent($after, $id),
                ]);
            } catch (\Throwable $__ ) {
                // ignore
            }
        }

        return $id;
    }

    /**
     * Оновлення події за ID.
     *
     * Викликається з ApiEventsController::update():
     *   $this->repo->updateById($id, $payload);
     *
     * $payload зазвичай містить 'event' і, можливо, нову дату.
     * Повертаємо true/false — контролер кастить результат до bool.
     */
    public function updateById(string $id, array $payload): bool
    {
        $before = null;
        try {
            $before = $this->inner->get($id);
        } catch (\Throwable $__) {
            // ігноруємо — все одно спробуємо оновити нижче
        }

        $event = isset($payload['event']) && is_array($payload['event'])
            ? $payload['event']
            : $payload;

        $event['id'] = $id;

        // Визначаємо дату:
        //   1) нова дата з payload['date'];
        //   2) дата з event['_date'];
        //   3) дата з існуючої події;
        //   4) поточний день (як крайній випадок).
        $date = (string)($payload['date'] ?? ($event['_date'] ?? ($before['_date'] ?? '')));
        if ($date === '') {
            $date = gmdate('Y-m-d');
        }

        $res = $this->inner->update($date, $event);

        $ok = !isset($res['error']);

        // IMPORTANT: for audit/journal diffs we must store the persisted "after" snapshot,
        // not the raw incoming payload (which may omit fields like start_date/description).
        // This prevents false positives (e.g. "Дата" change when only "Опис" was edited).
        $after = null;
        if ($ok) {
            try {
                $after = $this->inner->get($id);
            } catch (\Throwable $__) {
                $after = null;
            }
        }

        $this->logger->log(
            'calendar.event.update',
            $ok ? 'success' : 'error',
            array_merge(
                $this->userContext(),
                [
                    'entity_type'   => 'event',
                    'entity_id'     => $id,
                    'date'          => $res['date'] ?? $date,
                    'event_before'  => $before,
                    'event_after'   => $after ?? $event,
                    // Keep raw incoming payload for debugging (does not affect UI).
                    'event_payload' => $event,
                    'update_result' => $res,
                ]
            )
        );


// Activity notifications (persistent, cross-browser)
        if ($ok) {
            try {
                if (!is_array($after)) {
                    $after = $this->inner->get($id);
                }

                $beforeDate = is_array($before) ? (string)($before['start_date'] ?? ($before['_date'] ?? '')) : '';
                $afterDate  = is_array($after)  ? (string)($after['start_date']  ?? ($after['_date']  ?? '')) : (string)($res['date'] ?? $date);
                if ($beforeDate !== '' && $afterDate !== '' && $beforeDate !== $afterDate) {
                    $this->notifyFanout('event_date_changed', $id, [
                        'from_date' => $beforeDate,
                        'to_date'   => $afterDate,
                        'event'     => $this->snapshotEvent($after, $id),
                    ]);
                }

                // Activity notifications: time changed (important for Today drag&drop)
                $beforeTime = is_array($before) ? (string)($before['time'] ?? ($before['start_time'] ?? '')) : '';
                $afterTime  = is_array($after)  ? (string)($after['time']  ?? ($after['start_time']  ?? '')) : '';
                if (trim($beforeTime) !== trim($afterTime)) {
                    $this->notifyFanout('event_time_changed', $id, [
                        'from_time' => $beforeTime,
                        'to_time'   => $afterTime,
                        'event'     => $this->snapshotEvent($after, $id),
                    ]);
                }

                // Activity notifications: closed / reopened (Today checkmark uses /api/events/close)
                $beforeClosed = is_array($before) ? !empty($before['close_time']) : false;
                $afterClosed  = is_array($after)  ? !empty($after['close_time'])  : false;
                if ($beforeClosed !== $afterClosed) {
                    $this->notifyFanout($afterClosed ? 'event_closed' : 'event_reopened', $id, [
                        'from_close_time' => is_array($before) ? (string)($before['close_time'] ?? '') : '',
                        'to_close_time'   => is_array($after)  ? (string)($after['close_time']  ?? '') : '',
                        'close_user_id'   => is_array($after)  ? (string)($after['close_user_id'] ?? '') : '',
                        'event'           => $this->snapshotEvent($after, $id),
                    ]);
                }

                $beforeDone = is_array($before) && array_key_exists('done', $before) ? (bool)$before['done'] : null;
                $afterDone  = is_array($after)  && array_key_exists('done',  $after)  ? (bool)$after['done']  : null;
                if ($beforeDone !== null && $afterDone !== null && $beforeDone !== $afterDone) {
                    $this->notifyFanout('event_done_changed', $id, [
                        'from_done' => $beforeDone ? 1 : 0,
                        'to_done'   => $afterDone  ? 1 : 0,
                        'event'     => $this->snapshotEvent($after, $id),
                    ]);
                }
            
                // Activity notifications: important field changes
                $beforeTitle = is_array($before) ? (string)($before['title'] ?? '') : '';
                $afterTitle  = is_array($after)  ? (string)($after['title']  ?? '') : '';
                if (trim($beforeTitle) !== trim($afterTitle)) {
                    $this->notifyFanout('event_title_changed', $id, [
                        'from_title' => $beforeTitle,
                        'to_title'   => $afterTitle,
                        'event'      => $this->snapshotEvent($after, $id),
                    ]);
                }


$beforeDesc = is_array($before) ? (string)($before['description'] ?? '') : '';
$afterDesc  = is_array($after)  ? (string)($after['description']  ?? '') : '';
if (trim($beforeDesc) !== trim($afterDesc)) {
    $this->notifyFanout('event_desc_changed', $id, [
        'event' => $this->snapshotEvent($after, $id),
    ]);
}

                $beforeIn  = is_array($before) ? (string)($before['incoming_no'] ?? '') : '';
                $afterIn   = is_array($after)  ? (string)($after['incoming_no']  ?? '') : '';
                $beforeOut = is_array($before) ? (string)($before['outgoing_no'] ?? '') : '';
                $afterOut  = is_array($after)  ? (string)($after['outgoing_no']  ?? '') : '';
                if (trim($beforeIn) !== trim($afterIn) || trim($beforeOut) !== trim($afterOut)) {
                    $this->notifyFanout('event_docs_changed', $id, [
                        'from_in'  => $beforeIn,
                        'to_in'    => $afterIn,
                        'from_out' => $beforeOut,
                        'to_out'   => $afterOut,
                        'event'    => $this->snapshotEvent($after, $id),
                    ]);
                }

                $beforeOwner = is_array($before) ? (string)($before['owner'] ?? '') : '';
                $afterOwner  = is_array($after)  ? (string)($after['owner']  ?? '') : '';
                if (trim($beforeOwner) !== trim($afterOwner)) {
                    $this->notifyFanout('event_owner_changed', $id, [
                        'from_owner' => $beforeOwner,
                        'to_owner'   => $afterOwner,
                        'event'      => $this->snapshotEvent($after, $id),
                    ]);
                }

                $beforeUrg2 = is_array($before) && array_key_exists('urgent', $before) ? (bool)$before['urgent'] : null;
                $afterUrg2  = is_array($after)  && array_key_exists('urgent',  $after) ? (bool)$after['urgent']  : null;
                if ($beforeUrg2 !== null && $afterUrg2 !== null && $beforeUrg2 !== $afterUrg2) {
                    $this->notifyFanout('event_urgent_changed', $id, [
                        'from_urgent' => $beforeUrg2 ? 1 : 0,
                        'to_urgent'   => $afterUrg2  ? 1 : 0,
                        'event'       => $this->snapshotEvent($after, $id),
                    ]);
                }

} catch (\Throwable $__) {
                // ignore
            }
        }

        return (bool)$ok;
    }

    /**
     * Видалення події за ID.
     *
     * Викликається з ApiEventsController::delete():
     *   $this->repo->deleteById($id);
     */
    public function deleteById(string $id): bool
    {
        $before = null;
        try {
            $before = $this->inner->get($id);
        } catch (\Throwable $__) {
            // ignore
        }

        $res = $this->inner->delete($id);
        $ok  = !isset($res['error']);

        $this->logger->log(
            'calendar.event.delete',
            $ok ? 'success' : 'error',
            array_merge(
                $this->userContext(),
                [
                    'entity_type'   => 'event',
                    'entity_id'     => $id,
                    'event_before'  => $before,
                    'delete_result' => $res,
                ]
            )
        );

        if ($ok) {
            // Notify all users about deletion (store snapshot because event row is gone).
            $this->notifyFanout('event_deleted', $id, [
                'event' => $this->snapshotEvent($before, $id),
            ]);
        }

        return (bool)$ok;
    }

    /**
     * Позначити подію виконаною / не виконаною.
     *
     * Викликається з ApiEventsController::done():
     *   $this->repo->setDone($id, $done);
     */
    public function setDone(string $id, bool $done): bool
    {
        $before = null;
        try {
            $before = $this->inner->get($id);
        } catch (\Throwable $__) {
            // ignore
        }

        $res = $this->inner->setDone($id, $done);
        $ok  = !isset($res['error']);

        $after = null;
        try {
            $after = $this->inner->get($id);
        } catch (\Throwable $__) {
            // ignore
        }

        $this->logger->log(
            'calendar.event.done',
            $ok ? 'success' : 'error',
            array_merge(
                $this->userContext(),
                [
                    'entity_type'   => 'event',
                    'entity_id'     => $id,
                    'done'          => $done,
                    'event_before'  => $before,
                    'event_after'   => $after,
                    'result'        => $res,
                ]
            )
        );

        // Activity notification: done status changed
        if ($ok) {
            $beforeDone = is_array($before) && array_key_exists('done', $before) ? (bool)$before['done'] : null;
            $afterDone  = is_array($after)  && array_key_exists('done',  $after)  ? (bool)$after['done']  : null;
            if ($beforeDone !== null && $afterDone !== null && $beforeDone !== $afterDone) {
                $this->notifyFanout('event_done_changed', $id, [
                    'from_done' => $beforeDone ? 1 : 0,
                    'to_done'   => $afterDone  ? 1 : 0,
                    'event'     => $this->snapshotEvent($after, $id),
                ]);
            }
        }

        return (bool)$ok;
    }

    /**
     * Позначити подію терміновою / не терміновою.
     *
     * Викликається з ApiEventsController::urgent():
     *   $this->repo->setUrgent($id, $urgent);
     */
    public function setUrgent(string $id, bool $urgent): bool
    {
        $before = null;
        try {
            $before = $this->inner->get($id);
        } catch (\Throwable $__) {
            // ignore
        }

        $res = $this->inner->setUrgent($id, $urgent);
        $ok  = !isset($res['error']);

        $after = null;
        try {
            $after = $this->inner->get($id);
        } catch (\Throwable $__) {
            // ignore
        }

        $this->logger->log(
            'calendar.event.urgent',
            $ok ? 'success' : 'error',
            array_merge(
                $this->userContext(),
                [
                    'entity_type'   => 'event',
                    'entity_id'     => $id,
                    'urgent'        => $urgent,
                    'event_before'  => $before,
                    'event_after'   => $after,
                    'result'        => $res,
                ]
            )
        );

        // Activity notification: urgent flag changed
        if ($ok) {
            $beforeUrg = is_array($before) && array_key_exists('urgent', $before) ? (bool)$before['urgent'] : null;
            $afterUrg  = is_array($after)  && array_key_exists('urgent',  $after) ? (bool)$after['urgent']  : null;
            if ($beforeUrg !== null && $afterUrg !== null && $beforeUrg !== $afterUrg) {
                $this->notifyFanout('event_urgent_changed', $id, [
                    'from_urgent' => $beforeUrg ? 1 : 0,
                    'to_urgent'   => $afterUrg  ? 1 : 0,
                    'event'       => $this->snapshotEvent($after, $id),
                ]);
            }
        }

        return (bool)$ok;
    }
}
