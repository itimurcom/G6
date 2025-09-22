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
        return Session::get('uid', null);
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
        if (!password_verify($password, $user['password_hash'])) return false;
        Session::set('uid', (int)$user['id']);
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
        Session::set('uid', $id);
        return ['ok'=>true, 'id'=>$id];
    }

    public static function logout(): void {
        Session::forget('uid');
    }
}
