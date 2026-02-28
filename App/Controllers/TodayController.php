<?php
namespace App\Controllers;

use App\Core\Request;

/**
 * /today — окремий розділ (сторінка) з повним функціоналом блоку «Сьогодні»
 * без календарної сітки та без сайдбару.
 */
class TodayController
{
    /**
     * Рендер сторінки /today
     */
    public function index(Request $request): string
    {
        return $this->renderToday('pages/today', [
            'title' => 'Сьогодні',
            'extra_css' => [
                '/assets/css/calendar.css',
                '/assets/css/calendar.info.modal.css',
                '/assets/css/icons.css',
                '/assets/css/today.css',
            ],
            'extra_js' => [
                '/assets/js/app.js',
                '/assets/js/calendar/calendar.events.js',
                '/assets/js/calendar/calendar.data.js',
                '/assets/js/calendar/calendar.ui.js',
                '/assets/js/calendar/calendar.ui.modals.js',
                '/assets/js/services/ui.pdf_export.js',
                // notify не підключаємо, щоб сторінка була тільки «Сьогодні»
            ],
        ]);
    }

    /**
     * Локальний рендерер (не використовує main.php з меню/сайдбаром)
     */
    private function renderToday(string $view, array $params = []): string
    {
        $viewsDir = dirname(__DIR__) . '/Views/';
        $viewPath = $viewsDir . $view . '.php';
        $layoutPath = $viewsDir . 'layouts/today.php';

        if (!is_file($viewPath)) {
            http_response_code(500);
            return 'View not found: ' . htmlspecialchars($viewPath);
        }
        if (!is_file($layoutPath)) {
            http_response_code(500);
            return 'Layout not found: ' . htmlspecialchars($layoutPath);
        }

        extract($params, EXTR_SKIP);
        ob_start();
        include $viewPath;
        $content = ob_get_clean();

        ob_start();
        include $layoutPath;
        return ob_get_clean();
    }
}
