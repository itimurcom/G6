<?php
namespace App\Core;

use App\Models\UserRepositoryInterface;
use App\Models\UserMysqlRepository; // <--- ЗМІНЕНО: Підключаємо MySQL репозиторій

final class Auth
{
    private static ?UserRepositoryInterface $repo = null;

    private static function repo(): UserRepositoryInterface {
        if (!self::$repo) {
            // <--- ЗМІНЕНО: Використовуємо клас для роботи з MySQL
            self::$repo = new UserMysqlRepository();
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
            // Перевірка на порожній пароль (для старих акаунтів)
            if ($user && (!isset($user['password_hash']) || trim((string)$user['password_hash']) === '')) {
                $_SESSION['password_setup_user_id'] = (int)($user['id'] ?? 0);
                $_SESSION['password_setup_email']   = (string)($user['email'] ?? '');
                $_SESSION['password_setup_token']   = bin2hex(random_bytes(16));
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('info', 'Потрібно встановити пароль для цього акаунта.');
                }
                header('Location: /password/setup', true, 302);
                return false;
            }
        
        if (!password_verify($password, $user['password_hash'])) return false;
        
        Session::set('user_id', (int)$user['id']);
        
        // Зберігаємо профіль у сесії для швидкодії
        try {
            $role = isset($user['role']) ? (string)$user['role'] : '';
            $isAdm = (mb_strtolower($role) === 'admin') || !empty($user['is_admin']);
            Session::set('user', [
                'id'       => (int)$user['id'],
                'name'     => (string)($user['name'] ?? ''),
                'login'    => $user['login'] ?? null,
                'email'    => $user['email'] ?? null,
                'role'     => $role,
                'is_admin' => $isAdm,
            ]);
        } catch (\Throwable $__) {}
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
        try {
            $created = self::repo()->findById($id);
            if (is_array($created)) {
                $role = isset($created['role']) ? (string)$created['role'] : '';
                $isAdm = (mb_strtolower($role) === 'admin') || !empty($created['is_admin']);
                Session::set('user', [
                    'id'       => (int)($created['id'] ?? $id),
                    'name'     => (string)($created['name'] ?? ''),
                    'login'    => $created['login'] ?? null,
                    'email'    => $created['email'] ?? null,
                    'role'     => $role,
                    'is_admin' => $isAdm,
                ]);
            }
        } catch (\Throwable $__) {}
        return ['ok'=>true, 'id'=>$id];
    }

    public static function logout(): void {
        Session::forget('user_id');
        try { Session::forget('user'); } catch (\Throwable $__) {}
        session_unset();
    }

    public static function adminsExist(): bool
    {
        // Перевірка наявності адмінів через БД
        $repo = self::repo();
        // Оскільки UserMysqlRepository має метод all(), використовуємо його
        // (Для великих баз краще написати окремий SQL запит count(*), але для старту цього вистачить)
        $all = $repo->all();
        foreach ($all as $u) {
            $role = is_array($u) ? ($u['role'] ?? null) : null;
            if (mb_strtolower((string)$role) === 'admin' || !empty($u['is_admin'])) return true;
        }
        return false;
    }
}