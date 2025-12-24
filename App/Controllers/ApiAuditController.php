<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Database;
use PDO;

final class ApiAuditController extends Controller
{
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    private function isAdmin(): bool
    {
        $u = $_SESSION['user'] ?? null;
        if (!is_array($u)) return false;
        $role = isset($u['role']) ? (string)$u['role'] : '';
        if (mb_strtolower($role) === 'admin') return true;
        return !empty($u['is_admin']);
    }

    public function list(Request $r): string
    {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
        }

        try {
            $limit  = max(1, min(500, (int)($r->input('limit')  ?? 50)));
            $offset = max(0,        (int)($r->input('offset') ?? 0));
            $scope  = (string)($r->input('scope') ?? 'me'); 
            $q      = trim((string)($r->input('q') ?? ''));
            $action = trim((string)($r->input('action') ?? ''));

            $isAdmin = $this->isAdmin();
            if ($scope !== 'me' && !$isAdmin) $scope = 'me';

            $uid = (int)($_SESSION['user']['id'] ?? 0);

            $where = ["1=1"];
            $params = [];

            if ($scope === 'me') {
                $where[] = "user_id = :uid";
                $params['uid'] = $uid;
            }

            if ($action !== '') {
                $where[] = "action = :action";
                $params['action'] = $action;
            }

            // === ВИПРАВЛЕНИЙ ПОШУК ===
            if ($q !== '') {
                $words = preg_split('/[\s,]+/', $q, -1, PREG_SPLIT_NO_EMPTY);
                
                foreach ($words as $index => $word) {
                    $term = "%$word%";
                    
                    // Генеруємо УНІКАЛЬНІ імена параметрів для кожного поля.
                    // PDO без емуляції вимагає цього.
                    $k1 = "st_{$index}";  // search_text
                    $k2 = "un_{$index}";  // user_name
                    $k3 = "eid_{$index}"; // entity_id
                    $k4 = "ip_{$index}";  // ip
                    
                    $where[] = "(search_text LIKE :$k1 OR user_name LIKE :$k2 OR entity_id LIKE :$k3 OR ip LIKE :$k4)";
                    
                    $params[$k1] = $term;
                    $params[$k2] = $term;
                    $params[$k3] = $term;
                    $params[$k4] = $term;
                }
            }
            // =========================

            $whereSql = implode(' AND ', $where);

            $stmtCount = $this->db->prepare("SELECT COUNT(*) FROM audit_logs WHERE $whereSql");
            $stmtCount->execute($params);
            $total = (int)$stmtCount->fetchColumn();

            $sql = "SELECT * FROM audit_logs WHERE $whereSql ORDER BY id DESC LIMIT $limit OFFSET $offset";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $items = array_map(function($row) {
                $payload = json_decode($row['payload'] ?? '{}', true);
                if (!is_array($payload)) $payload = [];
                
                return array_merge($payload, [
                    'ts'          => $row['created_at'],
                    'user_id'     => $row['user_id'],
                    'user_name'   => $row['user_name'],
                    'action'      => $row['action'],
                    'result'      => $row['result'],
                    'entity_type' => $row['entity_type'],
                    'entity_id'   => $row['entity_id'],
                    'ip'          => $row['ip'],
                    'ua'          => $row['ua']
                ]);
            }, $rows);

            $prev = $offset > 0 ? ['offset' => max(0, $offset - $limit)] : null;
            $next = ($offset + $limit) < $total ? ['offset' => ($offset + $limit)] : null;

            return json_encode([
                'ok'    => true,
                'items' => $items,
                'prev'  => $prev,
                'next'  => $next,
                'total' => $total,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        } catch (\Throwable $e) {
            http_response_code(500);
            return json_encode([
                'ok' => false, 
                'error' => 'db_error', 
                'message' => $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
    }
}