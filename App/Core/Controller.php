<?php
namespace App\Core;

class Controller {
    protected function render(string $view, array $params = []): string {
        $layout = __DIR__ . '/../Views/layouts/main.php';
        $viewFile = __DIR__ . '/../Views/' . $view . '.php';

        extract($params, EXTR_SKIP);
        ob_start();
        if (file_exists($viewFile)) {
            include $viewFile;
        } else {
            echo "<p>View not found: {$view}</p>";
        }
        $content = ob_get_clean();

        ob_start();
        include $layout;
        return ob_get_clean();
    }
}
