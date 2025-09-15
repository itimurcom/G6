<?php
namespace App\Controllers;

use App\core\Controller;
use App\core\Request;

class CalendarController extends Controller
{
    public function index(Request $request): string {
        return $this->render('pages/calendar', [
            'title' => 'Календар',
            'extra_css' => ['/assets/css/calendar.css'],
            'extra_js' => [
                  '/assets/js/calendar/ui.loader.js',
                ],
            ]);
    }
}
