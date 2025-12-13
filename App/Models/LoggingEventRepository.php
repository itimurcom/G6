<?php
declare(strict_types=1);

namespace App\Models;

use App\Services\Audit\ActionLogger;
use App\Core\Auth;

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
        // COMPAT: FileEventRepository::search(string $q) returns flat array of events with injected '_date'
        // [DEFERRED] Legacy forwarder (kept for reference; do not remove):
        // return $this->inner->search($filters, $limit, $offset);

        $q = (string)($filters['text'] ?? '');

        $rows = $this->inner->search($q);

        // normalize filters
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

        $out = [];
        foreach ($rows as $ev) {
            if (!is_array($ev)) continue;

            // exact filters
            if ($type !== null && (string)($ev['type'] ?? '') !== $type) continue;
            if ($owner !== null && (string)($ev['owner'] ?? '') !== $owner) continue;

            if ($urgent !== null && (bool)($ev['urgent'] ?? false) !== $urgent) continue;
            if ($done !== null && (bool)($ev['done'] ?? false) !== $done) continue;

            // date filters (inclusive)
            $d = (string)($ev['_date'] ?? '');
            $d = substr($d, 0, 10);

            if ($date !== '') {
                if ($d !== $date) continue;
            } else {
                if ($start !== '' && $d !== '' && $d < $start) continue;
                if ($end   !== '' && $d !== '' && $d > $end)   continue;
            }

            $out[] = $ev;
        }

        $offset = max(0, (int)$offset);
        $limit  = max(0, (int)$limit);

        if ($limit === 0) {
            return [];
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
    public function create(string $date, array $payload): string
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

        $this->logger->log(
            'calendar.event.create',
            $id !== '' ? 'success' : 'error',
            array_merge(
                $this->userContext(),
                [
                    'entity_type' => 'event',
                    'entity_id'   => $id ?: null,
                    'date'        => $res['date'] ?? $date,
                    'payload'     => $event,
                ]
            )
        );

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
                    'event_after'   => $event,
                    'update_result' => $res,
                ]
            )
        );

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

        return (bool)$ok;
    }
}
