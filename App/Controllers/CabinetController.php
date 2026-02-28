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
                '/assets/js/services/ui.toast.js',
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

            $removeAvatar = (string)$r->input('avatar_remove', '0') === '1';
            $avatarFile = $_FILES['avatar_file'] ?? null;

            $errors = [];

            if ($name === '') {
                $errors[] = 'Ім’я не може бути порожнім.';
            }
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = 'Некоректний e-mail.';
            }

            $avatarBlob = null;
            $avatarMime = null;
            $avatarFilename = null;

            if (is_array($avatarFile) && (int)($avatarFile['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $err = (int)($avatarFile['error'] ?? UPLOAD_ERR_OK);
                if ($err !== UPLOAD_ERR_OK) {
                    $errors[] = 'Не вдалося завантажити аватарку.';
                } else {
                    $size = (int)($avatarFile['size'] ?? 0);
                    if ($size <= 0) {
                        $errors[] = 'Файл аватарки порожній.';
                    } elseif ($size > 2 * 1024 * 1024) {
                        $errors[] = 'Аватарка має бути не більшою за 2 МБ.';
                    } else {
                        $tmp = (string)($avatarFile['tmp_name'] ?? '');
                        $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
                        $mime = $finfo ? (string)finfo_file($finfo, $tmp) : '';
                        if ($finfo) { finfo_close($finfo); }
                        $allowed = [
                            'image/jpeg' => 'jpg',
                            'image/png' => 'png',
                            'image/webp' => 'webp',
                        ];
                        if (!isset($allowed[$mime])) {
                            $errors[] = 'Дозволені лише JPG, PNG або WEBP.';
                        } else {
                            $blob = @file_get_contents($tmp);
                            if ($blob === false || $blob === '') {
                                $errors[] = 'Не вдалося прочитати файл аватарки.';
                            } else {
                                $avatarBlob = $blob;
                                $avatarMime = $mime;
                                $avatarFilename = (string)($avatarFile['name'] ?? ('avatar.' . $allowed[$mime]));
                            }
                        }
                    }
                }
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
                header('Location: /cabinet?tab=settings', true, 302);
                return '';
            }

            try {
                if (method_exists($repo, 'updateById')) {
                    $repo->updateById($userId, [
                        'name'  => $name,
                        'email' => $email,
                    ]);
                }
                if ($removeAvatar && method_exists($repo, 'clearAvatarById')) {
                    $repo->clearAvatarById($userId);
                }
                if ($avatarBlob !== null && method_exists($repo, 'setAvatarById')) {
                    $repo->setAvatarById($userId, $avatarBlob, (string)$avatarMime, (string)$avatarFilename);
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
                    'avatar_removed' => $removeAvatar ? 1 : 0,
                    'avatar_uploaded' => $avatarBlob !== null ? 1 : 0,
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

            header('Location: /cabinet?tab=settings', true, 302); return '';
        }



        public function uploadAvatar(\App\Core\Request $r): string {
            if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
            $csrfToken = (string)($_POST['_csrf'] ?? $r->input('_csrf', ''));
            if (!\App\Security\Csrf::validateAny($csrfToken)) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Сесію безпеки для завантаження аватарки не підтверджено. Онови сторінку і спробуй ще раз.');
                }
                header('Location: /cabinet?tab=settings', true, 302);
                return '';
            }

            $me = \App\Core\Auth::user();
            if (!is_array($me) || empty($me['id'])) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Користувач не знайдений в сесії.');
                }
                header('Location: /login', true, 302);
                return '';
            }
            $userId = (int)$me['id'];
            $avatarFile = $_FILES['avatar_file'] ?? null;
            $errors = [];
            $avatarBlob = null;
            $avatarMime = null;
            $avatarFilename = null;

            if (!is_array($avatarFile) || (int)($avatarFile['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
                $errors[] = 'Файл аватарки не вибрано.';
            } else {
                $err = (int)($avatarFile['error'] ?? UPLOAD_ERR_OK);
                if ($err !== UPLOAD_ERR_OK) {
                    $errors[] = 'Не вдалося завантажити аватарку.';
                } else {
                    $size = (int)($avatarFile['size'] ?? 0);
                    if ($size <= 0) {
                        $errors[] = 'Файл аватарки порожній.';
                    } elseif ($size > 2 * 1024 * 1024) {
                        $errors[] = 'Аватарка має бути не більшою за 2 МБ.';
                    } else {
                        $tmp = (string)($avatarFile['tmp_name'] ?? '');
                        $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
                        $mime = $finfo ? (string)finfo_file($finfo, $tmp) : '';
                        if ($finfo) { finfo_close($finfo); }
                        $allowed = [
                            'image/jpeg' => 'jpg',
                            'image/png' => 'png',
                            'image/webp' => 'webp',
                        ];
                        if (!isset($allowed[$mime])) {
                            $errors[] = 'Дозволені лише JPG, PNG або WEBP.';
                        } else {
                            $blob = @file_get_contents($tmp);
                            if ($blob === false || $blob === '') {
                                $errors[] = 'Не вдалося прочитати файл аватарки.';
                            } else {
                                $avatarBlob = $blob;
                                $avatarMime = $mime;
                                $avatarFilename = (string)($avatarFile['name'] ?? ('avatar.' . $allowed[$mime]));
                            }
                        }
                    }
                }
            }

            $repo = new \App\Models\UserMysqlRepository();
            $logger = new \App\Services\Audit\ActionLogger();

            if (!empty($errors)) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', implode(' ', $errors));
                }
                $logger->log('cabinet.avatar_upload', 'error', [
                    'user_id' => $userId,
                    'errors'  => $errors,
                ]);
                header('Location: /cabinet?tab=settings', true, 302);
                return '';
            }

            try {
                if ($avatarBlob !== null && method_exists($repo, 'setAvatarById')) {
                    $repo->setAvatarById($userId, (string)$avatarBlob, (string)$avatarMime, (string)$avatarFilename);
                }

                $fresh = null;
                try {
                    $fresh = $repo->findById($userId);
                } catch (\Throwable $e) {}
                if (is_array($fresh)) {
                    \App\Core\Session::set('user', $fresh);
                }

                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('success', 'Аватарку оновлено.');
                }
                $logger->log('cabinet.avatar_upload', 'success', [
                    'user_id' => $userId,
                    'avatar_uploaded' => 1,
                ]);
            } catch (\Throwable $e) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Не вдалося зберегти аватарку.');
                }
                $logger->log('cabinet.avatar_upload', 'error', [
                    'user_id'   => $userId,
                    'exception' => $e->getMessage(),
                ]);
            }

            header('Location: /cabinet?tab=settings', true, 302); return '';
        }

        public function deleteAvatar(\App\Core\Request $r): string {
            if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
            $csrfToken = (string)($_POST['_csrf'] ?? $r->input('_csrf', ''));
            if (!\App\Security\Csrf::validateAny($csrfToken)) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Сесію безпеки для видалення аватарки не підтверджено. Онови сторінку і спробуй ще раз.');
                }
                header('Location: /cabinet?tab=settings', true, 302);
                return '';
            }

            $me = \App\Core\Auth::user();
            if (!is_array($me) || empty($me['id'])) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Користувач не знайдений в сесії.');
                }
                header('Location: /login', true, 302);
                return '';
            }
            $userId = (int)$me['id'];

            $repo = new \App\Models\UserMysqlRepository();
            $logger = new \App\Services\Audit\ActionLogger();

            try {
                if (method_exists($repo, 'clearAvatarById')) {
                    $repo->clearAvatarById($userId);
                }

                $fresh = null;
                try {
                    $fresh = $repo->findById($userId);
                } catch (\Throwable $e) {}
                if (is_array($fresh)) {
                    \App\Core\Session::set('user', $fresh);
                }

                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('success', 'Аватарку видалено.');
                }
                $logger->log('cabinet.avatar_delete', 'success', [
                    'user_id' => $userId,
                ]);
            } catch (\Throwable $e) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Не вдалося видалити аватарку.');
                }
                $logger->log('cabinet.avatar_delete', 'error', [
                    'user_id'   => $userId,
                    'exception' => $e->getMessage(),
                ]);
            }

            header('Location: /cabinet?tab=settings', true, 302); return '';
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
    

        public function adminUpdateUser(\App\Core\Request $r): string {
            if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
            if (!\App\Security\Csrf::validate($r->input('_csrf'))) { http_response_code(403); return 'Forbidden'; }

            $me = \App\Core\Auth::user();
            $isAdmin = false;
            if (is_array($me)) {
                $role = mb_strtolower((string)($me['role'] ?? ''));
                $isAdmin = (($me['is_admin'] ?? false) === true) || ((int)($me['is_admin'] ?? 0) === 1) || in_array($role, ['admin','superadmin','root'], true);
            }
            if (!$isAdmin) { http_response_code(403); return 'Forbidden'; }

            $targetId = (int)$r->input('user_id');
            if ($targetId <= 0) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Не вказано користувача для редагування.');
                }
                header('Location: /cabinet?tab=users', true, 302);
                return '';
            }

            $repo = new \App\Models\UserMysqlRepository();
            $logger = new \App\Services\Audit\ActionLogger();

            try {
                $target = $repo->findById($targetId);
            } catch (\Throwable $e) {
                $target = null;
            }

            if (!is_array($target)) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Користувача не знайдено.');
                }
                $logger->log('cabinet.admin_user_update', 'error', [
                    'entity_type' => 'user',
                    'entity_id'   => $targetId,
                    'admin_id'  => (int)($me['id'] ?? 0),
                    'target_id' => $targetId,
                    'reason'    => 'not_found',
                ]);
                header('Location: /cabinet?tab=users', true, 302);
                return '';
            }

            $name  = trim((string)$r->input('name'));
            $login = trim((string)$r->input('login'));
            $emailRaw = trim((string)$r->input('email'));
            $email = ($emailRaw !== '') ? mb_strtolower($emailRaw) : '';
            $role  = trim((string)$r->input('role'));
            if ($role === '') $role = 'user';
            $isAdminFlag = !empty($r->input('is_admin')) ? 1 : 0;

            $errors = [];
            if ($name === '') $errors[] = 'Ім’я не може бути порожнім.';
            if ($login === '') $errors[] = 'Логін не може бути порожнім.';
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Некоректний e-mail.';

            // Uniqueness: login
            if ($login !== '') {
                try { $existing = $repo->findByLogin($login); } catch (\Throwable $e) { $existing = null; }
                if (is_array($existing) && (int)($existing['id'] ?? 0) !== $targetId) {
                    $errors[] = 'Цей логін вже використовується іншим користувачем.';
                }
            }

            // Uniqueness: email
            if ($email !== '') {
                try { $existingEmail = $repo->findByEmail($email); } catch (\Throwable $e) { $existingEmail = null; }
                if (is_array($existingEmail) && (int)($existingEmail['id'] ?? 0) !== $targetId) {
                    $errors[] = 'Цей e-mail вже використовується іншим користувачем.';
                }
            }

            // Password change moved to a separate admin dialog (P15.15).

            if (!empty($errors)) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', implode(' ', $errors));
                }
                $logger->log('cabinet.admin_user_update', 'error', [
                    'entity_type' => 'user',
                    'entity_id'   => $targetId,
                    'admin_id'  => (int)($me['id'] ?? 0),
                    'target_id' => $targetId,
                    'errors'    => $errors,
                ]);
                header('Location: /cabinet?tab=users', true, 302);
                return '';
            }

            $update = [
                'name'     => $name,
                'login'    => $login,
                'email'    => ($email === '') ? null : $email,
                'role'     => $role,
                'is_admin' => $isAdminFlag,
            ];

            // Audit snapshot: user state before update (safe fields only)
            $userBefore = [
                'name'     => (string)($target['name'] ?? ''),
                'login'    => (string)($target['login'] ?? ($target['username'] ?? '')),
                'email'    => $target['email'] ?? null,
                'role'     => (string)($target['role'] ?? ''),
                'is_admin' => (int)($target['is_admin'] ?? 0),
            ];


            $changed = [];
            foreach ($update as $k => $v) {
                if ($k === 'password_hash') { $changed[] = 'password'; continue; }
                $before = $target[$k] ?? null;
                if ((string)$before !== (string)$v) $changed[] = $k;
            }

            try {
                $ok = false;
                if (method_exists($repo, 'updateById')) {
                    $ok = $repo->updateById($targetId, $update);
                }

                if (!$ok) {
                    if (method_exists(\App\Core\Session::class, 'flash')) {
                        \App\Core\Session::flash('error', 'Не вдалося зберегти дані користувача.');
                    }
                    $logger->log('cabinet.admin_user_update', 'error', [
                        'entity_type' => 'user',
                        'entity_id'   => $targetId,
                        'admin_id'  => (int)($me['id'] ?? 0),
                        'target_id' => $targetId,
                        'reason'    => 'update_failed',
                    ]);
                    header('Location: /cabinet?tab=users', true, 302);
                    return '';
                }

                $freshAfter = null;

                // If admin updated their own account, refresh session
                if ((int)($me['id'] ?? 0) === $targetId) {
                    try {
                        $fresh = $repo->findById($targetId);
                        $freshAfter = $fresh;
                        if (is_array($fresh)) {
                            $roleFresh = (string)($fresh['role'] ?? '');
                            $isAdmFresh = (mb_strtolower($roleFresh) === 'admin') || !empty($fresh['is_admin']);
                            \App\Core\Session::set('user', [
                                'id'       => (int)($fresh['id'] ?? $targetId),
                                'name'     => (string)($fresh['name'] ?? ''),
                                'login'    => $fresh['login'] ?? null,
                                'email'    => $fresh['email'] ?? null,
                                'role'     => $roleFresh,
                                'is_admin' => $isAdmFresh,
                            ]);
                        }
                    } catch (\Throwable $e) { /* ignore */ }
                }


                // Audit snapshot: user state after update (safe fields only)
                if (!is_array($freshAfter)) {
                    try { $freshAfter = $repo->findById($targetId); } catch (\Throwable $e) { $freshAfter = null; }
                }
                $userAfter = [
                    'name'     => is_array($freshAfter) ? (string)($freshAfter['name'] ?? '') : (string)$name,
                    'login'    => is_array($freshAfter) ? (string)($freshAfter['login'] ?? ($freshAfter['username'] ?? '')) : (string)$login,
                    'email'    => is_array($freshAfter) ? ($freshAfter['email'] ?? null) : (($email === '') ? null : $email),
                    'role'     => is_array($freshAfter) ? (string)($freshAfter['role'] ?? '') : (string)$role,
                    'is_admin' => is_array($freshAfter) ? (int)($freshAfter['is_admin'] ?? 0) : (int)$isAdminFlag,
                ];

                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('toast_success', 'Дані користувача оновлено.');
                }

                $logger->log('cabinet.admin_user_update', 'success', [
                    'entity_type' => 'user',
                    'entity_id'   => $targetId,
                    'admin_id'     => (int)($me['id'] ?? 0),
                    'target_id'    => $targetId,
                    'target_login' => (string)$login,
                    'target_name'  => (string)$name,
                    'changed'      => $changed,
                    'user_before'  => $userBefore,
                    'user_after'   => $userAfter,
                ]);
            } catch (\Throwable $e) {
                if (method_exists(\App\Core\Session::class, 'flash')) {
                    \App\Core\Session::flash('error', 'Не вдалося зберегти дані користувача.');
                }
                $logger->log('cabinet.admin_user_update', 'error', [
                    'entity_type' => 'user',
                    'entity_id'   => $targetId,
                    'admin_id'  => (int)($me['id'] ?? 0),
                    'target_id' => $targetId,
                    'exception' => $e->getMessage(),
                ]);
            }

            header('Location: /cabinet?tab=users', true, 302);
            return '';
        }


        public function adminChangeUserPassword(\App\Core\Request $r): string {
            if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
            if (!\App\Security\Csrf::validate($r->input('_csrf'))) { http_response_code(403); return 'Forbidden'; }

            $me = \App\Core\Auth::user();
            $isAdmin = false;
            if (is_array($me)) {
                $role = mb_strtolower((string)($me['role'] ?? ''));
                $isAdmin = (($me['is_admin'] ?? false) === true) || ((int)($me['is_admin'] ?? 0) === 1) || in_array($role, ['admin','superadmin','root'], true);
            }
            if (!$isAdmin) { http_response_code(403); return 'Forbidden'; }

            $targetId = (int)$r->input('user_id');
            $newPass  = (string)$r->input('new_password');

            if ($targetId <= 0) {
                \App\Core\Session::flash('toast_error', 'Не вказано користувача для зміни пароля.');
                header('Location: /cabinet?tab=users', true, 302);
                return '';
            }

            $errors = [];
            if (\strlen($newPass) < 8) $errors[] = 'Новий пароль має містити щонайменше 8 символів.';

            $repo = new \App\Models\UserMysqlRepository();
            $logger = new \App\Services\Audit\ActionLogger();

            try {
                $target = $repo->findById($targetId);
            } catch (\Throwable $e) {
                $target = null;
            }

            if (!is_array($target)) {
                \App\Core\Session::flash('toast_error', 'Користувача не знайдено.');
                $logger->log('cabinet.admin_user_password', 'error', [
                    'entity_type' => 'user',
                    'entity_id'   => $targetId,
                    'admin_id'  => (int)($me['id'] ?? 0),
                    'target_id' => $targetId,
                    'reason'    => 'not_found',
                ]);
                header('Location: /cabinet?tab=users', true, 302);
                return '';
            }

            if (!empty($errors)) {
                \App\Core\Session::flash('toast_error', implode(' ', $errors));
                $logger->log('cabinet.admin_user_password', 'error', [
                    'entity_type' => 'user',
                    'entity_id'   => $targetId,
                    'admin_id'  => (int)($me['id'] ?? 0),
                    'target_id' => $targetId,
                    'errors'    => $errors,
                ]);
                header('Location: /cabinet?tab=users', true, 302);
                return '';
            }

            try {
                $ok = false;
                if (method_exists($repo, 'updateById')) {
                    $ok = $repo->updateById($targetId, ['password_hash' => password_hash($newPass, PASSWORD_DEFAULT)]);
                }

                if (!$ok) {
                    \App\Core\Session::flash('toast_error', 'Не вдалося змінити пароль користувача.');
                    $logger->log('cabinet.admin_user_password', 'error', [
                        'entity_type' => 'user',
                        'entity_id'   => $targetId,
                        'admin_id'  => (int)($me['id'] ?? 0),
                        'target_id' => $targetId,
                        'reason'    => 'update_failed',
                    ]);
                    header('Location: /cabinet?tab=users', true, 302);
                    return '';
                }

                $login = (string)($target['login'] ?? ($target['username'] ?? ''));
                $label = $login !== '' ? ('"' . $login . '"') : ('ID ' . $targetId);
                \App\Core\Session::flash('toast_success', 'Пароль користувача ' . $label . ' змінено.');

                $logger->log('cabinet.admin_user_password', 'success', [
                    'entity_type' => 'user',
                    'entity_id'   => $targetId,
                    'admin_id'     => (int)($me['id'] ?? 0),
                    'target_id'    => $targetId,
                    'target_login' => (string)$login,
                    'target_name'  => (string)($target['name'] ?? ''),
                    'changed'      => ['password'],
                ]);
            } catch (\Throwable $e) {
                \App\Core\Session::flash('toast_error', 'Не вдалося змінити пароль користувача.');
                $logger->log('cabinet.admin_user_password', 'error', [
                    'entity_type' => 'user',
                    'entity_id'   => $targetId,
                    'admin_id'  => (int)($me['id'] ?? 0),
                    'target_id' => $targetId,
                    'exception' => $e->getMessage(),
                ]);
            }

            header('Location: /cabinet?tab=users', true, 302);
            return '';
        }

}
