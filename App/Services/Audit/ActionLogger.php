<?php
declare(strict_types=1);

namespace App\Services\Audit;

/**
 * Append-only NDJSON logger for user actions.
 * File: App/storage/logs/audit.ndjson
 */
final class ActionLogger
{
    /** @var string */
    private string $file;

    public function __construct(?string $file = null)
    {
        // __DIR__ = App/Services/Audit
        $appRoot     = \dirname(__DIR__, 2);       // -> App
        $projectRoot = \dirname($appRoot);         // -> project root (calendar.localhost)

        // Legacy location (old behaviour): App/storage/logs
        $legacyDir = $appRoot . '/storage/logs';

        // Preferred location: project-root/storage/logs (shared with other storage)
        $rootDir = $projectRoot . '/storage/logs';

        // Prefer rootDir if possible, otherwise fall back to legacyDir
        $logsDir = $rootDir;
        if (!is_dir($logsDir)) {
            @mkdir($logsDir, 0775, true);
        }
        if (!is_dir($logsDir) || !is_writable($logsDir)) {
            $logsDir = $legacyDir;
            if (!is_dir($logsDir)) {
                @mkdir($logsDir, 0775, true);
            }
        }

        $this->file = $file ?: ($logsDir . '/audit.ndjson');
    }


    /** Generic context from current request/session */
    private function context(): array
    {
        $u = $_SESSION['user'] ?? null;
        $uid = isset($u['id']) ? (int)$u['id'] : null;
        $uname = is_array($u) ? ($u['name'] ?? null) : null;

        return [
            'user_id'   => $uid,
            'user_name' => $uname,
            'ip'        => $_SERVER['REMOTE_ADDR']   ?? null,
            'ua'        => $_SERVER['HTTP_USER_AGENT'] ?? null,
        ];
    }

    /** Low-level writer: append one NDJSON line */
    private function write(array $row): bool
    {
        if (!isset($row['ts'])) {
            $row['ts'] = date('Y-m-d H:i:s');
        }
        $json = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) return false;

        $fh = @fopen($this->file, 'ab');
        if (!$fh) return false;
        $ok = @fwrite($fh, $json . "\n") !== false;
        @fclose($fh);
        return $ok;
    }

    /** Log authentication events */
    public function logAuth(string $action, $userId = null, $userName = null, string $result = 'success', array $meta = []): void
    {
        $ctx = $this->context();
        if ($userId !== null)   { $ctx['user_id'] = $userId; }
        if ($userName !== null) { $ctx['user_name'] = $userName; }
        $row = array_merge($ctx, $meta, [
            'type'   => 'auth',
            'action' => $action,
            'result' => $result,
        ]);
        $this->write($row);
    }

    /** Log generic application actions */
    public function log(string $action, string $result = 'success', array $meta = []): void
    {
        $row = array_merge($this->context(), $meta, [
            'type'   => 'app',
            'action' => $action,
            'result' => $result,
        ]);
        $this->write($row);
    }
}
