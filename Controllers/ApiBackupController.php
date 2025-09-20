<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\EventStore;

final class ApiBackupController
{
    private EventStore $store;

    public function __construct()
    {
        $this->store = new EventStore();
    }

    public function events(): void
    {
        $this->json($this->store->read());
    }

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
        $this->json(['ok' => true, 'data' => $this->store->read()]);
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
        $path = $this->store->getPath();
        $size = file_exists($path) ? filesize($path) : 0;
        $this->json(['ok' => true, 'path' => $path, 'size' => $size]);
    }

    public function repairDups(): void
    {
        $dry = isset($_GET['dry_run']) ? filter_var($_GET['dry_run'], FILTER_VALIDATE_BOOLEAN) : true;
        $summary = $this->store->repairSummary(!$dry);
        $this->json($summary);
    }

    public function repair_dups(): void { $this->repairDups(); }

    private function readJson(): array
    {
        $raw = file_get_contents('php://input');
        $json = json_decode($raw ?: "{}", true);
        return is_array($json) ? $json : [];
    }
    private function json($data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
