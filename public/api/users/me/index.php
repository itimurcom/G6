<?php
declare(strict_types=1);

@header('Content-Type: application/json; charset=utf-8');
@header('Cache-Control: no-store');

try {
    if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }

    if (isset($_SESSION['user']) && is_array($_SESSION['user']) && (int)($_SESSION['user']['id'] ?? 0) > 0) {
        $u = $_SESSION['user'];
        echo json_encode(['ok'=>true, 'user'=>[
            'id'    => (int)$u['id'],
            'name'  => (string)($u['name'] ?? ''),
            'login' => $u['login'] ?? null,
            'email' => $u['email'] ?? null,
            'role'  => $u['role'] ?? null,
        ]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $uid = (int)($_SESSION['user_id'] ?? 0);
    if ($uid <= 0) {
        http_response_code(401);
        echo json_encode(['ok'=>false,'error'=>'unauthorized'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $root = dirname(__DIR__, 4);
    $autoload = $root . '/vendor/autoload.php';
    if (is_file($autoload)) { require_once $autoload; }

    $repoClass = '\App\Models\UserFileRepository';
    if (class_exists($repoClass)) {
        $repo = new $repoClass();
        $u = $repo->findById($uid);
        if (!$u) {
            http_response_code(404);
            echo json_encode(['ok'=>false,'error'=>'not_found'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }
        echo json_encode(['ok'=>true, 'user'=>[
            'id'    => (int)($u['id'] ?? $uid),
            'name'  => (string)($u['name'] ?? ($u['login'] ?? ('User #'.$uid))),
            'login' => $u['login'] ?? null,
            'email' => $u['email'] ?? null,
            'role'  => $u['role'] ?? null,
        ]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    echo json_encode(['ok'=>true, 'user'=>[
        'id'    => $uid,
        'name'  => '',
        'login' => null,
        'email' => null,
        'role'  => null,
    ]], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>'internal','message'=>$e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
