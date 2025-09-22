<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Auth;
use App\Core\Session;

final class AuthController extends Controller
{
    public function loginForm(Request $r): string {
        return $this->render('auth/login', [
        'title'      => 'Вхід',
        'extra_css'  => [
            // приклади: підключи все, що треба саме для auth
            '/assets/css/calendar.css',
            '/assets/css/icons.css',
            // '/assets/css/auth.css',  // якщо винесеш стилі логіну в окремий файл
        ],
        'extra_js'   => [],
        'modules_js' => [],
        ]);
    }

    public function registerForm(Request $r): string {
            return $this->render('auth/register', [
        'title'      => 'Реєстрація',
        'extra_css'  => [
            '/assets/css/calendar.css',
            '/assets/css/icons.css',
            // '/assets/css/auth.css',
        ],
        'extra_js'   => [],
        'modules_js' => [],
    ]);
    }

    public function login(Request $r): string {
        $login = trim($_POST['login'] ?? '');
        $pass  = (string)($_POST['password'] ?? '');
        $ok = Auth::login($login, $pass);
        if ($ok) {
            header('Location: /cabinet', true, 302);
            return '';
        }
        Session::flash('error', 'Invalid credentials');
        header('Location: /login', true, 302);
        return '';
    }

    public function register(Request $r): string {
        $name = trim($_POST['name'] ?? '');
        $login= trim($_POST['login'] ?? '');
        $pass = (string)($_POST['password'] ?? '');
        if ($name === '' || $login === '' || strlen($pass) < 6) {
            Session::flash('error', 'Fill all fields (min password length 6). Login is required.');
            header('Location: /register', true, 302);
            return '';
        }
        $res = Auth::register($name, $login, $pass);
        if (!($res['ok'] ?? false)) {
            Session::flash('error', 'Login already taken');
            header('Location: /register', true, 302);
            return '';
        }
        header('Location: /cabinet', true, 302);
        return '';
    }

    public function logout(Request $r): string {
        Auth::logout();
        header('Location: /', true, 302);
        return '';
    }
}
