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
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }

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

    /**
     * ГЕНЕРАТОР "ЛЮДСЬКОГО" ОПИСУ
     * Перетворює технічні дані на текст, який ми бачимо в таблиці.
     */
    public function generateSearchText(array $row): string
    {
        $parts = [];

        // 1. Хто і Де (Базові поля)
        if (!empty($row['user_name'])) $parts[] = $row['user_name'];
        if (!empty($row['ip']))        $parts[] = $row['ip'];
        if (!empty($row['entity_id'])) $parts[] = $row['entity_id'];

        // 2. Що сталося (Переклад дій)
        $act = $row['action'] ?? '';
        $actionText = $act; // дефолт

        // Словник дій (має співпадати з тим, що показує фронтенд)
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
            // Якщо дії немає в словнику, розбиваємо крапки на слова
            $parts[] = str_replace('.', ' ', $act);
        }

        // 3. Деталі (Розбір JSON payload)
        $payload = $row;
        // Видаляємо сміття
        unset($payload['user_id'], $payload['user_name'], $payload['action'], $payload['result'], $payload['ip'], $payload['ua'], $payload['ts'], $payload['entity_type'], $payload['entity_id']);
        
        // --- Специфічні поля календаря ---
        
        // Заголовок та опис
        if (!empty($payload['title']))       $parts[] = "Заголовок: " . $payload['title'];
        if (!empty($payload['description'])) $parts[] = "Опис: " . $payload['description'];
        if (!empty($payload['owner']))       $parts[] = "Власник: " . $payload['owner'];
        
        // Номери
        if (!empty($payload['incoming_no'])) $parts[] = "Вх. №" . $payload['incoming_no'];
        if (!empty($payload['outgoing_no'])) $parts[] = "Вих. №" . $payload['outgoing_no'];
        
        // Дати
        if (!empty($payload['start_date']))  $parts[] = "Дата: " . $payload['start_date'];
        if (!empty($payload['time']))        $parts[] = "Час: " . $payload['time'];
        
        // Статуси (Boolean)
        // Обробка done
        if (isset($payload['done'])) {
            if ($payload['done'] == 1 || $payload['done'] === true || $payload['done'] === 'true') {
                $parts[] = "Статус: Виконано Зроблено";
            } elseif ($payload['done'] === 0 || $payload['done'] === false || $payload['done'] === 'false') {
                $parts[] = "Статус: Не виконано В роботі";
            }
        }
        
        // Обробка urgent
        if (isset($payload['urgent'])) {
            if ($payload['urgent'] == 1 || $payload['urgent'] === true || $payload['urgent'] === 'true') {
                $parts[] = "Пріоритет: Терміново Важливо";
            }
        }

        // 4. Рекурсивний збір всього іншого тексту (на випадок нових полів)
        array_walk_recursive($payload, function($value, $key) use (&$parts) {
            // Пропускаємо те, що вже обробили вище
            if (in_array($key, ['title', 'description', 'incoming_no', 'outgoing_no', 'done', 'urgent', 'start_date', 'time'])) return;
            
            if (is_string($value) && !empty($value)) {
                $parts[] = $value;
            } elseif (is_numeric($value)) {
                $parts[] = (string)$value;
            }
        });

        // Видаляємо дублікати та склеюємо
        return implode(' ', array_unique($parts));
    }

    private function write(array $row): bool
    {
        $payloadData = $row;
        unset($payloadData['user_id'], $payloadData['user_name'], $payloadData['action'], $payloadData['result'], $payloadData['ip'], $payloadData['ua'], $payloadData['ts']);
        
        $entityType = $payloadData['entity_type'] ?? null;
        $entityId   = $payloadData['entity_id'] ?? null;
        unset($payloadData['entity_type'], $payloadData['entity_id']);

        // Генеруємо детальний пошуковий текст
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