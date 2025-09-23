#!/usr/bin/env php
<?php
declare(strict_types=1);

/**
 * bin/user-promote.php (v4)
 * Supports users.json structures:
 *  - array: [ {...}, {...} ]
 *  - wrapped: {"users":[...]}
 *  - map: {"1": {...}, ...}
 *  - rows-wrapped: {"rows":[...], "last_id": N}
 * Adds --list to inspect users.
 */

function usage(int $code = 0): void {
    $msg = <<<TXT
Usage:
  php bin/user-promote.php --list
  php bin/user-promote.php --email you@example.com --role admin
  php bin/user-promote.php --id 1 --role=admin

Notes:
- Role: admin | user (case-insensitive)
- Works with: array, {"users":[...]}, map, {"rows":[...]} (+ other fields)
TXT;
    fwrite($code ? STDERR : STDOUT, $msg . PHP_EOL);
    exit($code);
}

function parseArgs(): array {
    $args = ['email'=>null,'id'=>null,'role'=>null,'list'=>false];
    $argv = $_SERVER['argv'] ?? [];
    for ($i=1; $i<count($argv); $i++) {
        $a = (string)$argv[$i];
        if ($a === '--list') { $args['list'] = true; continue; }
        if ($a === '-h' || $a === '--help') { usage(0); }
        if (strpos($a, '--email=') === 0) { $args['email'] = substr($a, 8); continue; }
        if ($a === '--email' && isset($argv[$i+1])) { $args['email'] = (string)$argv[++$i]; continue; }
        if (strpos($a, '--id=') === 0) { $args['id'] = substr($a, 5); continue; }
        if ($a === '--id' && isset($argv[$i+1])) { $args['id'] = (string)$argv[++$i]; continue; }
        if (strpos($a, '--role=') === 0) { $args['role'] = substr($a, 7); continue; }
        if ($a === '--role' && isset($argv[$i+1])) { $args['role'] = (string)$argv[++$i]; continue; }
    }
    return $args;
}

function is_list_array(array $a): bool {
    if ($a === []) return true;
    $i = 0;
    foreach ($a as $k => $_) {
        if ($k !== $i) return false;
        $i++;
    }
    return true;
}

/**
 * Return [$root, &$container, $kind]
 * $kind: list | map | wrapped | rows
 */
function load_users(string $file): array {
    if (!file_exists($file)) {
        fwrite(STDERR, "[!] users.json not found at $file" . PHP_EOL);
        exit(2);
    }
    $json = file_get_contents($file);
    if ($json === false) { fwrite(STDERR, "[!] Failed to read $file" . PHP_EOL); exit(2); }
    $root = json_decode($json, true);
    if (!is_array($root)) { fwrite(STDERR, "[!] JSON root is not array/object" . PHP_EOL); exit(2); }

    if (isset($root['users']) && is_array($root['users'])) {
        return [$root, $root['users'], 'wrapped'];
    }
    if (isset($root['rows']) && is_array($root['rows'])) {
        return [$root, $root['rows'], 'rows'];
    }
    if (is_list_array($root)) {
        return [$root, $root, 'list'];
    }
    return [$root, $root, 'map'];
}

function save_users(string $file, array $root, $container, string $kind): void {
    if ($kind === 'wrapped') {
        $root['users'] = $container;
    } elseif ($kind === 'rows') {
        $root['rows'] = $container;
    } else {
        $root = $container;
    }
    $backup = $file . '.' . date('Ymd_His') . '.bak';
    if (!copy($file, $backup)) {
        fwrite(STDERR, "[!] Failed to create backup $backup" . PHP_EOL);
        exit(2);
    }
    $out = json_encode($root, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($out === false) { fwrite(STDERR, "[!] JSON encode failed: " . json_last_error_msg() . PHP_EOL); exit(2); }
    if (file_put_contents($file, $out) === false) { fwrite(STDERR, "[!] Write failed: $file" . PHP_EOL); exit(2); }
    echo "[OK] Saved. Backup: $backup" . PHP_EOL;
}

function find_user($container, ?string $id, ?string $email): array {
    if (!is_array($container)) return [null,null];
    foreach ($container as $k => $u) {
        if (!is_array($u)) continue;
        $uid = isset($u['id']) ? (string)$u['id'] : null;
        $uem = isset($u['email']) ? (string)$u['email'] : null;
        $ulogin = isset($u['login']) ? (string)$u['login'] : null;
        if ($id !== null && $uid !== null && strcmp($uid, (string)$id) === 0) return [$k, $u];
        if ($email !== null && $uem !== null && strcasecmp($uem, (string)$email) === 0) return [$k, $u];
        if ($email !== null && $ulogin !== null && strcasecmp($ulogin, (string)$email) === 0) return [$k, $u];
    }
    return [null, null];
}

$args = parseArgs();
$rootDir = realpath(__DIR__ . '/..') ?: getcwd();
$file = $rootDir . '/storage/data/users.json';
list($root, $container, $kind) = load_users($file);

if ($args['list']) {
    echo "Users (" . $kind . "):" . PHP_EOL;
    $i=0;
    foreach ($container as $k => $u) {
        if (!is_array($u)) continue;
        $i++;
        $id = $u['id'] ?? '';
        $email = $u['email'] ?? ($u['login'] ?? '');
        $role = $u['role'] ?? '';
        $is_admin = !empty($u['is_admin']) ? 'true' : 'false';
        printf("%3d) key=%s id=%s email=%s role=%s is_admin=%s\n", $i, (string)$k, (string)$id, (string)$email, (string)$role, $is_admin);
    }
    exit(0);
}

$role = $args['role'] ? strtolower((string)$args['role']) : null;
if (!$role || !in_array($role, ['admin','user'], true)) {
    fwrite(STDERR, "[!] --role must be 'admin' or 'user'\n");
    usage(2);
}
$email = $args['email'] ?? null;
$id    = $args['id'] ?? null;
if ($email === null && $id === null) {
    fwrite(STDERR, "[!] Provide --email or --id (or use --list)\n");
    usage(2);
}

list($key, $user) = find_user($container, $id !== null ? (string)$id : null, $email !== null ? (string)$email : null);
if ($key === null) {
    fwrite(STDERR, "[!] User not found by " . ($email ? "email=$email" : "id=$id") . PHP_EOL);
    fwrite(STDERR, "    Tip: run `php bin/user-promote.php --list` to see candidates\n");
    exit(1);
}

// Update role and compatibility flag
$container[$key]['role'] = $role;
$container[$key]['is_admin'] = ($role === 'admin');

save_users($file, $root, $container, $kind);
echo "[OK] Updated user key=$key: role={$role}" . PHP_EOL;
