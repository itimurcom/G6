<?php
declare(strict_types=1);

namespace App\Models;

interface EventRepositoryInterface {
    public function getByDate(string $date): array;
    public function getByRange(string $start, string $end): array;
    public function getById(string $id): ?array;
    public function create(array $data): string;
    public function update(string $id, array $patch): bool;
    public function delete(string $id): bool;
    public function setDone(string $id, bool $done): bool;
    public function setUrgent(string $id, bool $urgent): bool;
}

class FileEventRepository implements EventRepositoryInterface {
    private ?object $store = null; // any with read():array, write(array):void
    private string $dbFile;

    public function __construct($storeOrPath = null) {
        if (is_object($storeOrPath) && method_exists($storeOrPath, 'read') && method_exists($storeOrPath, 'write')) {
            $this->store = $storeOrPath;
            $this->dbFile = method_exists($storeOrPath, 'getPath') ? (string)$storeOrPath->getPath() : (__DIR__ . '/../../storage/data/db.json');
        } else {
            $this->dbFile = (string)($storeOrPath ?: (__DIR__ . '/../../storage/data/db.json'));
        }
        if (!is_dir(dirname($this->dbFile))) @mkdir(dirname($this->dbFile), 0777, true);
        if (!file_exists($this->dbFile)) file_put_contents($this->dbFile, "{}");
    }

    /* ===== Store IO ===== */
    private function storeRead(): array {
        if ($this->store) return (array)$this->store->read();
        $raw = @file_get_contents($this->dbFile);
        $json = json_decode($raw ?: "{}", true);
        return is_array($json) ? $json : [];
    }

    private function storeWrite(array $store): void {
        // 1) Normalize: ensure every event has an id (assign new if missing)
        $store = $this->normalizeStore($store);
        // 2) Dedupe by id: keep the LAST occurrence by date order (YYYY-MM-DD ascending)
        $store = $this->dedupeById($store);
        // 3) Persist
        if ($this->store) { $this->store->write($store); return; }
        file_put_contents($this->dbFile, json_encode($store, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
    }

    /* ===== Utils ===== */
    private function uuidV4(): string {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    private function sanitizeEvent(array $in, bool $requireId = true): array {
        $out = [];
        $id = (string)($in['id'] ?? '');
        if ($requireId && $id === '') throw new \InvalidArgumentException('id is required');
        if ($id !== '') $out['id'] = $id;

        $map = ['time','title','owner','type','incoming_no','outgoing_no','description'];
        foreach ($map as $f) if (array_key_exists($f, $in)) $out[$f] = is_scalar($in[$f]) ? (string)$in[$f] : '';

        if (array_key_exists('urgent', $in)) $out['urgent'] = (bool)$in['urgent'];
        if (array_key_exists('done',   $in)) $out['done']   = (bool)$in['done'];
        if (array_key_exists('user_id',$in)) $out['user_id']= (int)$in['user_id'];
        return $out;
    }

    private function stripDate(array $ev): array {
        $cp = $ev; unset($cp['date'], $cp['event_date']); return $cp;
    }

    /** Ensure each event has an id; keep structure intact; do NOT drop entries. */
    private function normalizeStore(array $store): array {
        $out = [];
        foreach ($store as $date => $arr) {
            $d = substr((string)$date, 0, 10);
            if (!isset($out[$d])) $out[$d] = [];
            if (!is_array($arr)) $arr = [];
            foreach ($arr as $ev) {
                if (!is_array($ev)) continue;
                // clone to avoid references
                $e = $ev;
                if (empty($e['id']) || !is_string($e['id'])) {
                    $e['id'] = $this->uuidV4();
                }
                // normalize types lightly
                if (isset($e['urgent'])) $e['urgent'] = (bool)$e['urgent'];
                if (isset($e['done']))   $e['done']   = (bool)$e['done'];
                if (isset($e['user_id']))$e['user_id']= (int)$e['user_id'];
                $out[$d][] = $e;
            }
        }
        // keep empty dates as empty arrays
        foreach ($store as $date => $arr) {
            $d = substr((string)$date, 0, 10);
            if (!isset($out[$d])) $out[$d] = [];
        }
        ksort($out, SORT_STRING);
        return $out;
    }

    /** Remove duplicates by id globally. Keep the LAST by date order. */
    private function dedupeById(array $store): array {
        // iterate dates ascending; if we see an id again later, we DROP earlier one
        $dates = array_keys($store);
        sort($dates, SORT_STRING);
        $seenDateIdx = []; // id => ['date' => string, 'index' => int]
        $out = [];
        foreach ($dates as $date) {
            $arr = $store[$date] ?? [];
            if (!is_array($arr)) $arr = [];
            $out[$date] = [];
            foreach ($arr as $ev) {
                if (!is_array($ev)) continue;
                $id = (string)($ev['id'] ?? '');
                if ($id === '') { // safety: preserve entries without id (shouldn't happen after normalize)
                    $out[$date][] = $ev;
                    continue;
                }
                // If we've seen this id before, remove earlier one from where it was stored.
                if (isset($seenDateIdx[$id])) {
                    $prev = $seenDateIdx[$id];
                    if (isset($out[$prev['date']][$prev['index']])) {
                        unset($out[$prev['date']][$prev['index']]);
                        // reindex
                        $out[$prev['date']] = array_values($out[$prev['date']]);
                    }
                }
                // append current and remember
                $out[$date][] = $ev;
                $seenDateIdx[$id] = ['date' => $date, 'index' => count($out[$date]) - 1];
            }
        }
        // ensure arrays
        foreach ($out as $d => $arr) $out[$d] = array_values(is_array($arr) ? $arr : []);
        return $out;
    }

    /* ===== Queries ===== */
    public function getByDate(string $date): array {
        $k = substr($date, 0, 10);
        $all = $this->storeRead();
        $arr = $all[$k] ?? [];
        return is_array($arr) ? $arr : [];
    }

    public function getByRange(string $start, string $end): array {
        $all = $this->storeRead();
        $s = substr($start,0,10); $e = substr($end,0,10);
        $out = [];
        foreach ($all as $d => $arr) {
            if ($d >= $s && $d <= $e) $out[$d] = is_array($arr) ? $arr : [];
        }
        return $out;
    }

    public function getById(string $id): ?array {
        $all = $this->storeRead();
        foreach ($all as $d => $arr) {
            if (!is_array($arr)) continue;
            foreach ($arr as $ev) if (($ev['id'] ?? null) === $id) return $ev + ['date' => $d];
        }
        return null;
    }

    /* ===== Mutations ===== */
    public function create(array $data): string {
        $date = (string)($data['date'] ?? $data['event_date'] ?? '');
        if ($date === '') throw new \InvalidArgumentException('date is required');
        $ev = $this->sanitizeEvent($data, false);
        if (empty($ev['id'])) $ev['id'] = $this->uuidV4();

        $all = $this->storeRead();

        // UPSERT: if id exists -> update/move, not duplicate
        $existingDate = null; $existingIdx = null;
        foreach ($all as $d => $arr) {
            if (!is_array($arr)) continue;
            foreach ($arr as $i => $item) {
                if (isset($item['id']) && $item['id'] === $ev['id']) { $existingDate = $d; $existingIdx = $i; break 2; }
            }
        }
        if ($existingDate !== null) {
            if ($existingDate !== $date) {
                array_splice($all[$existingDate], $existingIdx, 1);
                if (empty($all[$existingDate])) $all[$existingDate] = [];
                $all[$date] = isset($all[$date]) && is_array($all[$date]) ? $all[$date] : [];
                $all[$date][] = $this->stripDate($ev);
            } else {
                $all[$existingDate][$existingIdx] = $this->stripDate($ev);
            }
            $this->storeWrite($all);
            return $ev['id'];
        }

        // create new
        $all[$date] = isset($all[$date]) && is_array($all[$date]) ? $all[$date] : [];
        $all[$date][] = $this->stripDate($ev);
        $this->storeWrite($all);
        return $ev['id'];
    }

    public function update(string $id, array $patch): bool {
        $all = $this->storeRead();
        $oldDate = null; $oldIdx = null; $old = null;

        foreach ($all as $d => $arr) {
            if (!is_array($arr)) continue;
            foreach ($arr as $i => $ev) {
                if (($ev['id'] ?? null) === $id) { $oldDate = $d; $oldIdx = $i; $old=$ev; break 2; }
            }
        }
        if ($old === null) return false;

        $newDate = (string)($patch['date'] ?? $oldDate);
        unset($patch['id']);
        $upd = array_merge($old, $this->sanitizeEvent($patch, false));

        array_splice($all[$oldDate], $oldIdx, 1);
        if (!isset($all[$newDate]) || !is_array($all[$newDate])) $all[$newDate] = [];
        $all[$newDate][] = $this->stripDate($upd);

        $this->storeWrite($all);
        return true;
    }

    public function delete(string $id): bool {
        $all = $this->storeRead();
        $changed = false;
        foreach ($all as $d => &$arr) {
            if (!is_array($arr)) continue;
            foreach ($arr as $i => $ev) {
                if (($ev['id'] ?? null) === $id) { array_splice($arr, $i, 1); $changed = true; break 2; }
            }
        }
        if ($changed) $this->storeWrite($all);
        return $changed;
    }

    public function setDone(string $id, bool $done): bool { return $this->update($id, ['done' => $done]); }
    public function setUrgent(string $id, bool $urgent): bool { return $this->update($id, ['urgent' => $urgent]); }
}
