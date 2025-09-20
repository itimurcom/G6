<?php
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

// favicon без 404
$router->get('/favicon.ico', function(){
    header('Content-Type: image/x-icon');
    http_response_code(204);
});

$router->resolve();

