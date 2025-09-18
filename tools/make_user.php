<?php
declare(strict_types=1);
// Usage: php tools/make_user.php <username> <password> [role]
const USERS_FILE = __DIR__ . '/../config/users.json';
function read_users(): array {
    if (!file_exists(USERS_FILE)) return ['users' => []];
    $json = file_get_contents(USERS_FILE);
    $data = json_decode($json, true);
    if (!is_array($data) || !isset($data['users']) || !is_array($data['users'])) return ['users' => []];
    return $data;
}
function write_users(array $data): void {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    file_put_contents(USERS_FILE, $json);
}
if (php_sapi_name() !== 'cli') { http_response_code(403); echo "Forbidden\n"; exit; }
$args = $argv ?? [];
if (count($args) < 3) { fwrite(STDERR, "Usage: php tools/make_user.php <username> <password> [role]\n"); exit(1); }
$username = trim($args[1]); $password = $args[2]; $role = $args[3] ?? 'user';
if ($username === '' || $password === '') { fwrite(STDERR, "Username and password must not be empty.\n"); exit(1); }
$hash = password_hash($password, PASSWORD_DEFAULT);
$data = read_users(); $found = false;
foreach ($data['users'] as &$u) {
    if (isset($u['username']) && strcasecmp($u['username'], $username) === 0) {
        $u['password_hash'] = $hash; $u['role'] = $role; $found = true; break;
    }
} unset($u);
if (!$found) { $data['users'][] = ['username'=>$username,'password_hash'=>$hash,'role'=>$role]; }
write_users($data);
echo "User '{$username}' saved with role '{$role}'.\n";
