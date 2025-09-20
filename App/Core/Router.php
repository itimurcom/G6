<?php
namespace App\Core;

class Router {
    private Request $request;
    private array $routes = ['GET'=>[], 'POST'=>[]];

    public function __construct(Request $request) {
        $this->request = $request;
    }

    public function get(string $path, callable|array $handler): void {
        $this->routes['GET'][$path] = $handler;
    }
    public function post(string $path, callable|array $handler): void {
        $this->routes['POST'][$path] = $handler;
    }

    public function resolve(): void {
        $method = $this->request->method();
        $path   = $this->request->path();

        $handler = $this->routes[$method][$path] ?? null;
        if (!$handler) {
            http_response_code(404);
            echo "404 Not Found";
            return;
        }

        if (is_array($handler)) {
            [$class, $action] = $handler;
            $controller = new $class();
            echo call_user_func([$controller, $action], $this->request);
            return;
        }

        echo call_user_func($handler, $this->request);
    }
}
