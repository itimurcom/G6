<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;

class CabinetController extends Controller
{
      public function cabinet(Request $request): string {
        return $this->render('pages/cabinet', [
            'title' => 'Мій кабінет',
            'extra_css' => [
                    '/assets/css/calendar.css',
                    '/assets/css/cabinet.css',
                ],
            'extra_js' => [

                ]
        ]);
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
