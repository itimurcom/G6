<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;

final class ApiAuditController extends Controller
{
    private function isAdmin(): bool
    {
        $u = $_SESSION['user'] ?? null;
        if (!is_array($u)) return false;
        $role = isset($u['role']) ? (string)$u['role'] : '';
        if (mb_strtolower($role) === 'admin') return true;
        return !empty($u['is_admin']);
    }

    private function logFile(): string
    {
        // __DIR__ = App/Controllers
        $appDir      = \dirname(__DIR__);        // -> App
        $projectRoot = \dirname($appDir);        // -> project root (calendar.localhost)

        $legacyDir = $appDir . '/storage/logs';       // old location: App/storage/logs
        $rootDir   = $projectRoot . '/storage/logs';  // preferred: storage/logs

        // Обираємо такий самий каталог, як і в ActionLogger:
        $logsDir = $rootDir;
        if (!is_dir($logsDir) || !is_writable($logsDir)) {
            $logsDir = $legacyDir;
        }

        return $logsDir . '/audit.ndjson';
    }

    /**
     * Convert any audit field value to a safe searchable string.
     * Important: must not emit warnings/notices that could break JSON responses.
     */
    private function auditToSearchText($v): string
    {
        if ($v === null) return '';

        if (is_string($v)) return $v;
        if (is_int($v) || is_float($v)) return (string)$v;
        if (is_bool($v)) return $v ? '1' : '0';

        if (is_scalar($v)) return (string)$v;

        // Arrays/objects: encode with safe flags; silence warnings to keep JSON output valid.
        $jsonFlags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
        if (defined('JSON_PARTIAL_OUTPUT_ON_ERROR')) $jsonFlags |= JSON_PARTIAL_OUTPUT_ON_ERROR;
        if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) $jsonFlags |= JSON_INVALID_UTF8_SUBSTITUTE;

        $s = @json_encode($v, $jsonFlags);
        if ($s === false) return '';
        return (string)$s;
    }

    /**
     * Case-insensitive contains helper with mbstring fallback.
     */
    private function auditContains(string $hay, string $needle): bool
    {
        if ($needle === '') return true;
        if (function_exists('mb_stripos')) return mb_stripos($hay, $needle) !== false;
        return stripos($hay, $needle) !== false;
    }


    public function list(Request $r): string
    {
        @header('Content-Type: application/json; charset=utf-8');
        @header('Cache-Control: no-store');

        $limit  = max(1, min(500, (int)($r->input('limit')  ?? 50)));
        $offset = max(0,        (int)($r->input('offset') ?? 0));
        $scope  = (string)($r->input('scope') ?? 'me'); // me|all
        $q      = trim((string)($r->input('q') ?? ''));
        $action = trim((string)($r->input('action') ?? ''));

        $isAdmin = $this->isAdmin();
        if ($scope !== 'me' && !$isAdmin) $scope = 'me';

        $uid = (int)($_SESSION['user']['id'] ?? 0);

        $file = $this->logFile();
        if (!is_file($file)) {
            return json_encode(['ok' => true, 'items' => [], 'next' => null, 'prev' => null], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            http_response_code(500);
            return json_encode(['ok' => false, 'error' => 'read_failed']);
        }

        // Parse & filter
        $rows = [];
        foreach ($lines as $ln) {
            $j = json_decode($ln, true);
            if (!is_array($j)) continue;

            // Scope filter
            if ($scope === 'me') {
                $jUid = isset($j['user_id']) ? (int)$j['user_id'] : 0;
                if ($uid <= 0 || $jUid !== $uid) continue;
            }

            // Action filter
            if ($action !== '' && (string)($j['action'] ?? '') !== $action) continue;

            // Query filter (search few fields)
            if ($q !== '') {
                $hay = [
                    $this->auditToSearchText($j['action'] ?? ''),
                    $this->auditToSearchText($j['result'] ?? ''),
                    $this->auditToSearchText($j['message'] ?? ''),
                    $this->auditToSearchText($j['user_name'] ?? ''),
                    $this->auditToSearchText($j['ip'] ?? ''),
                    $this->auditToSearchText($j['ua'] ?? ''),
                ];
                // Extended search: include entity/payload fields (so q matches titles, IDs, etc.)
                $hay[] = $this->auditToSearchText($j['entity_type'] ?? '');
                $hay[] = $this->auditToSearchText($j['entity_id'] ?? '');
                $hay[] = $this->auditToSearchText($j['date'] ?? '');
                $hay[] = $this->auditToSearchText($j['reason'] ?? '');
                $hay[] = $this->auditToSearchText($j['update_result'] ?? '');
                $hay[] = $this->auditToSearchText($j['delete_result'] ?? '');
                $hay[] = $this->auditToSearchText($j['urgent'] ?? '');
                $hay[] = $this->auditToSearchText($j['done'] ?? '');

                $jsonFlags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
                if (defined('JSON_PARTIAL_OUTPUT_ON_ERROR')) $jsonFlags |= JSON_PARTIAL_OUTPUT_ON_ERROR;

                if (isset($j['payload'])) {
                    // Use safe conversion to avoid warnings/notices breaking JSON output
                    $hay[] = $this->auditToSearchText($j['payload']);
                }
                if (isset($j['event_before'])) {
                    $hay[] = $this->auditToSearchText($j['event_before']);
                }
                if (isset($j['event_after'])) {
                    $hay[] = $this->auditToSearchText($j['event_after']);
                }

                $found = false;
                foreach ($hay as $h) {
                    if ($h !== '' && $this->auditContains($h, $q)) { $found = true; break; }
                }
                if (!$found) continue;
            }

            $rows[] = $j;
        }

        // Sort: newest first by ts (fallback keep as is then reverse)
        usort($rows, function($a, $b){
            $ta = strtotime((string)($a['ts'] ?? '')) ?: 0;
            $tb = strtotime((string)($b['ts'] ?? '')) ?: 0;
            return $tb <=> $ta;
        });

        $total = count($rows);
        $slice = array_slice($rows, $offset, $limit);

        $prev = $offset > 0 ? ['offset' => max(0, $offset - $limit)] : null;
        $next = ($offset + $limit) < $total ? ['offset' => ($offset + $limit)] : null;

        return json_encode([
            'ok'    => true,
            'items' => $slice,
            'prev'  => $prev,
            'next'  => $next,
            'total' => $total,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
