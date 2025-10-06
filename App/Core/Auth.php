<?php
namespace App\Core;

use App\Models\UserRepositoryInterface;
use App\Models\UserFileRepository;

final class Auth
{
    private static ?UserRepositoryInterface $repo = null;

    private static function repo(): UserRepositoryInterface {
        if (!self::$repo) {
            self::$repo = new UserFileRepository();
        }
        return self::$repo;
    }

    public static function id(): ?int {
        return Session::get('user_id', null);
    }

    public static function user(): ?array {
        $uid = self::id();
        return $uid ? self::repo()->findById($uid) : null;
    }

    public static function check(): bool {
        return self::id() !== null;
    }

    public static function login(string $login, string $password): bool {
        $user = self::repo()->findByLogin($login);
        if (!$user) return false;
            // if user exists but has empty/absent password hash -> force setup flow
            if ($user && (!isset($user['password_hash']) || trim((string)$user['password_hash']) === '')) {
                $_SESSION['password_setup_user_id'] = (int)($user['id'] ?? 0);
                $_SESSION['password_setup_email']   = (string)($user['email'] ?? '');
                $_SESSION['password_setup_token']   = bin2hex(random_bytes(16));
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('info', 'Потрібно встановити пароль для цього акаунта.');
                }
                header('Location: /password/setup', true, 302);
                return '';
            }
        if (!password_verify($password, $user['password_hash'])) return false;
        Session::set('user_id', (int)$user['id']);
        return true;
    }

    public static function register(string $name, string $login, string $password): array {
        $existing = self::repo()->findByLogin($login);
        if ($existing) {
            return ['ok'=>false, 'error'=>'login_taken'];
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $id = self::repo()->create([
            'name' => $name,
            'login' => $login,
            'password_hash' => $hash,
            'role' => 'user',
        ]);
        Session::set('user_id', $id);
        return ['ok'=>true, 'id'=>$id];
    }

    public static function logout(): void {
        Session::forget('user_id');
        session_unset();
    }

    public static function adminsExist(): bool
    {
        $file = dirname(__DIR__, 2) . '/storage/data/users.json';
        if (!is_file($file)) return false;
        $json = file_get_contents($file);
        if ($json === false) return false;
        $arr = json_decode($json, true);
        if (!is_array($arr)) return false;
        foreach ($arr as $u) {
            $role = is_array($u) ? ($u['role'] ?? null) : (is_object($u) ? ($u->role ?? null) : null);
            if (mb_strtolower((string)$role) === 'admin' || !empty($u['is_admin'])) return true;
        }
        return false;
    }

}
