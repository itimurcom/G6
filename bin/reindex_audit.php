<?php
// FILE: /bin/reindex_audit.php

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../App/Core/Database.php';
// Явне підключення, щоб точно знайти файл
require_once __DIR__ . '/../App/Services/Audit/AuditLabels.php';

use App\Core\Database;
use App\Services\Audit\AuditLabels;

function generateSearchText(array $row): string
{
    $parts = [];

    // 1. Хто
    if (!empty($row['user_name'])) $parts[] = $row['user_name'];
    if (!empty($row['ip']))        $parts[] = $row['ip'];
    if (!empty($row['entity_id'])) $parts[] = $row['entity_id'];

    // 2. Дія (З AuditLabels)
    $act = $row['action'] ?? '';
    $config = AuditLabels::getConfig();

    if (isset($config[$act])) {
        // Додаємо "людську назву" (напр. "Редагування події")
        $parts[] = $config[$act]['text']; 
        // Додаємо теги (напр. "зміна update")
        if (!empty($config[$act]['tags'])) {
            $parts[] = $config[$act]['tags'];
        }
    } else {
        $parts[] = str_replace('.', ' ', $act);
    }

    // 3. Payload
    $payload = json_decode($row['payload'] ?? '{}', true);
    if (!is_array($payload)) $payload = [];

    // Очистка технічних полів з payload
    unset($payload['user_id'], $payload['user_name'], $payload['action'], $payload['result'], $payload['ip'], $payload['ua'], $payload['ts'], $payload['entity_type'], $payload['entity_id']);

    // Специфічні прапорці
    if (isset($payload['done']))   $parts[] = $payload['done'] ? 'Виконано' : 'Не виконано';
    if (isset($payload['urgent'])) $parts[] = $payload['urgent'] ? 'Терміново' : '';

    // Рекурсивно витягуємо весь текст
    array_walk_recursive($payload, function($value) use (&$parts) {
        if (is_string($value) && !empty($value)) {
            $parts[] = $value;
        } elseif (is_numeric($value)) {
            $parts[] = (string)$value;
        }
    });

    return implode(' ', array_unique($parts));
}

try {
    echo "Підключення до БД...\n";
    $pdo = Database::connect();
    
    echo "Оновлення індексу...\n";
    $stmt = $pdo->query("SELECT id, user_name, ip, entity_id, action, payload FROM audit_logs");
    
    $upd = $pdo->prepare("UPDATE audit_logs SET search_text = :txt WHERE id = :id");
    
    $count = 0;
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $text = generateSearchText($row);
        $upd->execute(['txt' => $text, 'id' => $row['id']]);
        $count++;
        if ($count % 100 === 0) echo "Оновлено $count...\r";
    }

    echo "\nГОТОВО! Оновлено записів: $count.\n";

} catch (Exception $e) {
    echo "ПОМИЛКА: " . $e->getMessage() . "\n";
}