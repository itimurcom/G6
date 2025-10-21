<?php
namespace App\Services\Audit;

use DateTimeImmutable;

final class ActionLogger
{
    private string $file;

    public function __construct(?string $file = null)
    {
        // Single global file inside storage/logs/
        $this->file = $file ?: __DIR__ . '/../../../storage/logs/audit.ndjson';
        $dir = dirname($this->file);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
    }

    /** Append a single NDJSON line (append-only). */
    public function log(array $data): void
    {
        $now = new DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $record = [
            'id'          => $data['id'] ?? bin2hex(random_bytes(16)),
            'ts'          => $data['ts'] ?? $now->format('Y-m-d\TH:i:s.v\Z'),
            'user_id'     => $data['user_id'] ?? null,
            'user_name'   => $data['user_name'] ?? null,
            'action'      => $data['action'] ?? 'unknown',
            'entity_type' => $data['entity_type'] ?? null,
            'entity_id'   => $data['entity_id'] ?? null,
            'result'      => $data['result'] ?? 'success',
            'ip'          => $data['ip'] ?? ($_SERVER['REMOTE_ADDR'] ?? null),
            'user_agent'  => $data['user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? null),
            'request_id'  => $data['request_id'] ?? ($_SERVER['HTTP_X_REQUEST_ID'] ?? null),
            'session_id'  => $data['session_id'] ?? (session_id() ?: null),
            'message'     => $data['message'] ?? null,
            'delta'       => $data['delta'] ?? null,
            'details'     => $data['details'] ?? null,
        ];

        $line = json_encode($record, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) . "\n";
        $fh = @fopen($this->file, 'ab');
        if ($fh) {
            if (@flock($fh, LOCK_EX)) {
                @fwrite($fh, $line);
                @fflush($fh);
                @flock($fh, LOCK_UN);
            }
            @fclose($fh);
        }
    }

    public function logAuth(string $type, ?int $userId, ?string $userName, string $result = 'success', ?string $message = null): void
    {
        $this->log([
            'action'      => $type,   // auth.login | auth.logout
            'entity_type' => 'auth',
            'entity_id'   => null,
            'user_id'     => $userId,
            'user_name'   => $userName,
            'result'      => $result,
            'message'     => $message,
        ]);
    }

    public function logEvent(string $action, string $eventId, int $userId, string $userName, array $delta = [], string $result = 'success', ?string $message = null): void
    {
        $this->log([
            'action'      => $action,   // event.create | event.update | event.delete
            'entity_type' => 'event',
            'entity_id'   => $eventId,
            'user_id'     => $userId,
            'user_name'   => $userName,
            'result'      => $result,
            'message'     => $message,
            'delta'       => $delta,
            'details'     => ['fields' => array_keys($delta)],
        ]);
    }
}
