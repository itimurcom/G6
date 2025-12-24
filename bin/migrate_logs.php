<?php
// FILE: /bin/migrate_logs.php
// Запуск: php bin/migrate_logs.php

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../App/Core/Database.php';
require_once __DIR__ . '/../App/Services/Audit/AuditLabels.php';

use App\Core\Database;
use App\Services\Audit\AuditLabels;

// --- Логіка генерації тексту (копія з ActionLogger, щоб не залежати від нього) ---
function generateSearchText(array $row): string
{
    $parts = [];
    if (!empty($row['user_name'])) $parts[] = $row['user_name'];
    if (!empty($row['ip']))        $parts[] = $row['ip'];
    if (!empty($row['entity_id'])) $parts[] = $row['entity_id'];

    $act = $row['action'] ?? '';
    $config = AuditLabels::getConfig();

    if (isset($config[$act])) {
        $parts[] = $config[$act]['text'];
        $parts[] = $config[$act]['tags'] ?? '';
    } else {
        $parts[] = str_replace('.', ' ', $act);
    }

    // Payload
    $payload = $row;
    // Очистка від дублікатів
    unset($payload['user_id'], $payload['user_name'], $payload['action'], $payload['result'], $payload['ip'], $payload['ua'], $payload['ts'], $payload['entity_type'], $payload['entity_id']);

    if (!empty($payload['title']))       $parts[] = "Заголовок: " . $payload['title'];
    if (!empty($payload['description'])) $parts[] = "Опис: " . $payload['description'];
    if (!empty($payload['incoming_no'])) $parts[] = "Вх. №" . $payload['incoming_no'];
    if (!empty($payload['outgoing_no'])) $parts[] = "Вих. №" . $payload['outgoing_no'];
    
    // Рекурсивний збір всього іншого
    array_walk_recursive($payload, function($value, $key) use (&$parts) {
        if (in_array($key, ['title', 'description', 'incoming_no', 'outgoing_no'])) return;
        if (is_string($value) && !empty($value)) $parts[] = $value;
        elseif (is_numeric($value)) $parts[] = (string)$value;
    });

    return implode(' ', array_unique($parts));
}
// -------------------------------------------------------------------------

$file = __DIR__ . '/../storage/logs/audit.ndjson';
if (!file_exists($file)) {
    die("Файл логів не знайдено: $file\n");
}

try {
    echo "Підключення до БД...\n";
    $pdo = Database::connect();

    echo "Відкриття файлу логів...\n";
    $handle = fopen($file, "r");
    if (!$handle) die("Не вдалося відкрити файл.\n");

    $sql = "INSERT INTO audit_logs (
                user_id, user_name, action, result, 
                entity_type, entity_id, payload, 
                ip, ua, search_text, created_at
            ) VALUES (
                :uid, :uname, :action, :result, 
                :etype, :eid, :payload, 
                :ip, :ua, :stext, :created
            )";
    
    $stmt = $pdo->prepare($sql);
    $count = 0;
    $skipped = 0;

    echo "Початок імпорту...\n";

    while (($line = fgets($handle)) !== false) {
        $line = trim($line);
        if (!$line) continue;

        $row = json_decode($line, true);
        if (!$row) continue;

        // Форматуємо дату
        $tsRaw = $row['ts'] ?? 'now';
        try {
            $dt = new DateTime($tsRaw);
            $createdAt = $dt->format('Y-m-d H:i:s');
        } catch (Exception $e) {
            $createdAt = date('Y-m-d H:i:s');
        }

        // Генеруємо пошуковий текст
        $stext = generateSearchText($row);

        // Підготовка payload для запису
        $payloadData = $row;
        unset($payloadData['user_id'], $payloadData['user_name'], $payloadData['action'], $payloadData['result'], $payloadData['ip'], $payloadData['ua'], $payloadData['ts'], $payloadData['entity_type'], $payloadData['entity_id']);

        try {
            // Перевірка дублікатів (необов'язково, але бажано, щоб не дублювати при повторному запуску)
            // Перевіряємо по точній даті та дії (примітивно, але працює для логів)
            $check = $pdo->prepare("SELECT id FROM audit_logs WHERE created_at = ? AND action = ? AND user_id = ? LIMIT 1");
            $check->execute([$createdAt, $row['action'] ?? '', $row['user_id'] ?? 0]);
            if ($check->fetch()) {
                $skipped++;
                continue; 
            }

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
                'stext'   => $stext,
                'created' => $createdAt
            ]);
            $count++;
            if ($count % 100 === 0) echo "Імпортовано $count...\r";

        } catch (Exception $e) {
            echo "\nПомилка запису: " . $e->getMessage() . "\n";
        }
    }

    fclose($handle);
    echo "\nГОТОВО! Імпортовано: $count. Пропущено (вже є): $skipped.\n";

} catch (Exception $e) {
    echo "Критична помилка: " . $e->getMessage() . "\n";
}