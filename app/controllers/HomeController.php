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
                '/assets/css/planning.css',
                '/assets/css/icons.css',
            ],
            'extra_js' => [
                '/assets/js/tools.js',
                '/assets/js/calendar/calendar.events.js',
                '/assets/js/calendar/calendar.data.js',
                '/assets/js/calendar/calendar.ui.js',
                '/assets/js/planning.js',          
            ]
        ]);
    }

    public function cabinet(Request $request): string {
        return $this->render('pages/cabinet', [
            'title' => 'Мій кабінет',
            'extra_css' => [
                ],
            'extra_js' => [

                ]
        ]);
    }
}
