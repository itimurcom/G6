<?php
namespace App\Core;

class Request {
    public function method(): string {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }
    public function path(): string {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $qPos = strpos($uri, '?');
        if ($qPos !== false) $uri = substr($uri, 0, $qPos);
        if ($uri !== '/' && substr($uri, -1) === '/') $uri = rtrim($uri, '/');
        return $uri ?: '/';
    }
    public function input(string $key, $default = null) {
        return $_REQUEST[$key] ?? $default;
    }
}
