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
        $appDir = \dirname(__DIR__); // -> App
        return $appDir . '/storage/logs/audit.ndjson';
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
                    (string)($j['action'] ?? ''),
                    (string)($j['result'] ?? ''),
                    (string)($j['message'] ?? ''),
                    (string)($j['user_name'] ?? ''),
                    (string)($j['ip'] ?? ''),
                    (string)($j['ua'] ?? ''),
                ];
                $found = false;
                foreach ($hay as $h) {
                    if ($h !== '' && mb_stripos($h, $q) !== false) { $found = true; break; }
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
