<?php
declare(strict_types=1);

namespace App\Models;

final class FileEventRepository
{
    private EventStore $store;

    public function __construct(?EventStore $store = null)
    {
        $this->store = $store ?? new EventStore();
    }

    /** Повертає масив подій за YYYY-MM-DD */
    public function listByDate(string $date): array
    {
        $d = substr($date, 0, 10);
        $store = $this->store->normalizeStore($this->store->read());
        return $store[$d] ?? [];
    }

    /** Повертає {date => events[]} у включному проміжку [start, end] */
    public function listByRange(string $start, string $end): array
    {
        $store = $this->store->normalizeStore($this->store->read());
        $out = [];
        $s = new \DateTime(substr($start, 0, 10));
        $e = new \DateTime(substr($end, 0, 10));
        if ($s > $e) { $t = $s; $s = $e; $e = $t; }
        for ($d = clone $s; $d <= $e; $d->modify('+1 day')) {
            $key = $d->format('Y-m-d');
            $out[$key] = $store[$key] ?? [];
        }
        return $out;
    }

    /** Знайти подію за id; повертає подію + _date або null */
    public function get(string $id): ?array
    {
        $store = $this->store->normalizeStore($this->store->read());
        foreach ($store as $date => $arr) {
            foreach ($arr as $ev) {
                if ((string)($ev['id'] ?? '') === $id) {
                    $ev['_date'] = $date;
                    return $ev;
                }
            }
        }
        return null;
    }

    private function uuidV4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    /** Створити подію у дні; повертає підсумок writeDiff() + id/date */
    public function create(string $date, array $event): array
    {
        $d = substr($date, 0, 10);
        $current = $this->store->normalizeStore($this->store->read());
        $next = $current;

        if (!isset($next[$d]) || !is_array($next[$d])) $next[$d] = [];
        if (empty($event['id']) || !is_string($event['id'])) $event['id'] = $this->uuidV4();
        // Inject current user id if missing (before storing)
        if (!isset($event['user_id']) || $event['user_id'] === '' || $event['user_id'] === null) { $event['user_id'] = (int)(\App\Core\Auth::id() ?? 0); }
        // Preserve creator: if user_id not provided, keep from old record (if found); otherwise set current auth id
        if (!isset($event['user_id']) || $event['user_id'] === '' || $event['user_id'] === null) {
            try {
                $existing = $this->get($id);
                if (is_array($existing) && isset($existing['user_id'])) { $event['user_id'] = (int)$existing['user_id']; }
            } catch (\Throwable $__) { /* ignore */ }
            if (!isset($event['user_id']) || $event['user_id'] === '' || $event['user_id'] === null) { $event['user_id'] = (int)(\App\Core\Auth::id() ?? 0); }
        }
        $next[$d][] = $event;

        $res = $this->store->writeDiff($next);
        $res['id'] = $event['id'];
        $res['date'] = $d;
        return $res;
    }

    /** Оновити подію (може змінити день); повертає підсумок writeDiff() + id/date */
    public function update(string $date, array $event): array
    {
        $id = (string)($event['id'] ?? '');
        if ($id === '') throw new \InvalidArgumentException('id is required');

        $d = substr($date, 0, 10);
        $current = $this->store->normalizeStore($this->store->read());
        $next = $current;

        // прибираємо старий екземпляр
        foreach ($next as $day => &$arr) {
            if (!is_array($arr)) continue;
            foreach ($arr as $i => $ev) {
                if ((string)($ev['id'] ?? '') === $id) { array_splice($arr, $i, 1); break 2; }
            }
        }
        unset($arr);

        if (!isset($next[$d]) || !is_array($next[$d])) $next[$d] = [];
        // Preserve creator: if user_id not provided, keep from old record (if found); otherwise set current auth id
        if (!isset($event['user_id']) || $event['user_id'] === '' || $event['user_id'] === null) {
            try {
                $existing = $this->get($id);
                if (is_array($existing) && isset($existing['user_id'])) { $event['user_id'] = (int)$existing['user_id']; }
            } catch (\Throwable $__) { /* ignore */ }
            if (!isset($event['user_id']) || $event['user_id'] === '' || $event['user_id'] === null) { $event['user_id'] = (int)(\App\Core\Auth::id() ?? 0); }
        }
        $next[$d][] = $event;

        $res = $this->store->writeDiff($next);
        $res['id'] = $id;
        $res['date'] = $d;
        return $res;
    }

    /** Видалити за id */
    public function delete(string $id): array
    {
        $current = $this->store->normalizeStore($this->store->read());
        $next = $current;

        foreach ($next as $day => &$arr) {
            if (!is_array($arr)) continue;
            foreach ($arr as $i => $ev) {
                if ((string)($ev['id'] ?? '') === $id) { array_splice($arr, $i, 1); break 2; }
            }
        }
        unset($arr);

        $res = $this->store->writeDiff($next);
        $res['id'] = $id;
        return $res;
    }

    /** Позначити виконаною */
    public function setDone(string $id, bool $done): array
    {
        $ev = $this->get($id);
        if (!$ev) return ['ok' => false, 'error' => 'not_found'];
        $ev['done'] = (bool)$done;
        return $this->update((string)$ev['_date'], $ev);
    }

    /** Позначити терміновою */
    public function setUrgent(string $id, bool $urgent): array
    {
        $ev = $this->get($id);
        if (!$ev) return ['ok' => false, 'error' => 'not_found'];
        $ev['urgent'] = (bool)$urgent;
        return $this->update((string)$ev['_date'], $ev);
    }

    /** Пошук по title/owner/description/incoming_no/outgoing_no (case-insensitive) */
    public function search(string $q): array
    {
        $q = mb_strtolower((string)$q);
        $store = $this->store->normalizeStore($this->store->read());
        $out = [];
        foreach ($store as $date => $arr) {
            if (!is_array($arr)) continue;
            foreach ($arr as $ev) {
                $hay = mb_strtolower(
                    (string)($ev['title'] ?? '') . "\n" .
                    (string)($ev['owner'] ?? '') . "\n" .
                    (string)($ev['description'] ?? '') . "\n" .
                    (string)($ev['incoming_no'] ?? '') . "\n" .
                    (string)($ev['outgoing_no'] ?? '')
                );
                if ($q === '' || mb_strpos($hay, $q) !== false) {
                    $ev['_date'] = $date;
                    $out[] = $ev;
                }
            }
        }
        return $out;
    }
}
