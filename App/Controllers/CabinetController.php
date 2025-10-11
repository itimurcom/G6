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
        $data = [
            'title'     => 'Мій кабінет',
            'extra_css' => [
                '/assets/css/calendar.css',
                '/assets/css/cabinet.css',
            ],
            'extra_js'  => [
                '/assets/js/app.js',
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
                $repo = new \App\Models\UserFileRepository();
                if (method_exists($repo, 'all')) {
                    $users = $repo->all();
                }
            } catch (\Throwable $e) {
                // ігноруємо, підемо у fallback
            }

            // 2) fallback: читання файлу напряму (підтримка {"last_id":...,"rows":[...]} і плоского масиву)
            if (empty($users)) {
                $file = \dirname(__DIR__, 2) . '/storage/data/users.json';
                $db   = json_decode(@file_get_contents($file) ?: '[]', true);
                $rows = (isset($db['rows']) && is_array($db['rows'])) ? $db['rows'] : (is_array($db) ? $db : []);
                $users = array_values($rows);
                usort($users, fn($a,$b) => (int)($a['id'] ?? 0) <=> (int)($b['id'] ?? 0));
            }

            $data['is_admin'] = true;
            $data['users']    = $users;
        }

        return $this->render('pages/cabinet', $data);
    }
        public function updateProfile(\App\Core\Request $r): string {
            if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
            if (!\App\Security\Csrf::validate($r->input('_csrf'))) { http_response_code(403); return 'Forbidden'; }
            $name  = trim((string)$r->input('name'));
            $email = mb_strtolower(trim((string)$r->input('email')));
            // validate + unique check via repo, save, flash + redirect back
            header('Location: /cabinet', true, 302); return '';
        }

        public function changePassword(\App\Core\Request $r): string {
            if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
            if (!\App\Security\Csrf::validate($r->input('_csrf'))) { http_response_code(403); return 'Forbidden'; }
            $curr = (string)$r->input('current_password');
            $new  = (string)$r->input('new_password');
            $conf = (string)$r->input('confirm_password');
            // verify current + strength + match, hash + save, flash + redirect
            header('Location: /cabinet', true, 302); return '';
        }
    
}
