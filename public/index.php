<?php
use App\Core\Auth;
use App\Middleware\AuthMiddleware;

require_once __DIR__ . '/../vendor/autoload.php';

use App\Core\Request;
use App\Core\Router;
use App\Core\EventsController;

$request = new Request();
$router  = new Router($request);

$router->get('/',         [\App\Controllers\HomeController::class, 'planning']);
$router->get('/calendar', [\App\Controllers\CalendarController::class, 'index']);
$router->get('/cabinet',  [\App\Controllers\CabinetController::class, 'cabinet']);

$router->get('/api/events', [EventsController::class, 'get']);
$router->post('/api/events/store', [EventsController::class, 'store']);
$router->get('/api/events/diag', [EventsController::class, 'diag']);


$router->get('/login', [\App\Controllers\AuthController::class, 'loginForm']);
$router->post('/login', [\App\Controllers\AuthController::class, 'loginSubmit']);
$router->post('/logout', [\App\Controllers\AuthController::class, 'logout']);

// favicon без 404
$router->get('/favicon.ico', function(){
    header('Content-Type: image/x-icon');
    http_response_code(204);
});


// Apply Middleware globally (except some paths)
$Middleware = new AuthMiddleware();
$Middleware->handle(function () use ($routes) {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = strtok($_SERVER['REQUEST_URI'], '?') ?: '/';

    $handler = $routes[$method][$path] ?? null;
    if (!$handler) {
        http_response_code(404);
        echo 'Not Found';
        return;
    }

    [$class, $action] = $handler;
    (new $class())->$action();
}, ['except' => ['/login', '/login/','/register','/assets','/health']]);

$router->resolve();

