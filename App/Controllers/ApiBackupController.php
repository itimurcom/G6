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
        $this->json($this->store->read());
    }

    /** alias of import for legacy */
    public function store(): void
    {
        $payload = $this->readJson();
        if (isset($payload['data']) && is_array($payload['data'])) { $payload = $payload['data']; }
        if (isset($payload['store']) && is_array($payload['store'])) { $payload = $payload['store']; }
        $summary = $this->store->writeDiff(is_array($payload) ? $payload : []);
        $this->json(['ok' => true] + $summary);
    }

    public function export(): void
    {
        $this->json($this->store->read());
    }

    public function import(): void
    {
        $payload = $this->readJson();
        if (isset($payload['data']) && is_array($payload['data'])) { $payload = $payload['data']; }
        if (isset($payload['store']) && is_array($payload['store'])) { $payload = $payload['store']; }
        $summary = $this->store->writeDiff(is_array($payload) ? $payload : []);
        $this->json(['ok' => true] + $summary);
    }

    public function diag(): void
    {
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
        $dry = isset($_GET['dry_run']) ? filter_var($_GET['dry_run'], FILTER_VALIDATE_BOOLEAN) : true;
        $summary = $this->store->repairSummary(!$dry);
        $path = $this->store->getPath();
        $size = file_exists($path) ? filesize($path) : 0;
        $this->json($summary + ['path' => $path, 'size' => $size]);
    }

    // --- helpers (protected for tests) ---
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
