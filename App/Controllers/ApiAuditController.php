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
        if (in_array(mb_strtolower($role), ['admin','superadmin','root'], true)) return true;
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
            $entityType = trim((string)($r->input('entity_type') ?? ''));
            $entityId   = trim((string)($r->input('entity_id') ?? ''));

            $isAdmin = $this->isAdmin();
            // Non-admin users can view only their own audit records (scope=me).
            // Event history in the info modal is now rendered only for admin-level users.
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

            if ($entityType !== '') {
                $where[] = "entity_type = :entity_type";
                $params['entity_type'] = $entityType;
            }
            if ($entityId !== '') {
                $where[] = "entity_id = :entity_id";
                $params['entity_id'] = $entityId;
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

            // Enrich admin user actions with target login/name for older records that only have target_id.
            // This lets the Journal UI show "Редагування користувача: <login>" instead of "ID <n>".
            $adminUserActions = ['cabinet.admin_user_update', 'cabinet.admin_user_password', 'user.update', 'user.password'];
            $needUserIds = [];
            foreach ($rows as $row) {
                $act = (string)($row['action'] ?? '');
                if (!in_array($act, $adminUserActions, true)) continue;
                $payloadTmp = json_decode($row['payload'] ?? '{}', true);
                if (!is_array($payloadTmp)) $payloadTmp = [];
                $tid = $payloadTmp['target_id'] ?? ($row['entity_id'] ?? null);
                $tidInt = (int)$tid;
                if ($tid !== null && $tid !== '' && $tidInt > 0) {
                    $tlogin = $payloadTmp['target_login'] ?? null;
                    $ua = $payloadTmp['user_after'] ?? null;
                    $needs = false;
                    if ($tlogin === null || trim((string)$tlogin) === '') $needs = true;
                    if ($ua === null || $ua === '' || (is_array($ua) && empty($ua))) $needs = true;
                    if ($needs) {
                        $needUserIds[$tidInt] = true;
                    }
                }
            }

            $usersMap = [];
            if (!empty($needUserIds)) {
                $ids = array_keys($needUserIds);
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $stmtU = $this->db->prepare("SELECT id, login, name, email, role, is_admin FROM users WHERE id IN ($placeholders)");
                $stmtU->execute($ids);
                $uRows = $stmtU->fetchAll(PDO::FETCH_ASSOC);
                foreach ($uRows as $u) {
                    $uid2 = (int)($u['id'] ?? 0);
                    if ($uid2 > 0) {
                        $usersMap[$uid2] = [
                            'login'    => (string)($u['login'] ?? ''),
                            'name'     => (string)($u['name'] ?? ''),
                            'email'    => $u['email'] ?? null,
                            'role'     => (string)($u['role'] ?? ''),
                            'is_admin' => (int)($u['is_admin'] ?? 0),
                        ];
                    }
                }
            }

            $items = array_map(function($row) use ($usersMap, $adminUserActions) {
                $payload = json_decode($row['payload'] ?? '{}', true);
                if (!is_array($payload)) $payload = [];

                $act = (string)($row['action'] ?? '');
                if (in_array($act, $adminUserActions, true)) {
                    $tid = $payload['target_id'] ?? ($row['entity_id'] ?? null);
                    $tidInt = (int)$tid;
                    if ($tidInt > 0) {
                        $tlogin = $payload['target_login'] ?? null;
                        if ($tlogin === null || trim((string)$tlogin) === '') {
                            if (isset($usersMap[$tidInt])) {
                                $payload['target_login'] = $usersMap[$tidInt]['login'];
                                $payload['target_name']  = $usersMap[$tidInt]['name'];
                            }
                        }
                    }
                }
                
                

                    // Hydrate missing user snapshots for legacy admin-user records.
                    // If an old log did not store user_before/user_after, we still want the Journal details
                    // to show actual values instead of a placeholder like "оновлено".
                    if (in_array($act, $adminUserActions, true)) {
                        $tid = $payload['target_id'] ?? ($row['entity_id'] ?? null);
                        $tidInt = (int)$tid;
                        if ($tidInt > 0 && isset($usersMap[$tidInt])) {
                            $hasAfter = array_key_exists('user_after', $payload) && $payload['user_after'] !== null && $payload['user_after'] !== '' && !(is_array($payload['user_after']) && empty($payload['user_after']));

                            if (!$hasAfter) {
                                $ua = null;

                                // 1) If payload contains the new values (legacy shapes: update/data/after), use them.
                                foreach (['update', 'data', 'after'] as $k) {
                                    if (isset($payload[$k]) && is_array($payload[$k])) {
                                        $tmp = $payload[$k];
                                        $ua = [
                                            'name'     => isset($tmp['name']) ? (string)$tmp['name'] : null,
                                            'login'    => isset($tmp['login']) ? (string)$tmp['login'] : (isset($tmp['username']) ? (string)$tmp['username'] : null),
                                            'email'    => $tmp['email'] ?? null,
                                            'role'     => isset($tmp['role']) ? (string)$tmp['role'] : null,
                                            'is_admin' => isset($tmp['is_admin']) ? (int)$tmp['is_admin'] : null,
                                        ];
                                        // Normalize empty strings to null
                                        foreach ($ua as $kk => $vv) {
                                            if (is_string($vv) && trim($vv) === '') $ua[$kk] = null;
                                        }
                                        break;
                                    }
                                }

                                // 2) Fallback to current DB state (better than showing no data).
                                if ($ua === null) {
                                    $um = $usersMap[$tidInt];
                                    $ua = [
                                        'name'     => (string)($um['name'] ?? ''),
                                        'login'    => (string)($um['login'] ?? ''),
                                        'email'    => $um['email'] ?? null,
                                        'role'     => (string)($um['role'] ?? ''),
                                        'is_admin' => (int)($um['is_admin'] ?? 0),
                                    ];
                                }

                                $payload['user_after'] = $ua;
                            }
                        }
                    }

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