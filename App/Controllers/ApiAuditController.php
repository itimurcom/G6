<?php
namespace App\Controllers;

final class ApiAuditController
{
    private string $file;

    public function __construct(?string $file = null)
    {
        // Single global file inside storage/logs/
        $this->file = $file ?: __DIR__ . '/../../storage/logs/audit.ndjson';
    }

    /**
     * GET /api/audit/list
     * Query: limit (20/50/100), offset (int), scope (me|all), q, action, user_id
     */
    public function list(): void
    {
        header('Content-Type: application/json; charset=utf-8');

        $limit = max(1, min((int)($_GET['limit'] ?? 50), 100));
        $offset = max(0, (int)($_GET['offset'] ?? 0));
        $scope = $_GET['scope'] ?? 'me';
        $q = trim($_GET['q'] ?? '');
        $action = $_GET['action'] ?? '';
        $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;

        $auth = $this->currentUser();
        $isAdmin = $auth && (($auth['role'] ?? '') === 'admin');
        if (!$isAdmin) { $scope = 'me'; }

        $items = $this->readAll();
        $filtered = [];
        foreach ($items as $rec) {
            if ($scope === 'me' && isset($auth['id']) && $rec['user_id'] !== $auth['id']) continue;
            if ($userId !== null && $rec['user_id'] !== $userId) continue;
            if ($action !== '' && ($rec['action'] ?? null) !== $action) continue;
            if ($q !== '') {
                $hay = json_encode([$rec['message'] ?? '', $rec['user_name'] ?? '', $rec['delta'] ?? '', $rec['details'] ?? ''], JSON_UNESCAPED_UNICODE);
                if (stripos($hay, $q) === false) continue;
            }
            $filtered[] = $rec;
        }

        usort($filtered, function($a, $b) {
            $ta = $a['ts'] ?? '';
            $tb = $b['ts'] ?? '';
            if ($ta === $tb) return strcmp($b['id'] ?? '', $a['id'] ?? '');
            return strcmp($tb, $ta);
        });

        $total = count($filtered);
        $slice = array_slice($filtered, $offset, $limit);

        $next = null; $prev = null;
        if ($offset + $limit < $total) $next = ['offset' => $offset + $limit];
        if ($offset > 0) $prev = ['offset' => max(0, $offset - $limit)];

        echo json_encode([
            'items' => $slice,
            'count' => count($slice),
            'total' => $total,
            'next' => $next,
            'prev' => $prev
        ], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    }

    private function currentUser(): ?array
    {
        // The app stores the current user in PHP session
        return $_SESSION['user'] ?? null;
    }

    private function readAll(): array
    {
        $items = [];
        if (!is_file($this->file)) return $items;
        $fh = @fopen($this->file, 'rb');
        if (!$fh) return $items;
        while (($line = fgets($fh)) !== false) {
            $line = trim($line);
            if ($line === '') continue;
            $j = json_decode($line, true);
            if (is_array($j)) $items[] = $j;
        }
        @fclose($fh);
        return $items;
    }
}
