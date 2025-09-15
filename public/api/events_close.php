<?php
require_once __DIR__ . '/../../app/config.php';
header('Content-Type: application/json; charset=UTF-8');
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'method_not_allowed']);
        exit;
    }
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    if (!$payload || !isset($payload['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'bad_request']);
        exit;
    }
    $id = $payload['id'];
    $close_user_id = array_key_exists('close_user_id', $payload) ? $payload['close_user_id'] : null;
    $close_time    = array_key_exists('close_time', $payload) ? $payload['close_time'] : null;
    $dbFile = config('DATA_FILE');
    if (!file_exists($dbFile)) {
        @mkdir(dirname($dbFile), 0775, true);
        file_put_contents($dbFile, "{}");
    }
    $fp = fopen($dbFile, 'c+');
    if (!$fp) { http_response_code(500); echo json_encode(['error'=>'open_failed']); exit; }
    if (!flock($fp, LOCK_EX)) { fclose($fp); http_response_code(500); echo json_encode(['error'=>'lock_failed']); exit; }
    $size = filesize($dbFile);
    $json = $size > 0 ? fread($fp, $size) : '{}';
    $data = json_decode($json, true);
    if (!is_array($data)) $data = [];
    $found = false;
    foreach ($data as $day => &$arr) {
        if (!is_array($arr)) continue;
        foreach ($arr as &$ev) {
            if (isset($ev['id']) && $ev['id'] === $id) {
                $ev['close_user_id'] = $close_user_id;
                $ev['close_time']    = $close_time;
                $found = true;
                break 2;
            }
        }
    }
    if (!$found) {
        flock($fp, LOCK_UN); fclose($fp);
        http_response_code(404);
        echo json_encode(['error' => 'not_found']);
        exit;
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(200);
    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error']);
}
