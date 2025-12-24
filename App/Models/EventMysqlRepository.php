<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

class EventMysqlRepository implements EventRepositoryInterface {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    public function listByDate(string $date): array {
        $stmt = $this->db->prepare("SELECT * FROM events WHERE start_date = ?");
        $stmt->execute([$date]);
        return $this->mapRows($stmt->fetchAll());
    }

    public function listByRange(string $from, string $to): array {
        $stmt = $this->db->prepare("SELECT * FROM events WHERE start_date BETWEEN ? AND ? ORDER BY start_date, time");
        $stmt->execute([$from, $to]);
        $rows = $this->mapRows($stmt->fetchAll());

        $result = [];
        $start = new \DateTime($from);
        $end = new \DateTime($to);
        for ($d = clone $start; $d <= $end; $d->modify('+1 day')) {
            $result[$d->format('Y-m-d')] = [];
        }
        foreach ($rows as $row) {
            $d = $row['start_date'];
            if (isset($result[$d])) {
                $result[$d][] = $row;
            }
        }
        return $result;
    }

    public function getById(string $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM events WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return null;
        return $this->mapRow($row);
    }
    
    public function get(string $id): ?array { return $this->getById($id); }

    public function create(string $date, array $payload): array {
        $data = $payload['event'] ?? $payload;
        
        if (empty($data['id'])) {
            $data['id'] = 'e_' . bin2hex(random_bytes(8));
        }

        $sql = "INSERT INTO events (
            id, user_id, start_date, end_date, time, title, description, owner, 
            type, incoming_no, outgoing_no, urgent, done, created_at
        ) VALUES (
            :id, :user_id, :start_date, :end_date, :time, :title, :description, :owner,
            :type, :in_no, :out_no, :urgent, :done, :created
        )";

        $this->db->prepare($sql)->execute([
            'id' => $data['id'],
            'user_id' => $data['user_id'] ?? 0,
            'start_date' => $date,
            'end_date' => $data['end_date'] ?? null,
            'time' => $data['time'] ?? '',
            'title' => $data['title'],
            'description' => $data['description'] ?? '',
            'owner' => $data['owner'] ?? '',
            'type' => $data['type'] ?? 'evt',
            'in_no' => $data['incoming_no'] ?? '',
            'out_no' => $data['outgoing_no'] ?? '',
            'urgent' => !empty($data['urgent']) ? 1 : 0,
            'done' => !empty($data['done']) ? 1 : 0,
            'created' => $data['created_at'] ?? date('Y-m-d H:i:s')
        ]);

        return ['id' => $data['id'], 'date' => $date];
    }

    public function updateById(string $id, array $data): array {
        $eventData = $data['event'] ?? $data;
        $newDate = $data['date'] ?? ($eventData['start_date'] ?? null);

        $fields = [];
        $params = ['id' => $id];

        $allow = ['time', 'title', 'description', 'owner', 'type', 'incoming_no', 'outgoing_no', 'end_date', 'close_user_id', 'close_time'];
        
        foreach ($allow as $f) {
            if (array_key_exists($f, $eventData)) {
                $fields[] = "$f = :$f";
                $params[$f] = $eventData[$f];
            }
        }
        
        if (isset($eventData['urgent'])) { $fields[] = "urgent = :urg"; $params['urg'] = $eventData['urgent'] ? 1 : 0; }
        if (isset($eventData['done'])) { $fields[] = "done = :done"; $params['done'] = $eventData['done'] ? 1 : 0; }
        
        if ($newDate) {
            $fields[] = "start_date = :sdate";
            $params['sdate'] = $newDate;
        }

        if (empty($fields)) return ['ok' => true];

        $sql = "UPDATE events SET " . implode(', ', $fields) . " WHERE id = :id";
        $this->db->prepare($sql)->execute($params);

        return ['id' => $id, 'date' => $newDate];
    }
    
    public function update(string $date, array $event): array {
        return $this->updateById($event['id'], ['date' => $date, 'event' => $event]);
    }

    public function deleteById(string $id): bool {
        $stmt = $this->db->prepare("DELETE FROM events WHERE id = ?");
        return $stmt->execute([$id]);
    }
    
    public function delete(string $id): array {
        return $this->deleteById($id) ? ['id' => $id] : ['error' => 'fail'];
    }

    public function setDone(string $id, bool $done): array {
        return $this->updateById($id, ['event' => ['done' => $done]]);
    }

    public function setUrgent(string $id, bool $urgent): array {
        return $this->updateById($id, ['event' => ['urgent' => $urgent]]);
    }

    public function search(array $filters, int $limit, int $offset): array {
        $text = $filters['text'] ?? '';
        
        // Базовий SQL
        $sql = "SELECT * FROM events WHERE 
                (title LIKE :q OR description LIKE :q OR owner LIKE :q OR incoming_no LIKE :q OR outgoing_no LIKE :q)";
        
        $params = ['q' => "%$text%"];

        // Додаткові фільтри (якщо треба розширити логіку)
        if (!empty($filters['date'])) {
            $sql .= " AND start_date = :fdate";
            $params['fdate'] = $filters['date'];
        }

        // Сортування та ліміти (MySQL вимагає int для LIMIT у PDO, якщо емуляція вимкнена, 
        // але тут передаємо прямо в рядок для простоти, бо int приведені в контролері)
        $sql .= " ORDER BY start_date DESC LIMIT $limit OFFSET $offset";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        return $this->mapRows($stmt->fetchAll());
    }

    private function mapRows(array $rows): array {
        foreach ($rows as &$row) $row = $this->mapRow($row);
        return $rows;
    }

    private function mapRow(array $row): array {
        $row['urgent'] = (bool)$row['urgent'];
        $row['done'] = (bool)$row['done'];
        $row['_date'] = $row['start_date'];
        return $row;
    }
}