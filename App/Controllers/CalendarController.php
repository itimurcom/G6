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
                // 1) новий єдиний клієнт API V2 (fallback на legacy)
                '/js/services/api.events.js',

                // 2) опційний адаптер, що дає window.Data поверх ApiEvents + індикатор збереження
                '/js/data.adapter.js',

                // 3) далі твій існуючий фронт
                '/assets/js/calendar/calendar.events.js',
                '/assets/js/calendar/calendar.data.js',
                '/assets/js/calendar/calendar.ui.js',
                ],
            'modules_js'   => [
                // '/assets/js/calendar/main.js',
            ]   ,
            ]);
    }
}
