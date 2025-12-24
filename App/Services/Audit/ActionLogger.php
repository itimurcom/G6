<?php
declare(strict_types=1);

namespace App\Services\Audit;

use App\Core\Database;
use PDO;
use App\Services\Audit\AuditLabels;

class ActionLogger
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::connect();
    }

    private function context(): array
    {
        if (session_status() !== PHP_SESSION_ACTIVE) @session_start();
        $u = $_SESSION['user'] ?? null;
        return [
            'user_id'   => $u['id'] ?? null,
            'user_name' => $u['name'] ?? null,
            'ip'        => $_SERVER['REMOTE_ADDR'] ?? null,
            'ua'        => $_SERVER['HTTP_USER_AGENT'] ?? null,
        ];
    }

    public function generateSearchText(array $row): string
    {
        $parts = [];

        // 1. Хто
        if (!empty($row['user_name'])) $parts[] = $row['user_name'];
        if (!empty($row['ip']))        $parts[] = $row['ip'];
        if (!empty($row['entity_id'])) $parts[] = $row['entity_id'];

        // 2. Дія (Через AuditLabels)
        $act = $row['action'] ?? '';
        $config = AuditLabels::getConfig();

        if (isset($config[$act])) {
            $parts[] = $config[$act]['text'];
            if (!empty($config[$act]['tags'])) {
                $parts[] = $config[$act]['tags'];
            }
        } else {
            $parts[] = str_replace('.', ' ', $act);
        }

        // 3. Payload
        $payload = $row;
        unset($payload['user_id'], $payload['user_name'], $payload['action'], $payload['result'], $payload['ip'], $payload['ua'], $payload['ts'], $payload['entity_type'], $payload['entity_id']);
        
        if (isset($payload['done']))   $parts[] = $payload['done'] ? 'Виконано' : 'Не виконано';
        if (isset($payload['urgent'])) $parts[] = $payload['urgent'] ? 'Терміново' : '';

        array_walk_recursive($payload, function($value, $key) use (&$parts) {
            if (in_array($key, ['done', 'urgent'])) return;
            if (is_string($value) && !empty($value)) $parts[] = $value;
            elseif (is_numeric($value)) $parts[] = (string)$value;
        });

        return implode(' ', array_unique($parts));
    }

    private function write(array $row): bool
    {
        $payloadData = $row;
        unset($payloadData['user_id'], $payloadData['user_name'], $payloadData['action'], $payloadData['result'], $payloadData['ip'], $payloadData['ua'], $payloadData['ts']);
        
        $entityType = $payloadData['entity_type'] ?? null;
        $entityId   = $payloadData['entity_id'] ?? null;
        unset($payloadData['entity_type'], $payloadData['entity_id']);

        $searchText = $this->generateSearchText($row);

        $sql = "INSERT INTO audit_logs (
                    user_id, user_name, action, result, 
                    entity_type, entity_id, payload, 
                    ip, ua, search_text, created_at
                ) VALUES (
                    :uid, :uname, :action, :result, 
                    :etype, :eid, :payload, 
                    :ip, :ua, :stext, :created
                )";

        try {
            $stmt = $this->db->prepare($sql);
            return $stmt->execute([
                'uid'     => $row['user_id'] ?? null,
                'uname'   => $row['user_name'] ?? null,
                'action'  => $row['action'] ?? 'unknown',
                'result'  => $row['result'] ?? 'success',
                'etype'   => $entityType,
                'eid'     => $entityId,
                'payload' => json_encode($payloadData, JSON_UNESCAPED_UNICODE),
                'ip'      => $row['ip'] ?? null,
                'ua'      => $row['ua'] ?? null,
                'stext'   => $searchText,
                'created' => date('Y-m-d H:i:s')
            ]);
        } catch (\Throwable $e) {
            error_log("ActionLogger Error: " . $e->getMessage());
            return false;
        }
    }

    public function logAuth(string $action, $userId = null, $userName = null, string $result = 'success', array $meta = []): void
    {
        $ctx = $this->context();
        if ($userId !== null)   { $ctx['user_id'] = $userId; }
        if ($userName !== null) { $ctx['user_name'] = $userName; }
        $row = array_merge($ctx, $meta, [ 'action' => $action, 'result' => $result ]);
        $this->write($row);
    }

    public function log(string $action, string $result = 'success', array $meta = []): void
    {
        $row = array_merge($this->context(), $meta, [ 'action' => $action, 'result' => $result ]);
        $this->write($row);
    }
}