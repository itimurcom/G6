<?php
declare(strict_types=1);

namespace App\Services\Audit;

use App\Core\Database;
use PDO;

class ActionLogger
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::connect();
    }

    private function context(): array
    {
        $u = $_SESSION['user'] ?? null;
        $uid = isset($u['id']) ? (int)$u['id'] : null;
        $uname = is_array($u) ? ($u['name'] ?? null) : null;

        return [
            'user_id'   => $uid,
            'user_name' => $uname,
            'ip'        => $_SERVER['REMOTE_ADDR']    ?? null,
            'ua'        => $_SERVER['HTTP_USER_AGENT'] ?? null,
        ];
    }

    private function write(array $row): bool
    {
        $sql = "INSERT INTO audit_logs (user_id, user_name, action, result, entity_type, entity_id, payload, ip, ua, created_at) 
                VALUES (:uid, :uname, :action, :result, :etype, :eid, :payload, :ip, :ua, :created)";
        
        // Витягуємо основні поля, все інше — в JSON payload
        $payloadData = $row;
        // Видаляємо дубльовані поля з payload, щоб не засмічувати JSON
        unset($payloadData['user_id'], $payloadData['user_name'], $payloadData['action'], $payloadData['result'], $payloadData['ip'], $payloadData['ua'], $payloadData['ts']);
        
        $entityType = $payloadData['entity_type'] ?? null;
        $entityId   = $payloadData['entity_id'] ?? null;
        unset($payloadData['entity_type'], $payloadData['entity_id']);

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
            'created' => date('Y-m-d H:i:s')
        ]);
    }

    public function logAuth(string $action, $userId = null, $userName = null, string $result = 'success', array $meta = []): void
    {
        $ctx = $this->context();
        if ($userId !== null)   { $ctx['user_id'] = $userId; }
        if ($userName !== null) { $ctx['user_name'] = $userName; }
        
        $row = array_merge($ctx, $meta, [
            'action' => $action,
            'result' => $result,
        ]);
        $this->write($row);
    }

    public function log(string $action, string $result = 'success', array $meta = []): void
    {
        $row = array_merge($this->context(), $meta, [
            'action' => $action,
            'result' => $result,
        ]);
        $this->write($row);
    }
}