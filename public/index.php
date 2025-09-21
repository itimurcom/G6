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


// ✅ Новий маршрут(и) для repair (без змін Router.php усередині)
$router->get('/api/repair',                 [\App\Controllers\ApiBackupController::class, 'repair']);        // плоский
$router->get('/api/backup/repair-dups',     [\App\Controllers\ApiBackupController::class, 'repair']);


$router->get('/api/mysql/diag', [\App\Controllers\ApiMysqlEventsController::class, 'diag']);
$router->get('/api/mysql/events/by-date', [\App\Controllers\ApiMysqlEventsController::class, 'listByDate']);
$router->get('/api/mysql/events/by-range', [\App\Controllers\ApiMysqlEventsController::class, 'listByRange']);
$router->get('/api/mysql/events/get', [\App\Controllers\ApiMysqlEventsController::class, 'getById']);
$router->post('/api/mysql/events/create', [\App\Controllers\ApiMysqlEventsController::class, 'create']);
$router->post('/api/mysql/events/update', [\App\Controllers\ApiMysqlEventsController::class, 'update']);
$router->post('/api/mysql/events/delete', [\App\Controllers\ApiMysqlEventsController::class, 'delete']);
$router->post('/api/mysql/events/done', [\App\Controllers\ApiMysqlEventsController::class, 'setDone']);
$router->post('/api/mysql/events/urgent', [\App\Controllers\ApiMysqlEventsController::class, 'setUrgent']);


// favicon без 404
$router->get('/favicon.ico', function(){
    header('Content-Type: image/x-icon');
    http_response_code(204);
});


// ---- API V2 (table-like) ----
$router->get('/api/events/by-date', [\App\Controllers\ApiEventsController::class, 'byDate']);
$router->get('/api/events/by-range', [\App\Controllers\ApiEventsController::class, 'byRange']);


$router->get('/api/events/get', [\App\Controllers\ApiEventsController::class, 'get']);
$router->get('/api/events/search', [\App\Controllers\ApiEventsController::class, 'search']);
$router->post('/api/events/create', [\App\Controllers\ApiEventsController::class, 'create']);
$router->post('/api/events/update', [\App\Controllers\ApiEventsController::class, 'update']);
$router->post('/api/events/delete', [\App\Controllers\ApiEventsController::class, 'delete']);
$router->post('/api/events/done', [\App\Controllers\ApiEventsController::class, 'done']);
$router->post('/api/events/urgent', [\App\Controllers\ApiEventsController::class, 'urgent']);

// ---- Backup API (export/import) ----
$router->get('/api/backup/export', [\App\Controllers\ApiBackupController::class, 'export']);
$router->post('/api/backup/import', [\App\Controllers\ApiBackupController::class, 'import']);
$router->get('/api/backup/diag', [\App\Controllers\ApiBackupController::class, 'diag']);

// Legacy aliases (kept for compatibility)
// $router->get('/api/events', [\App\Controllers\ApiBackupController::class, 'export']);
$router->get('/api/events', [\App\Controllers\ApiBackupController::class, 'events']);
$router->post('/api/events/store', [\App\Controllers\ApiBackupController::class, 'import']);
$router->get('/api/events/diag', [\App\Controllers\ApiBackupController::class, 'diag']);

$router->resolve();

