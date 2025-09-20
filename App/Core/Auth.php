<?php
// file: App/Core/Auth.php
namespace App\Core;

class Auth
{
    public static function startSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            // secure defaults; adjust domain/secure flags for HTTPS in prod
            session_set_cookie_params([
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
            session_start();
        }
    }

    public static function check(): bool
    {
        self::startSession();
        // Convention: store user id in $_SESSION['user_id'] once logged in
        return !empty($_SESSION['user_id']);
    }

    public static function requireLogin(): void
    {
        if (!self::check()) {
            header('Location: /login/', true, 302);
            exit;
        }
    }
}
