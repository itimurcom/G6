<?php
declare(strict_types=1);

namespace App\Security;

final class Csrf
{
    public const COOKIE = 'XSRF-TOKEN';

    public static function token(): string
    {
        $cookie = $_COOKIE[self::COOKIE] ?? '';
        if (!is_string($cookie) || $cookie === '') {
            $token = bin2hex(random_bytes(32));
            self::setCookie($token);
            return $token;
        }
        return $cookie;
    }

    public static function setCookie(string $token): void
    {
        @setcookie(self::COOKIE, $token, [
            'expires'  => time() + 86400 * 7,
            'path'     => '/',
            'domain'   => '',
            'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'httponly' => false,
            'samesite' => 'Lax',
        ]);
    }

    public static function validate(?string $provided): bool
    {
        $cookie = $_COOKIE[self::COOKIE] ?? '';
        return is_string($provided) && is_string($cookie) && $cookie !== '' && hash_equals($cookie, $provided);
    }
}
