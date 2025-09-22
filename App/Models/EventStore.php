<?php
declare(strict_types=1);

namespace App\Models;

final class EventStore
{
    private string $path;

    public function __construct(?string $path = null)
    {
        $this->path = $path ?: __DIR__ . '/../../storage/data/db.json';
        $dir = dirname($this->path);
        if (!is_dir($dir)) { @mkdir($dir, 0777, true); }
        if (!file_exists($this->path)) { @file_put_contents($this->path, "{}"); }
    }

    public function getPath(): string {
        return $this->path; 
    }

    public function read(): array
    {
        $raw = @file_get_contents($this->path);
        $json = json_decode($raw ?: "{}", true);
        return is_array($json) ? $json : [];
    }

    public function write(array $store): void
    {
        $tmp = $this->path . '.tmp';
        $json = json_encode($store, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($json === false) { throw new \RuntimeException('Failed to encode store'); }
        if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
            throw new \RuntimeException('Failed to write temp file');
        }
        if (!@rename($tmp, $this->path)) {
            @unlink($this->path);
            if (!@rename($tmp, $this->path)) {
                throw new \RuntimeException('Failed to move temp store into place');
            }
        }
    }

    private function uuidV4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    public function normalizeStore(array $store): array
    {
        $out = [];
        foreach ($store as $date => $arr) {
            $d = substr((string)$date, 0, 10);
            if (!isset($out[$d])) { $out[$d] = []; }
            if (!is_array($arr)) { $arr = []; }
            foreach ($arr as $ev) {
                if (!is_array($ev)) { continue; }
                $e = $ev;
                if (empty($e['id']) || !is_string($e['id'])) {
                    $e['id'] = $this->uuidV4();
                }
                foreach (['time','title','owner','type','incoming_no','outgoing_no','description'] as $f) {
                    if (isset($e[$f]) && !is_string($e[$f])) $e[$f] = (string)$e[$f];
                    if (!isset($e[$f])) $e[$f] = '';
                }
                $e['urgent'] = !empty($e['urgent']);
                $e['done']   = !empty($e['done']);
                $e['user_id'] = isset($e['user_id']) ? (int)$e['user_id'] : 0;
                $out[$d][] = $e;
            }
        }
        ksort($out, SORT_STRING);
        foreach ($store as $date => $arr) {
            $d = substr((string)$date, 0, 10);
            if (!isset($out[$d])) $out[$d] = [];
        }
        return $out;
    }

    private function indexStore(array $store): array
    {
        $idx = [];
        foreach ($store as $date => $arr) {
            if (!is_array($arr)) continue;
            foreach ($arr as $i => $ev) {
                if (!is_array($ev)) continue;
                $id = (string)($ev['id'] ?? '');
                if ($id === '') continue;
                $idx[$id] = ['date' => $date, 'index' => $i, 'ev' => $ev];
            }
        }
        return $idx;
    }

    public function dedupe(array $store): array
    {
        $dates = array_keys($store);
        sort($dates, SORT_STRING);
        $seen = [];
        $out = [];
        foreach ($dates as $d) {
            $arr = $store[$d] ?? [];
            if (!is_array($arr)) $arr = [];
            $bucket = [];
            foreach ($arr as $ev) {
                if (!is_array($ev)) continue;
                $id = (string)($ev['id'] ?? '');
                if ($id === '') { $bucket[] = $ev; continue; }
                if (isset($seen[$id])) {
                    $prevD = $seen[$id]['date'];
                    $prevI = $seen[$id]['index'];
                    if (isset($out[$prevD][$prevI])) {
                        unset($out[$prevD][$prevI]);
                        $out[$prevD] = array_values($out[$prevD]);
                        foreach ($out[$prevD] as $k => $v) {
                            if (isset($v['id']) && $v['id'] !== '') {
                                $seen[$v['id']] = ['date' => $prevD, 'index' => $k];
                            }
                        }
                    }
                }
                $bucket[] = $ev;
                $seen[$id] = ['date'=>$d, 'index'=>count($bucket)-1];
            }
            $out[$d] = $bucket;
        }
        return $out;
    }

    public function writeDiff(array $incoming): array
    {
        $current = $this->normalizeStore($this->read());
        $next    = $this->normalizeStore($incoming);

        $curIdx = $this->indexStore($current);
        $newIdx = $this->indexStore($next);

        $created = 0; $updated = 0; $moved = 0; $deleted = 0;

        foreach ($curIdx as $id => $info) {
            if (!isset($newIdx[$id])) {
                $d = $info['date']; $i = $info['index'];
                array_splice($current[$d], $i, 1);
                $deleted++;
                $curIdx = $this->indexStore($current);
            }
        }

        foreach ($newIdx as $id => $n) {
            if (!isset($curIdx[$id])) {
                $d = $n['date'];
                if (!isset($current[$d]) || !is_array($current[$d])) $current[$d] = [];
                $current[$d][] = $n['ev'];
                $created++;
            } else {
                $o = $curIdx[$id];
                $oldD = $o['date']; $old = $o['ev'];
                $newD = $n['date']; $nev = $n['ev'];
                $changed = json_encode($old, JSON_UNESCAPED_UNICODE) !== json_encode($nev, JSON_UNESCAPED_UNICODE);
                if ($oldD !== $newD) {
                    array_splice($current[$oldD], $o['index'], 1);
                    if (!isset($current[$newD]) || !is_array($current[$newD])) $current[$newD] = [];
                    $current[$newD][] = $nev;
                    $moved++;
                } elseif ($changed) {
                    $current[$oldD][$o['index']] = $nev;
                    $updated++;
                }
            }
        }

        $current = $this->dedupe($current);
        $this->write($current);

        return [
            'ok' => true,
            'created' => $created,
            'updated' => $updated,
            'moved'   => $moved,
            'deleted' => $deleted,
        ];
    }

    public function repairSummary(bool $apply = false): array
    {
        $before = $this->read();

        // Count events and missing IDs in the original store (before normalization)
        $eventsBefore = 0;
        $missingIdsBefore = 0;
        foreach ($before as $d => $arr) {
            if (!is_array($arr)) continue;
            $eventsBefore += count($arr);
            foreach ($arr as $e) {
                $id = $e['id'] ?? '';
                if (!is_string($id) || $id === '') $missingIdsBefore++;
            }
        }

        // Normalize (assign IDs where missing), then dedupe
        $norm = $this->normalizeStore($before);
        $after = $this->dedupe($norm);

        // Count events after
        $eventsAfter = 0;
        foreach ($after as $d => $arr) { if (is_array($arr)) $eventsAfter += count($arr); }

        // 'ids_assigned' = how many events in the original store had no id at all
        $idsAssigned = $missingIdsBefore;

        // 'dups_removed' = how many total entries got removed due to dedupe
        $dupsRemoved = max(0, $eventsBefore - $eventsAfter);

        // days touched metric: days where content differs
        $daysTouched = 0;
        $all = array_unique(array_merge(array_keys($before), array_keys($after)));
        foreach ($all as $d) {
            $ba = isset($before[$d]) && is_array($before[$d]) ? $before[$d] : [];
            $aa = isset($after[$d]) && is_array($after[$d]) ? $after[$d] : [];
            if (json_encode($ba, JSON_UNESCAPED_UNICODE) !== json_encode($aa, JSON_UNESCAPED_UNICODE)) $daysTouched++;
        }

        if ($apply) $this->write($after);

        return [
            'ok' => true,
            'dry_run' => !$apply,
            'events_before' => $eventsBefore,
            'events_after' => $eventsAfter,
            'ids_assigned' => $idsAssigned,
            'dups_removed' => $dupsRemoved,
            'days_touched' => $daysTouched,
        ];
    }
}
