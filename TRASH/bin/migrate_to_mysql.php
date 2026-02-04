<?php
// FILE: /bin/migrate_to_mysql.php

// 1. Підключаємо автозавантажувач
require_once __DIR__ . '/../vendor/autoload.php';

// 2. ЯВНО підключаємо файл бази даних
$dbFile = __DIR__ . '/../App/Core/Database.php';
if (!file_exists($dbFile)) {
    die("Помилка: Файл $dbFile не знайдено!\n");
}
require_once $dbFile;

use App\Models\UserFileRepository;
use App\Models\EventStore;
use App\Core\Database;

header('Content-Type: text/plain');

// === ДОПОМІЖНА ФУНКЦІЯ ДЛЯ ДАТ ===
function isoToMysql($isoString) {
    if (empty($isoString)) {
        return date('Y-m-d H:i:s');
    }
    try {
        // Спробуємо розпарсити будь-який формат дати і перетворити в MySQL формат
        $dt = new DateTime($isoString);
        return $dt->format('Y-m-d H:i:s');
    } catch (Exception $e) {
        // Якщо дата "бита", повертаємо поточний час
        return date('Y-m-d H:i:s');
    }
}
// =================================

try {
    $pdo = Database::connect();
    echo "Підключення до БД успішне.\n";

    // --- 1. Міграція користувачів ---
    echo "--- Міграція користувачів ---\n";
    $userJsonRepo = new UserFileRepository();
    $users = $userJsonRepo->all();
    
    foreach ($users as $u) {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE login = ?");
        $stmt->execute([$u['login']]);
        if ($stmt->fetch()) {
            echo "Користувач {$u['login']} вже існує, пропускаємо.\n";
            continue;
        }

        $sql = "INSERT INTO users (id, name, login, email, password_hash, role, is_admin, created_at) 
                VALUES (:id, :name, :login, :email, :pass, :role, :admin, :created)";
        
        $pdo->prepare($sql)->execute([
            'id' => $u['id'],
            'name' => $u['name'] ?? $u['login'],
            'login' => $u['login'],
            'email' => $u['email'] ?? null,
            'pass' => $u['password_hash'] ?? '',
            'role' => $u['role'] ?? 'user',
            'admin' => !empty($u['is_admin']) ? 1 : 0,
            // ВИКОРИСТОВУЄМО КОНВЕРТЕР ТУТ
            'created' => isoToMysql($u['created_at'] ?? null)
        ]);
        echo "Перенесено користувача: {$u['login']}\n";
    }

    // --- 2. Міграція подій ---
    echo "\n--- Міграція подій ---\n";
    $store = new EventStore(); 
    $data = $store->read();
    $normalized = $store->normalizeStore($data); 

    $count = 0;
    foreach ($normalized as $date => $events) {
        foreach ($events as $ev) {
            $stmt = $pdo->prepare("SELECT id FROM events WHERE id = ?");
            $stmt->execute([$ev['id']]);
            if ($stmt->fetch()) continue;

            $sql = "INSERT INTO events (
                id, user_id, start_date, end_date, time, title, description, owner, 
                type, incoming_no, outgoing_no, urgent, done, created_at
            ) VALUES (
                :id, :uid, :sdate, :edate, :time, :title, :desc, :owner,
                :type, :in, :out, :urg, :done, :created
            )";

            // Підготовка дат
            $startDate = substr($date, 0, 10); // Обрізаємо на всяк випадок до YYYY-MM-DD
            $endDate = !empty($ev['end_date']) ? substr($ev['end_date'], 0, 10) : null;

            $pdo->prepare($sql)->execute([
                'id' => $ev['id'],
                'uid' => $ev['user_id'] ?? 0,
                'sdate' => $startDate,
                'edate' => $endDate,
                'time' => $ev['time'] ?? '',
                'title' => $ev['title'],
                'desc' => $ev['description'] ?? '',
                'owner' => $ev['owner'] ?? '',
                'type' => $ev['type'] ?? 'evt',
                'in' => $ev['incoming_no'] ?? '',
                'out' => $ev['outgoing_no'] ?? '',
                'urg' => !empty($ev['urgent']) ? 1 : 0,
                'done' => !empty($ev['done']) ? 1 : 0,
                // ВИКОРИСТОВУЄМО КОНВЕРТЕР ТУТ
                'created' => isoToMysql($ev['created_at'] ?? null)
            ]);
            $count++;
        }
    }
    echo "Перенесено подій: $count.\n";
    echo "\nГОТОВО! Можна перемикати код на MySQL.\n";

} catch (Exception $e) {
    echo "Помилка: " . $e->getMessage() . "\n";
} catch (Error $e) {
    echo "Фатальна помилка: " . $e->getMessage() . "\n";
}