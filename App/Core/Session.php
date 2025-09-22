<?php
namespace App\Core;

final class Session
{
    private static bool $started = false;

    private static function ensureStarted(): void {
        if (!self::$started) {
            ini_set('session.cookie_httponly', '1');
            ini_set('session.use_strict_mode', '1');
            if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
                ini_set('session.cookie_secure', '1');
            }
            if (PHP_VERSION_ID >= 70300) {
                @session_set_cookie_params([
                    'httponly' => true,
                    'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
                    'samesite' => 'Lax'
                ]);
            }
            session_start();
            self::$started = true;
        }
    }

    public static function get(string $key, $default=null) {
        self::ensureStarted();
        return $_SESSION[$key] ?? $default;
    }

    public static function set(string $key, $value): void {
        self::ensureStarted();
        $_SESSION[$key] = $value;
    }

    public static function forget(string $key): void {
        self::ensureStarted();
        unset($_SESSION[$key]);
    }

    public static function flash(string $key, $value=null) {
        self::ensureStarted();
        if ($value === null) {
            $v = $_SESSION['__flash'][$key] ?? null;
            if (isset($_SESSION['__flash'][$key])) unset($_SESSION['__flash'][$key]);
            return $v;
        } else {
            $_SESSION['__flash'][$key] = $value;
        }
    }

    public static function destroy(): void {
        self::ensureStarted();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time()-42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        self::$started = false;
    }
}
