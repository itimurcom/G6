<?php
// file: App/Controllers/AuthController.php
namespace App\Controllers;

use App\Core\Auth;

class AuthController
{
    public function loginForm(): void
    {
        // render login view
        require __DIR__ . '/../Views/login.php';
    }

    public function loginSubmit(): void
    {
        \App\Core\Auth::startSession();

        // validate credentials (replace with real check)
        $email = $_POST['email'] ?? '';
        $pass  = $_POST['password'] ?? '';

        // TODO: verify user from DB and verify password hash
        if ($email === 'admin@example.com' && $pass === 'secret') {
            $_SESSION['user_id'] = 1; // set authenticated user id
            header('Location: /dashboard', true, 302);
            exit;
        }

        // on failure
        header('Location: /login/?error=1', true, 302);
        exit;
    }

    public function logout(): void
    {
        \App\Core\Auth::startSession();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        header('Location: /login/', true, 302);
        exit;
    }
}
