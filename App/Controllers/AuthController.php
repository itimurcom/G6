<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Core\Auth;
use App\Core\Session;
use App\Services\Audit\ActionLogger; // AUDIT: ADD ONLY

final class AuthController extends Controller
{
    public function loginForm(Request $r): string {
        return $this->render('auth/login', [
            'title'      => 'Вхід',
            'extra_css'  => [
                '/assets/css/calendar.css',
                '/assets/css/icons.css',
            ],
            'extra_js'   => ['/assets/js/app.js'],
            'modules_js' => [],
        ]);
    }

    public function registerForm(Request $r): string {
        return $this->render('auth/register', [
            'title'      => 'Реєстрація',
            'extra_css'  => [
                '/assets/css/calendar.css',
                '/assets/css/icons.css',
            ],
            'extra_js'   => ['/assets/js/app.js'],
            'modules_js' => [],
        ]);
    }

    public function login(Request $r): string {
        $login = trim((string)$r->input('login'));
        $pass  = (string)$r->input('password');
        $___audit = new ActionLogger(); // AUDIT: ADD ONLY

        $token = (string)$r->input('_csrf');
        if (!\App\Security\Csrf::validate($token)) {
            if (method_exists(Session::class, 'flash')) {
                Session::flash('error', 'Сесія форми завершилась. Оновіть сторінку та спробуйте ще раз.');
            }
            $___audit->logAuth('auth.login', null, null, 'error', ['reason' => 'csrf_failed']);
            header('Location: /login', true, 302);
            return '';
        }

        // Find user by login/email using repository (supports wrapper format)
        $repo = new \App\Models\UserMysqlRepository();
        $user = $repo->findByLogin($login);
        if (!$user) { $user = $repo->findByEmail($login); }

        // If user exists and has empty password -> force setup flow
        if ($user && $this->userHasEmptyPassword($user)) {
            $_SESSION['password_setup_user_id'] = (int)($user['id'] ?? 0);
            $_SESSION['password_setup_email']   = (string)($user['email'] ?? '');
            $_SESSION['password_setup_token']   = bin2hex(random_bytes(16));
            if (method_exists(Session::class, 'flash')) {
                Session::flash('info', 'Потрібно встановити пароль для цього акаунта.');
            }
            header('Location: /password/setup', true, 302);
            return '';
        }

        // Normal login via existing Auth class
        $ok = Auth::login($login, $pass);
        if ($ok) {
            $u = $_SESSION['user'] ?? null; // AUDIT: ADD ONLY
            $___audit->logAuth('auth.login', isset($u['id'])?(int)$u['id']:null, $u['name']??null, 'success'); // AUDIT: ADD ONLY
            // P15.8: Redirect after login to last main page (planning or calendar)
            $dest = '/calendar';
            try {
                $last = (string)($_COOKIE['last_main_page'] ?? '');
                if ($last === 'planning') { $dest = '/'; }
                elseif ($last === 'calendar') { $dest = '/calendar'; }
            } catch (\Throwable $e) { /* ignore */ }

            header('Location: ' . $dest, true, 302);
            return '';
        }

        Session::flash('error', 'Invalid credentials');
        $___audit->logAuth('auth.login', null, null, 'error', ['reason' => 'invalid_credentials']); // AUDIT: ADD ONLY
        header('Location: /login', true, 302);
        return '';
    }

    public function register(Request $r): string {
        $name  = trim((string)$r->input('name'));
        $login = trim((string)$r->input('login'));
        $pass  = (string)$r->input('password');
        $___audit = new ActionLogger(); // AUDIT: ADD ONLY

        $token = (string)$r->input('_csrf');
        if (!\App\Security\Csrf::validate($token)) {
            if (method_exists(Session::class, 'flash')) {
                Session::flash('error', 'Сесія форми завершилась. Оновіть сторінку та спробуйте ще раз.');
            }
            $___audit->logAuth('auth.register', null, null, 'error', ['reason' => 'csrf_failed']);
            header('Location: /register', true, 302);
            return '';
        }

        if ($name === '' || $login === '' || \strlen($pass) < 6) {
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

        // P15.8: After registration go to default start page (calendar) or planning if remembered
        $dest = '/calendar';
        try {
            $last = (string)($_COOKIE['last_main_page'] ?? '');
            if ($last === 'planning') { $dest = '/'; }
        } catch (\Throwable $e) { /* ignore */ }

        header('Location: ' . $dest, true, 302);
        return '';
    }

    public function logout(Request $r): string {
        $__u = $_SESSION['user'] ?? null; // AUDIT: ADD ONLY
        Auth::logout();
        (new ActionLogger())->logAuth('auth.logout', isset($__u['id'])?(int)$__u['id']:null, $__u['name']??null, 'success'); // AUDIT: ADD ONLY
        header('Location: /', true, 302);
        return '';
    }

    // ---- Password setup (for empty password accounts) ----

    public function passwordSetupForm(Request $r): string {
        $uid = (int)($_SESSION['password_setup_user_id'] ?? 0);
        if ($uid <= 0) { header('Location: /login', true, 302); return ''; }

        $email = (string)($_SESSION['password_setup_email'] ?? '');
        return $this->render('auth/password_setup', [
            'title'     => 'Встановити пароль',
            'email'     => $email,
            'extra_css' => [
                '/assets/css/calendar.css',
                '/assets/css/icons.css',
            ],
            'extra_js'  => [],
        ]);
    }

    public function passwordSetupSave(Request $r): string {
        if (!\App\Security\Csrf::validate($r->input('_csrf'))) { http_response_code(403); return 'Forbidden'; }

        $uid = (int)($_SESSION['password_setup_user_id'] ?? 0);
        $tok = (string)($_SESSION['password_setup_token'] ?? '');
        if ($uid <= 0 || $tok === '') { header('Location: /login', true, 302); return ''; }

        $new  = (string)$r->input('new_password');
        $conf = (string)$r->input('confirm_password');

        if (\strlen($new) < 8 || $new !== $conf) {
            if (method_exists(Session::class, 'flash')) {
                Session::flash('error', 'Перевір новий пароль (мін. 8 символів) і підтвердження.');
            }
            header('Location: /password/setup', true, 302); return '';
        }

        $repo = new \App\Models\UserMysqlRepository();
        $u    = $repo->findById($uid);
        $ok   = false;

        if ($u) {
            $ok = $repo->updateById($uid, [
                'password_hash' => \password_hash($new, PASSWORD_DEFAULT),
            ]);
        }

        if ($ok) {
            unset($_SESSION['password_setup_user_id'], $_SESSION['password_setup_email'], $_SESSION['password_setup_token']);

            // reload user and log in via standard Auth flow (MySQL)
            $fresh = null;
            try {
                $fresh = $repo->findById($uid);
            } catch (\Throwable $e) {
                $fresh = null;
            }

            $loginStr = '';
            if (is_array($fresh)) {
                $loginStr = (string)($fresh['login'] ?? ($fresh['email'] ?? ''));
            }

            $loggedIn = false;
            if ($loginStr !== '') {
                $loggedIn = \App\Core\Auth::login($loginStr, $new);
            }

            // Fallback if Auth::login() fails: set minimal session state
            if (!$loggedIn) {
                if (is_array($fresh)) {
                    $_SESSION['user'] = $fresh;
                    $_SESSION['user_id'] = (int)($fresh['id'] ?? $uid);
                } else {
                    $_SESSION['user_id'] = $uid;
                }
                if (method_exists(\App\Core\Session::class, 'regenerateId')) {
                    \App\Core\Session::regenerateId(true);
                }
            }
            if (method_exists(Session::class, 'regenerateId')) {
                Session::regenerateId(true);
            }
            if (method_exists(Session::class, 'flash')) {
                Session::flash('success', 'Пароль встановлено.');
            }

            header('Location: /cabinet', true, 302);
            return '';
        }

        if (method_exists(Session::class, 'flash')) {
            Session::flash('error', 'Не вдалося зберегти пароль.');
        }
        header('Location: /password/setup', true, 302);
        return '';
    }

    private function userHasEmptyPassword(array $u): bool {
        $h = $u['password_hash'] ?? '';
        return !is_string($h) || trim($h) === '';
    }
}
