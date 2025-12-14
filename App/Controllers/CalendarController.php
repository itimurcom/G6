<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;

class CalendarController extends Controller
{
    public function index(Request $request): string {
        return $this->render('pages/calendar', [
            'title' => 'Календар',
            'extra_css' => [
                '/assets/css/calendar.css',
                '/assets/css/icons.css',
                ],
            'extra_js' => [
                '/assets/js/app.js',
                '/assets/js/calendar/calendar.events.js',
                '/assets/js/calendar/calendar.data.js',
                
                '/assets/js/calendar/calendar.ui.js',
                // [DEFERRED] legacy UI backup disabled after V2 cutover; keep for rollback:
                // '/assets/js/calendar/calendar.ui.backup.js',
                '/assets/js/calendar/calendar.ui.modals.js',
                ],
            'modules_js'   => [
            ]   ,
            ]);
    }
}
