<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Models\EventMysqlRepository;

class ApiBackupController
{
    // was private; keep protected for tests
    protected EventMysqlRepository $repo;

    public function __construct()
    {
        $this->repo = new EventMysqlRepository();
    }

    /** alias of export for legacy */
    public function events(): void
    {
        if (!$this->requireAdmin()) { return; }
        $this->json($this->exportStoreFromDb());
    }

    /** alias of import for legacy */
    public function store(): void
    {
        if (!$this->requireAdmin()) { return; }
        if (!$this->requireCsrf()) { return; }
        $incoming = $this->unwrapStorePayload($this->readJson());
        $summary = $this->applyStoreDiffToDb($incoming);
        $this->json($summary);
    }

    public function export(): void
    {
        if (!$this->requireAdmin()) { return; }
        $this->json($this->exportStoreFromDb());
    }

    public function import(): void
    {
        if (!$this->requireAdmin()) { return; }
        if (!$this->requireCsrf()) { return; }
        $incoming = $this->unwrapStorePayload($this->readJson());
        $summary = $this->applyStoreDiffToDb($incoming);
        $this->json($summary);
    }

    public function diag(): void
    {
        if (!$this->requireAdmin()) { return; }

        // JSON-file repair is no longer applicable (Stage 1: JSON storage removed).
        if (isset($_GET['repair'])) {
            $this->json([
                'ok'      => false,
                'error'   => 'not_supported',
                'message' => 'Repair is not supported for MySQL backend.',
            ], 501);
            return;
        }

        try {
            $db = Database::connect();
            $row = $db->query('SELECT COUNT(*) AS c, MIN(start_date) AS min_date, MAX(start_date) AS max_date FROM events')
                ->fetch();

            $this->json([
                'ok'          => true,
                'backend'     => 'mysql',
                'events_count'=> (int)($row['c'] ?? 0),
                'min_date'    => $row['min_date'] ?? null,
                'max_date'    => $row['max_date'] ?? null,
            ]);
        } catch (\Throwable $e) {
            $this->json([
                'ok'      => false,
                'error'   => 'internal',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /** simple route for repair (kept for compatibility) */
    public function repair(): void
    {
        if (!$this->requireAdmin()) { return; }
        $this->json([
            'ok'      => false,
            'error'   => 'not_supported',
            'message' => 'Repair is not supported for MySQL backend.',
        ], 501);
    }

    // --- DB export/import helpers (protected for tests) ---

    /**
     * Export events from MySQL in the same logical "store" shape: { date => [events...] }.
     * The payload is JSON-ready and contains only dates that have at least one event.
     */
    protected function exportStoreFromDb(): array
    {
        $store = [];
        $db = Database::connect();
        $stmt = $db->query('SELECT * FROM events ORDER BY start_date ASC, time ASC, created_at ASC');
        $rows = $stmt->fetchAll();

        foreach ($rows as $row) {
            if (!is_array($row)) { continue; }
            $date = (string)($row['start_date'] ?? '');
            if ($date === '') { continue; }

            // Frontend expects these conventions
            $row['_date']  = $date;
            $row['urgent'] = !empty($row['urgent']);
            $row['done']   = !empty($row['done']);

            if (!isset($store[$date])) { $store[$date] = []; }
            $store[$date][] = $row;
        }

        return $store;
    }

    /**
     * Accepts either raw store or wrapped payloads like {data:{store:{...}}}.
     */
    protected function unwrapStorePayload(array $payload): array
    {
        if (isset($payload['data']) && is_array($payload['data'])) {
            $payload = $payload['data'];
        }
        if (isset($payload['store']) && is_array($payload['store'])) {
            $payload = $payload['store'];
        }
        return is_array($payload) ? $payload : [];
    }

    protected function applyStoreDiffToDb(array $incomingStore): array
    {
        $currentStore = $this->exportStoreFromDb();
        $curIdx = $this->indexStore($currentStore);
        $newIdx = $this->indexStore($incomingStore);

        $created = 0; $updated = 0; $moved = 0; $deleted = 0;

        // Delete
        foreach ($curIdx as $id => $info) {
            if (!isset($newIdx[$id])) {
                $this->repo->deleteById((string)$id);
                $deleted++;
            }
        }

        // Preserve original creators on update; set creator on create
        $existingUsers = [];
        foreach ($curIdx as $id => $info) {
            $existingUsers[$id] = isset($info['ev']['user_id']) ? (int)$info['ev']['user_id'] : 0;
        }
        $actorId = $this->getActorUserId();

        // Create / Update / Move
        foreach ($newIdx as $id => $n) {
            $newD = (string)($n['date'] ?? '');
            $nev  = is_array($n['ev'] ?? null) ? $n['ev'] : [];

            if (!isset($curIdx[$id])) {
                // create
                if (!isset($nev['user_id']) || $nev['user_id'] === '' || $nev['user_id'] === null) {
                    $nev['user_id'] = $actorId;
                }
                $this->repo->create($newD, ['event' => $this->sanitizeEventForDb($nev)]);
                $created++;
                continue;
            }

            // update / move
            $o = $curIdx[$id];
            $oldD = (string)($o['date'] ?? '');
            $old  = is_array($o['ev'] ?? null) ? $o['ev'] : [];

            // preserve creator (user_id) on update
            $nev['user_id'] = $existingUsers[$id] ?? (int)($old['user_id'] ?? 0);

            $changed = $this->hasEventChanged($old, $nev, $oldD, $newD);
            if ($oldD !== $newD) {
                $this->repo->updateById((string)$id, [
                    'date'  => $newD,
                    'event' => $this->sanitizeEventForDb($nev),
                ]);
                $moved++;
            } elseif ($changed) {
                $this->repo->updateById((string)$id, [
                    'date'  => $newD,
                    'event' => $this->sanitizeEventForDb($nev),
                ]);
                $updated++;
            }
        }

        return [
            'ok'      => true,
            'created' => $created,
            'updated' => $updated,
            'moved'   => $moved,
            'deleted' => $deleted,
        ];
    }

    /** Index store by event id. */
    protected function indexStore(array $store): array
    {
        $idx = [];
        foreach ($store as $date => $arr) {
            if (!is_array($arr)) { continue; }
            foreach ($arr as $i => $ev) {
                if (!is_array($ev)) { continue; }
                $id = $ev['id'] ?? null;
                if ($id === null || $id === '') { continue; }
                $idx[(string)$id] = ['date' => (string)$date, 'index' => (int)$i, 'ev' => $ev];
            }
        }
        return $idx;
    }

    /**
     * Compare two event payloads in a stable way (ignore backend-only fields).
     */
    protected function hasEventChanged(array $old, array $new, string $oldDate, string $newDate): bool
    {
        $a = $this->eventForCompare($old, $oldDate);
        $b = $this->eventForCompare($new, $newDate);
        return json_encode($a, JSON_UNESCAPED_UNICODE) !== json_encode($b, JSON_UNESCAPED_UNICODE);
    }

    protected function eventForCompare(array $ev, string $date): array
    {
        $out = [];
        $keys = [
            'id','time','title','description','owner','type','incoming_no','outgoing_no',
            'urgent','done','end_date','close_user_id','close_time',
        ];
        foreach ($keys as $k) {
            $out[$k] = $ev[$k] ?? null;
        }
        $out['_date'] = $date;
        return $out;
    }

    /**
     * Keep only DB-supported fields (ignore _date and unknown keys).
     */
    protected function sanitizeEventForDb(array $ev): array
    {
        // normalize booleans
        if (isset($ev['urgent'])) { $ev['urgent'] = !empty($ev['urgent']); }
        if (isset($ev['done']))   { $ev['done']   = !empty($ev['done']); }

        $allowed = [
            'id','time','title','description','owner','type','incoming_no','outgoing_no',
            'urgent','done','end_date','user_id','close_user_id','close_time',
        ];
        $out = [];
        foreach ($allowed as $k) {
            if (array_key_exists($k, $ev)) {
                $out[$k] = $ev[$k];
            }
        }
        return $out;
    }

    /** Actor id (admin) from session, used for assigning creator on import. */
    protected function getActorUserId(): int
    {
        if (session_status() !== \PHP_SESSION_ACTIVE) { @session_start(); }
        $uid = (int)($_SESSION['user_id'] ?? 0);
        if ($uid > 0) { return $uid; }

        $u = $_SESSION['user'] ?? null;
        if (is_array($u) && !empty($u['id'])) {
            return (int)$u['id'];
        }
        return 0;
    }

    // --- helpers (protected for tests) ---
    protected function requireAdmin(): bool
    {
        if (session_status() !== \PHP_SESSION_ACTIVE) { @session_start(); }

        $u = $_SESSION['user'] ?? null;
        $role = is_array($u) ? (string)($u['role'] ?? '') : '';
        $isAdmin = false;
        if (is_array($u)) {
            $flag = $u['is_admin'] ?? false;
            $isAdmin =
                ($flag === true) ||
                ((int)$flag === 1) ||
                in_array(mb_strtolower($role), ['admin','superadmin','root'], true);
        }

        if ($isAdmin) {
            return true;
        }

        $this->json([
            'ok'      => false,
            'error'   => 'forbidden',
            'message' => 'Admin only',
        ], 403);
        return false;
    }

    protected function requireCsrf(): bool
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

    protected function readJson(): array
    {
        $raw = file_get_contents('php://input');
        $json = json_decode($raw ?: "{}", true);
        return is_array($json) ? $json : [];
    }

    protected function json($data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
