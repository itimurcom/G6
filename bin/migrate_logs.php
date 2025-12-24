<?php
// bin/migrate_logs.php
require_once __DIR__ . '/../vendor/autoload.php';
use App\Core\Database;

$file = __DIR__ . '/../storage/logs/audit.ndjson';
if (!file_exists($file)) die("Файл логів не знайдено.\n");

$pdo = Database::connect();
$lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

echo "Міграція " . count($lines) . " записів...\n";

$sql = "INSERT INTO audit_logs (user_id, user_name, action, result, entity_type, entity_id, payload, ip, ua, created_at) 
        VALUES (:uid, :uname, :action, :result, :etype, :eid, :payload, :ip, :ua, :created)";
$stmt = $pdo->prepare($sql);

foreach ($lines as $line) {
    $row = json_decode($line, true);
    if (!$row) continue;

    $ts = isset($row['ts']) ? date('Y-m-d H:i:s', strtotime($row['ts'])) : date('Y-m-d H:i:s');
    
    // Відокремлюємо метадані
    $payloadData = $row;
    unset($payloadData['user_id'], $payloadData['user_name'], $payloadData['action'], $payloadData['result'], $payloadData['ip'], $payloadData['ua'], $payloadData['ts'], $payloadData['entity_type'], $payloadData['entity_id']);

    $stmt->execute([
        'uid'     => $row['user_id'] ?? null,
        'uname'   => $row['user_name'] ?? null,
        'action'  => $row['action'] ?? 'unknown',
        'result'  => $row['result'] ?? 'success',
        'etype'   => $row['entity_type'] ?? null,
        'eid'     => $row['entity_id'] ?? null,
        'payload' => json_encode($payloadData, JSON_UNESCAPED_UNICODE),
        'ip'      => $row['ip'] ?? null,
        'ua'      => $row['ua'] ?? null,
        'created' => $ts
    ]);
}

echo "Готово!\n";