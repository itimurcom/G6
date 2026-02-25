<?php

$autoload = __DIR__ . '/../vendor/autoload.php';
if (!is_file($autoload)) {
    http_response_code(500);
    error_log('[bootstrap] vendor/autoload.php not found: ' . $autoload);
    exit('Application bootstrap error.');
}
require_once $autoload;
            
// === ROLE REGISTRATION LOGIC (sanitizer for /register) ===
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $path = strtok($_SERVER['REQUEST_URI'] ?? '/', '?') ?: '/';
    if ($path === '/register') {
        $cfg = @include dirname(__DIR__) . '/config/auth.php';
        $mode = $cfg['registration']['mode'] ?? 'invite';
        $allow = $cfg['registration']['allow_roles'] ?? ['user'];
        $code  = $cfg['registration']['admin_invite_code'] ?? 'CHANGE_ME_ADMIN_CODE';

        $requested = isset($_POST['role']) ? (string)$_POST['role'] : 'user';
        $adminCode = isset($_POST['admin_code']) ? (string)$_POST['admin_code'] : '';

        $final = 'user';
        if ($mode === 'dev') {
            if (in_array($requested, $allow, true)) $final = $requested;
        } elseif ($mode === 'invite') {
            if ($requested === 'admin' && is_string($adminCode) && $adminCode !== '' && hash_equals($code, $adminCode)) {
                $final = 'admin';
            }
        } elseif ($mode === 'bootstrap') {
            if ($requested === 'admin') {
                try {
                    if (!\App\Core\Auth::adminsExist()) {
                        $final = 'admin';
                    }
                } catch (\Throwable $e) {
                    // Fail closed: keep role as user, do not crash request
                    error_log('[register/bootstrap] adminsExist() failed: ' . $e->getMessage());
                    $final = 'user';
                }
            }
        }
        $_POST['role'] = $final;
        // Back-compat flag
        $_POST['is_admin'] = ($final === 'admin') ? '1' : '0';
    }
}
// === /ROLE REGISTRATION LOGIC ===


use App\Core\Request;
use App\Core\Router;
use App\Controllers\AuthController;
use App\Core\Auth;

$request = new Request();
$router  = new Router($request);

// favicon без 404
$router->get('/favicon.ico', function(){
    header('Content-Type: image/x-icon');
    http_response_code(204);
});

$router->get('/',                           [\App\Controllers\HomeController::class,            'planning']);
$router->get('/calendar',                   [\App\Controllers\CalendarController::class,        'index']);
$router->get('/today',                      [\App\Controllers\TodayController::class,          'index']);
$router->get('/cabinet',                    [\App\Controllers\CabinetController::class,         'cabinet']);


// ---- API V2 (table-like) ----
$router->get('/api/events/by-date',         [\App\Controllers\ApiEventsController::class,       'byDate']);
$router->get('/api/events/by-range',        [\App\Controllers\ApiEventsController::class,       'byRange']);
$router->get('/api/events/updates',         [\App\Controllers\ApiEventsController::class,       'updates']);
$router->get('/api/notify/unseen',        [\App\Controllers\ApiNotifyController::class,       'unseen']);
$router->get('/api/notify/seen-by-event', [\App\Controllers\ApiNotifyController::class,       'seenByEvent']);
$router->post('/api/notify/viewed',       [\App\Controllers\ApiNotifyController::class,       'viewed']);
$router->post('/api/notify/seen',         [\App\Controllers\ApiNotifyController::class,       'seen']);
$router->post('/api/notify/seen-all',     [\App\Controllers\ApiNotifyController::class,       'seenAll']);
$router->get('/api/audit/list',             [\App\Controllers\ApiAuditController::class,     'list']); // AUDIT: ADD ONLY
$router->get('/api/events/get',             [\App\Controllers\ApiEventsController::class,       'get']);
$router->get('/api/events/search',          [\App\Controllers\ApiEventsController::class,       'search']);

$router->post('/api/events/create',         [\App\Controllers\ApiEventsController::class,       'create']);
$router->post('/api/events/update',         [\App\Controllers\ApiEventsController::class,       'update']);
$router->post('/api/events/delete',         [\App\Controllers\ApiEventsController::class,       'delete']);
$router->post('/api/events/done',           [\App\Controllers\ApiEventsController::class,       'done']);
$router->post('/api/events/urgent',         [\App\Controllers\ApiEventsController::class,       'urgent']);
$router->post('/api/events/close',          [\App\Controllers\ApiEventsController::class,       'close']);
$router->post('/api/events/backfill-authors', [\App\Controllers\ApiEventsController::class,       'backfillAuthors']);
// ---- Users API ----
$router->get('/api/users/get'
,          [\App\Controllers\ApiUsersController::class, 'get']);
$router->get('/api/users/search',      [\App\Controllers\ApiUsersController::class, 'search']);
$router->get('/api/users/name',         [\App\Controllers\ApiUserNameController::class, 'name']);
$router->get('/api/users/me',           [\App\Controllers\ApiUsersController::class, 'me']);



// Legacy V1 endpoints removed after V2 cutover (hard delete).
// ---- Backup API (export/import) ----
$router->get('/api/backup/export',          [\App\Controllers\ApiBackupController::class,       'export']);
$router->get('/api/backup/diag',            [\App\Controllers\ApiBackupController::class,       'diag']);
$router->post('/api/backup/import',         [\App\Controllers\ApiBackupController::class,       'import']);



$router->post('/cabinet/profile/update',    [\App\Controllers\CabinetController::class, 'updateProfile']);
$router->post('/cabinet/password/change',   [\App\Controllers\CabinetController::class, 'changePassword']);
// Admin: manage users from Cabinet
$router->post('/cabinet/users/update',      [\App\Controllers\CabinetController::class, 'adminUpdateUser']);
$router->post('/cabinet/users/password',   [\App\Controllers\CabinetController::class, 'adminChangeUserPassword']);

$router->get('/logout',                    [\App\Controllers\AuthController::class, 'logout']);

// === Users/Auth (MVP) ===
$router->get('/login',    [\App\Controllers\AuthController::class, 'loginForm']);
$router->post('/login',   [\App\Controllers\AuthController::class, 'login']);
$router->get('/register', [\App\Controllers\AuthController::class, 'registerForm']);
$router->post('/register',[\App\Controllers\AuthController::class, 'register']);
$router->post('/logout',  [\App\Controllers\AuthController::class, 'logout']);

// // Secure /cabinet behind auth
// $router->get('/cabinet', function($req){
//     if (!\App\Core\Auth::check()) { header('Location: /login', true, 302); return ''; }
//     return (new \App\Controllers\CabinetController())->cabinet($req);
// });

$router->get('/password/setup', [\App\Controllers\AuthController::class, 'passwordSetupForm']);
$router->post('/password/setup', [\App\Controllers\AuthController::class, 'passwordSetupSave']);

// Exact paths that require auth (no subpaths)
$_PROTECTED = ['/', '/calendar', '/calendar/', '/today', '/today/', '/cabinet', '/cabinet/'];

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';

if (strpos($path, '/api/') === 0) {
    if (!\App\Core\Auth::check()) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'      => false,
            'error'   => 'unauthorized',
            'message' => 'Authentication required',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

if (!\App\Core\Auth::check() && in_array($path, $_PROTECTED, true)) {
    header('Location: /login', true, 302);
    exit;
}
$router->resolve();


function console_log($value, $label = 'PHP') {
    $js = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    echo "<script>console.log('[{$label}]', {$js});</script>";
}