<?php
// FILE: /bin/reindex_audit.php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../App/Core/Database.php';

use App\Core\Database;

// --- ТОЧНА КОПІЯ ЛОГІКИ З ACTIONLOGGER ---
function generateSearchText(array $row): string
{
    $parts = [];

    // 1. Хто і Де
    if (!empty($row['user_name'])) $parts[] = $row['user_name'];
    if (!empty($row['ip']))        $parts[] = $row['ip'];
    if (!empty($row['entity_id'])) $parts[] = $row['entity_id'];

    // 2. Дії
    $act = $row['action'] ?? '';
    $actionsMap = [
        'auth.login'            => 'Вхід в систему login',
        'auth.logout'           => 'Вихід із системи logout',
        'calendar.event.create' => 'Створення події нова create',
        'calendar.event.update' => 'Редагування події зміна update',
        'calendar.event.delete' => 'Видалення події delete',
        'calendar.event.done'   => 'Зміна статусу виконання',
        'calendar.event.urgent' => 'Зміна терміновості',
        'user.create'           => 'Створення користувача',
        'user.update'           => 'Редагування користувача',
        'user.password'         => 'Зміна пароля',
    ];

    if (isset($actionsMap[$act])) {
        $parts[] = $actionsMap[$act];
    } else {
        $parts[] = str_replace('.', ' ', $act);
    }

    // 3. Payload
    $payload = json_decode($row['payload'] ?? '{}', true);
    if (!is_array($payload)) $payload = [];

    // Поля календаря
    if (!empty($payload['title']))       $parts[] = "Заголовок: " . $payload['title'];
    if (!empty($payload['description'])) $parts[] = "Опис: " . $payload['description'];
    if (!empty($payload['owner']))       $parts[] = "Власник: " . $payload['owner'];
    if (!empty($payload['incoming_no'])) $parts[] = "Вх. №" . $payload['incoming_no'];
    if (!empty($payload['outgoing_no'])) $parts[] = "Вих. №" . $payload['outgoing_no'];
    if (!empty($payload['start_date']))  $parts[] = "Дата: " . $payload['start_date'];
    
    // Статуси
    if (isset($payload['done'])) {
        if ($payload['done'] == 1 || $payload['done'] === true || $payload['done'] === 'true') {
            $parts[] = "Статус: Виконано Зроблено";
        } elseif ($payload['done'] === 0 || $payload['done'] === false || $payload['done'] === 'false') {
            $parts[] = "Статус: Не виконано В роботі";
        }
    }
    if (isset($payload['urgent'])) {
        if ($payload['urgent'] == 1 || $payload['urgent'] === true || $payload['urgent'] === 'true') {
            $parts[] = "Пріоритет: Терміново Важливо";
        }
    }

    // Все інше
    array_walk_recursive($payload, function($value, $key) use (&$parts) {
        if (in_array($key, ['title', 'description', 'incoming_no', 'outgoing_no', 'done', 'urgent', 'start_date'])) return;
        if (is_string($value) && !empty($value)) $parts[] = $value;
        elseif (is_numeric($value)) $parts[] = (string)$value;
    });

    return implode(' ', array_unique($parts));
}
// ------------------------------------------

try {
    echo "Підключення до БД...\n";
    $pdo = Database::connect();

    echo "Вибірка всіх записів...\n";
    $stmt = $pdo->query("SELECT * FROM audit_logs");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Всього записів: " . count($rows) . "\n";

    $upd = $pdo->prepare("UPDATE audit_logs SET search_text = :txt WHERE id = :id");
    $count = 0;

    foreach ($rows as $row) {
        $text = generateSearchText($row);
        $upd->execute(['txt' => $text, 'id' => $row['id']]);
        $count++;
        if ($count % 50 === 0) echo ".";
    }

    echo "\nГОТОВО! Оновлено $count записів.\n";

} catch (Exception $e) {
    echo "ПОМИЛКА: " . $e->getMessage() . "\n";
}