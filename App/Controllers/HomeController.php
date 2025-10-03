<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;

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
                '/assets/js/calendar/calendar.events.js',
                '/assets/js/calendar/calendar.data.js',
                
                '/assets/js/calendar/calendar.ui.js',
                '/assets/js/calendar/calendar.ui.toast.js',
                '/assets/js/calendar/calendar.ui.modals.js',
                '/assets/js/planning.js',          
            ]
        ]);
    }
}
