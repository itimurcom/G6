<?php
namespace App\Controllers;

use App\Core\Request;
use App\Models\EventStore;

class ApiBackupController
{
    private function json($data, int $code = 200): void {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
    }

    public function export(Request $req): void {
        $s = new EventStore();
        $this->json($s->read());
    }

    public function import(Request $req): void {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw ?: 'null', true);
        if (!is_array($data)) { $this->json(['error'=>'invalid json'], 400); return; }
        $s = new EventStore();
        $ok = $s->write($data);
        $this->json(['ok' => (bool)$ok]);
    }

    public function diag(Request $req): void {
        $s = new EventStore();
        $path = $s->path();
        $dir  = dirname($path);
        $result = [
            'ok' => true,
            'path' => $path,
            'dir' => $dir,
            'dir_exists' => is_dir($dir),
            'dir_writable' => is_writable($dir),
            'exists' => file_exists($path),
            'php_sapi' => PHP_SAPI,
        ];
        $this->json($result);
    }
}
