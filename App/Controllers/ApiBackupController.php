<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\EventStore;

class ApiBackupController
{
    // was private; keep protected for tests
    protected EventStore $store;

    public function __construct()
    {
        $this->store = new EventStore();
    }

    /** alias of export for legacy */
    public function events(): void
    {
        if (!$this->requireAdmin()) { return; }
        $this->json($this->store->read());
    }

    /** alias of import for legacy */
    public function store(): void
    {
        if (!$this->requireAdmin()) { return; }
        if (!$this->requireCsrf()) { return; }
        $payload = $this->readJson();
        if (isset($payload['data']) && is_array($payload['data'])) { $payload = $payload['data']; }
        if (isset($payload['store']) && is_array($payload['store'])) { $payload = $payload['store']; }
        $summary = $this->store->writeDiff(is_array($payload) ? $payload : []);
        $this->json(['ok' => true] + $summary);
    }

    
    /**
     * Soft-deprecated legacy V1 endpoints (cutover to V2).
     * Returns HTTP 410 Gone with guidance. Does not require auth/CSRF.
     */
    public function deprecatedV1(): void
    {
        $this->json([
            'ok'      => false,
            'error'   => 'DEPRECATED',
            'message' => 'Use API V2 endpoints.',
            'hint'    => [
                'read'   => ['/api/events/by-date', '/api/events/by-range', '/api/events/get', '/api/events/search'],
                'write'  => ['/api/events/create', '/api/events/update', '/api/events/delete', '/api/events/done', '/api/events/urgent', '/api/events/close'],
                'backup' => ['/api/backup/export', '/api/backup/import', '/api/backup/diag'],
            ],
        ], 410);
    }

    public function export(): void
    {
        if (!$this->requireAdmin()) { return; }
        $this->json($this->store->read());
    }

    public function import(): void
    {
        if (!$this->requireAdmin()) { return; }
        if (!$this->requireCsrf()) { return; }
        $payload = $this->readJson();
        if (isset($payload['data']) && is_array($payload['data'])) { $payload = $payload['data']; }
        if (isset($payload['store']) && is_array($payload['store'])) { $payload = $payload['store']; }
        $summary = $this->store->writeDiff(is_array($payload) ? $payload : []);
        $this->json(['ok' => true] + $summary);
    }

    public function diag(): void
    {
        if (!$this->requireAdmin()) { return; }
        if (isset($_GET['repair'])) {
            $dry = isset($_GET['dry_run']) ? filter_var($_GET['dry_run'], FILTER_VALIDATE_BOOLEAN) : true;
            $summary = $this->store->repairSummary(!$dry);
            $path = $this->store->getPath();
            $size = file_exists($path) ? filesize($path) : 0;
            $this->json($summary + ['path' => $path, 'size' => $size]);
            return;
        }
        $path = $this->store->getPath();
        $size = file_exists($path) ? filesize($path) : 0;
        $this->json(['ok' => true, 'path' => $path, 'size' => $size]);
    }

    /** simple route for repair */
    public function repair(): void
    {
        if (!$this->requireAdmin()) { return; }
        $dry = isset($_GET['dry_run']) ? filter_var($_GET['dry_run'], FILTER_VALIDATE_BOOLEAN) : true;
        $summary = $this->store->repairSummary(!$dry);
        $path = $this->store->getPath();
        $size = file_exists($path) ? filesize($path) : 0;
        $this->json($summary + ['path' => $path, 'size' => $size]);
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
