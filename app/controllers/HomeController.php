<?php
namespace App\Controllers;

use App\core\Controller;
use App\core\Request;

class HomeController extends Controller
{
    public function planning(Request $request): string {
        return $this->render('pages/home', [
            'title' => 'Планування',
            'extra_css' => [
                 '/assets/css/calendar.css',
                '/assets/css/planning.css'
            ],
            'extra_js' => [
                '/assets/js/calendar/calendar.data.js',
                '/assets/js/calendar/ui.loader.js',
                '/assets/js/calendar/ui.plan-today.js',              
            ]
        ]);
    }

    public function cabinet(Request $request): string {
        return $this->render('pages/cabinet', [
            'title' => 'Мій кабінет',
            'extra_css' => [
                '/assets/css/planning.css',
                ],
            'extra_js' => [
                '/assets/js/calendar/ui.loader.js',
                '/assets/js/calendar/ui.plan-today.js',
                ]
        ]);
    }
}
