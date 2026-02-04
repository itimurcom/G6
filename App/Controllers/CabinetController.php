<?php
namespace App\Controllers;


use App\Core\CabinetView;
use App\Core\Controller;
use App\Core\Request;
use App\Core\Auth;

class CabinetController extends Controller
{
    //   public function cabinet(Request $request): string {
    //     return $this->render('pages/cabinet', [
    //         'title' => 'Мій кабінет',
    //         'extra_css' => [
    //                 '/assets/css/calendar.css',
    //                 '/assets/css/cabinet.css',
    //             ],
    //         'extra_js' => [

    //             ]
    //     ]);
    // }

        public function cabinet(Request $request): string
    {
        CabinetView::resolveUserIdAndAttach();

        $data = [
            'title'     => 'Мій кабінет',
            'extra_css' => [
                '/assets/css/calendar.css',
                '/assets/css/cabinet.css',
            ],
            'extra_js'  => [
                '/assets/js/app.js',
                '/assets/js/cabinet.js',
                '/assets/js/journal.js',
            ],
        ];

        $me = Auth::user();
        $isAdmin = false;
        if (is_array($me)) {
            $role = mb_strtolower((string)($me['role'] ?? ''));
            $isAdmin =
                (($me['is_admin'] ?? false) === true) ||
                ((int)($me['is_admin'] ?? 0) === 1) ||
                ($role === 'admin' || $role === 'superadmin');
        }

        if ($isAdmin) {
            $users = [];
            // 1) через репозиторій, якщо є
            try {
                $repo = new \App\Models\UserMysqlRepository();
                if (method_exists($repo, 'all')) {
                    $users = $repo->all();
                }
            } catch (\Throwable $e) {
                // ігноруємо
            }

            $data['is_admin'] = true;
            $data['users']    = $users;
        }

        return $this->render('pages/cabinet', $data);
    }
        public function updateProfile(\App\Core\Request $r): string {
            if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
            if (!\App\Security\Csrf::validate($r->input('_csrf'))) { http_response_code(403); return 'Forbidden'; }

            $me = \App\Core\Auth::user();
            if (!is_array($me) || empty($me['id'])) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Користувач не знайдений в сесії.');
                }
                header('Location: /login', true, 302);
                return '';
            }
            $userId = (int)$me['id'];

            $name  = trim((string)$r->input('name'));
            $email = mb_strtolower(trim((string)$r->input('email')));

            $errors = [];

            if ($name === '') {
                $errors[] = 'Ім’я не може бути порожнім.';
            }
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = 'Некоректний e-mail.';
            }

            $repo = new \App\Models\UserMysqlRepository();
            $logger = new \App\Services\Audit\ActionLogger();

            // Перевірка унікальності email
            if ($email !== '') {
                try {
                    $existing = $repo->findByEmail($email);
                } catch (\Throwable $e) {
                    $existing = null;
                }
                if (is_array($existing) && (int)($existing['id'] ?? 0) !== $userId) {
                    $errors[] = 'Цей e-mail вже використовується іншим користувачем.';
                }
            }

            if (!empty($errors)) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', implode(' ', $errors));
                }
                $logger->log('cabinet.profile_update', 'error', [
                    'user_id' => $userId,
                    'email'   => $email,
                    'errors'  => $errors,
                ]);
                header('Location: /cabinet', true, 302);
                return '';
            }

            try {
                if (method_exists($repo, 'updateById')) {
                    $repo->updateById($userId, [
                        'name'  => $name,
                        'email' => $email,
                    ]);
                }

                // Оновлюємо користувача в сесії
                $fresh = null;
                try {
                    $fresh = $repo->findById($userId);
                } catch (\Throwable $e) {}
                if (is_array($fresh)) {
                    \App\Core\Session::set('user', $fresh);
                } else {
                    $me['name']  = $name;
                    $me['email'] = $email;
                    \App\Core\Session::set('user', $me);
                }

                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('success', 'Профіль оновлено.');
                }
                $logger->log('cabinet.profile_update', 'success', [
                    'user_id' => $userId,
                    'email'   => $email,
                ]);
            } catch (\Throwable $e) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Не вдалося зберегти профіль.');
                }
                $logger->log('cabinet.profile_update', 'error', [
                    'user_id'   => $userId,
                    'email'     => $email,
                    'exception' => $e->getMessage(),
                ]);
            }

            header('Location: /cabinet', true, 302); return '';
        }

        public function changePassword(\App\Core\Request $r): string {
            if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
            if (!\App\Security\Csrf::validate($r->input('_csrf'))) { http_response_code(403); return 'Forbidden'; }

            $me = \App\Core\Auth::user();
            if (!is_array($me) || empty($me['id'])) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Користувач не знайдений в сесії.');
                }
                header('Location: /login', true, 302);
                return '';
            }
            $userId = (int)$me['id'];

            $curr = (string)$r->input('current_password');
            $new  = (string)$r->input('new_password');
            $conf = (string)$r->input('confirm_password');

            $errors = [];

            if (\strlen($new) < 8) {
                $errors[] = 'Новий пароль має містити щонайменше 8 символів.';
            }
            if ($new !== $conf) {
                $errors[] = 'Підтвердження пароля не співпадає.';
            }

            $repo = new \App\Models\UserMysqlRepository();
            $logger = new \App\Services\Audit\ActionLogger();

            // Перевіряємо поточний пароль, якщо він існує
            try {
                $u = $repo->findById($userId);
            } catch (\Throwable $e) {
                $u = null;
            }

            $storedHash = is_array($u) ? (string)($u['password_hash'] ?? '') : '';
            $hasPassword = is_string($storedHash) && trim($storedHash) !== '';

            if ($hasPassword) {
                if ($curr === '' || !password_verify($curr, $storedHash)) {
                    $errors[] = 'Поточний пароль невірний.';
                }
            }

            if (!empty($errors)) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', implode(' ', $errors));
                }
                $logger->log('cabinet.change_password', 'error', [
                    'user_id' => $userId,
                    'errors'  => $errors,
                ]);
                header('Location: /cabinet', true, 302);
                return '';
            }

            $newHash = password_hash($new, PASSWORD_DEFAULT);

            try {
                $updated = false;

                // 1) Основний шлях — через репозиторій
                if (method_exists($repo, 'updateById')) {
                    $updated = $repo->updateById($userId, ['password_hash' => $newHash]);
                }

                if (!$updated) {
                    if (method_exists(\App\Core\Session::class, 'flash')) {
                        \App\Core\Session::flash('error', 'Не вдалося зберегти пароль (update).');
                    }
                    $logger->log('cabinet.change_password', 'error', [
                        'user_id' => $userId,
                        'reason'  => 'update_failed',
                    ]);
                    header('Location: /cabinet', true, 302);
                    return '';
                }

                // Оновлюємо користувача в сесії
                try {
                    $u = $repo->findById($userId);
                } catch (\Throwable $e) {
                    $u = null;
                }

                if (is_array($u)) {
                    $u['password_hash'] = $newHash;
                    \App\Core\Session::set('user', $u);
                } else {
                    $me['password_hash'] = $newHash;
                    \App\Core\Session::set('user', $me);
                }

                if (function_exists('session_regenerate_id')) {
                    @session_regenerate_id(true);
                }

                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('success', 'Пароль успішно змінено.');
                }
                $logger->log('cabinet.change_password', 'success', [
                    'user_id' => $userId,
                ]);
            } catch (\Throwable $e) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Не вдалося зберегти пароль.');
                }
                $logger->log('cabinet.change_password', 'error', [
                    'user_id'   => $userId,
                    'exception' => $e->getMessage(),
                ]);
            }

            header('Location: /cabinet', true, 302); return '';
        }
    
}
