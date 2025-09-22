<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Auth;
use App\Core\Session;

final class AuthController extends Controller
{
    public function loginForm(Request $r): string {
        return $this->render('auth/login', ['title'=>'Sign In']);
    }

    public function registerForm(Request $r): string {
        return $this->render('auth/register', ['title'=>'Sign Up']);
    }

    public function login(Request $r): string {
        $email = trim($_POST['email'] ?? '');
        $pass  = (string)($_POST['password'] ?? '');
        $ok = Auth::login($email, $pass);
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
        $email= trim($_POST['email'] ?? '');
        $pass = (string)($_POST['password'] ?? '');
        if ($name === '' || $email === '' || strlen($pass) < 6) {
            Session::flash('error', 'Fill all fields (min password length 6)');
            header('Location: /register', true, 302);
            return '';
        }
        $res = Auth::register($name, $email, $pass);
        if (!($res['ok'] ?? false)) {
            Session::flash('error', 'Email already taken');
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
