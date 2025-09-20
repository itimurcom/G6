<?php
// file: App/Middleware/AuthMiddleware.php
namespace App\Middleware;

use App\Core\Auth;

class AuthMiddleware
{
    /**
     * @param callable $next The next handler in the chain
     * @param array $options ['except' => ['/login', '/login/', '/register']]
     */
    public function handle(callable $next, array $options = []): void
    {
        $except = $options['except'] ?? ['/login', '/login/', '/auth/callback'];
        $uri = strtok($_SERVER['REQUEST_URI'], '?');

        if (!in_array($uri, $except, true)) {
            if (!\App\Core\Auth::check()) {
                header('Location: /login/', true, 302);
                exit;
            }
        }

        $next();
    }
}
