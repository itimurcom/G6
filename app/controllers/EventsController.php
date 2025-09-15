<?php
namespace App\Controllers;

use App\Models\EventStore;

class EventsController {

    private static function array_is_list_compat(array $a): bool {
        if (function_exists('array_is_list')) return \array_is_list($a);
        $i = 0; foreach ($a as $k => $_) { if ($k !== $i++) return false; }
        return true;
    }

    public function get(): void {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

        $store = (new EventStore())->read();
        // Якщо з файлу прочитався список — замінюємо на об’єкт
        if (self::array_is_list_compat($store)) $store = [];

        foreach ($store as $date => &$arr) {
            if (!is_array($arr)) { $arr = []; continue; }
            foreach ($arr as &$ev) {
                if (!isset($ev['user_id'])) $ev['user_id'] = 0;
                if (!isset($ev['done'])) $ev['done'] = false;
                if (!isset($ev['id'])) {
                    try { $ev['id'] = 'e_' . bin2hex(random_bytes(6)); }
                    catch (\Throwable $e) { $ev['id'] = 'e_' . uniqid(); }
                }
            }
        }
        echo json_encode(['ok' => true, 'data' => $store], JSON_UNESCAPED_UNICODE);
    }

    public function store(): void {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        if (!is_array($payload)) {
            http_response_code(400);
            echo json_encode([
                'ok' => false,
                'error' => 'invalid_json',
                'message' => json_last_error_msg(),
                'raw' => $raw,
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        // ✨ Ключове: якщо корінь масив-список ([]) — коертуємо в об’єкт {}
        if (self::array_is_list_compat($payload)) {
            $payload = [];
        }

        foreach ($payload as $date => &$arr) {
            if (!is_array($arr)) { $arr = []; continue; }
            foreach ($arr as &$ev) {
                if (!isset($ev['id'])) {
                    try { $ev['id'] = 'e_' . bin2hex(random_bytes(6)); }
                    catch (\Throwable $e) { $ev['id'] = 'e_' . uniqid(); }
                }
                if (!isset($ev['user_id'])) $ev['user_id'] = 0;
                if (!isset($ev['done'])) $ev['done'] = false;
            }
        }

        $store = new EventStore();
        $ok = $store->write($payload);
        if (!$ok) {
            $path = $store->path();
            $dir  = dirname($path);

            http_response_code(500);
            echo json_encode([
                'ok' => false,
                'error' => 'write_failed',
                'path' => $path,
                'dir'  => $dir,
                'dir_exists' => is_dir($dir),
                'dir_writable' => is_writable($dir),
                'exists'   => file_exists($path),
                'writable' => is_writable($path),
                'perms_octal' => substr(sprintf('%o', @fileperms($path)), -4),
                'owner' => function_exists('posix_getpwuid') ? (posix_getpwuid(@fileowner($path))['name'] ?? null) : null,
                'effective_uid' => function_exists('posix_geteuid') ? @posix_geteuid() : null,
                'php_sapi' => PHP_SAPI,
            ], JSON_UNESCAPED_UNICODE);
            return;
        }
        echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    }

    public function diag(): void {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');

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
            'writable' => file_exists($path) ? is_writable($path) : null,
            'perms_octal' => substr(sprintf('%o', @fileperms($path)), -4),
            'owner' => function_exists('posix_getpwuid') ? (posix_getpwuid(@fileowner($path))['name'] ?? null) : null,
            'effective_uid' => function_exists('posix_geteuid') ? @posix_geteuid() : null,
            'php_sapi' => PHP_SAPI,
            'test' => null,
        ];

        try {
            $data = $s->read();
            $result['test'] = $s->write($data) ? 'write_ok' : 'write_fail';
        } catch (\Throwable $e) {
            $result['test'] = 'exception: ' . $e->getMessage();
        }

        echo json_encode($result, JSON_UNESCAPED_UNICODE);
    }
}
