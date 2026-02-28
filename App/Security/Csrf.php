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
            self::setSessionToken($token);
            return $token;
        }

        $token = (string)$cookie;
        self::setSessionToken($token);
        return $token;
    }

    /**
     * Ensure that CSRF cookie exists without returning its value.
     */
    public static function ensureToken(): void
    {
        self::token();
    }

    private static function setCookie(string $token): void
    {
        // 7 days lifetime is enough for normal sessions
        setcookie(self::COOKIE, $token, [
            'expires'  => time() + 86400 * 7,
            'path'     => '/',
            'domain'   => '',
            'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'httponly' => false,
            'samesite' => 'Lax',
        ]);
        // Also keep superglobal in sync for current request
        $_COOKIE[self::COOKIE] = $token;
    }

    /**
     * Validate CSRF token coming from classic HTML form field.
     */
    public static function validate(?string $provided): bool
    {
        if (!is_string($provided) || $provided === '') {
            return false;
        }

        $cookie = $_COOKIE[self::COOKIE] ?? '';
        if (is_string($cookie) && $cookie !== '' && hash_equals($cookie, $provided)) {
            return true;
        }

        $sessionToken = self::sessionToken();
        return is_string($sessionToken)
            && $sessionToken !== ''
            && hash_equals($sessionToken, $provided);
    }

    /**
     * Validate CSRF token passed in X-CSRF-Token header (used by fetch()).
     */
    public static function validateHeader(): bool
    {
        $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if (!is_string($header) || $header === '') {
            return false;
        }

        $cookie = $_COOKIE[self::COOKIE] ?? '';
        if (is_string($cookie) && $cookie !== '' && hash_equals($cookie, $header)) {
            return true;
        }

        $sessionToken = self::sessionToken();
        return is_string($sessionToken)
            && $sessionToken !== ''
            && hash_equals($sessionToken, $header);
    }

    /**
     * Validate token from either form field or header.
     */
    public static function validateAny(?string $provided): bool
    {
        if (self::validate($provided)) {
            return true;
        }
        return self::validateHeader();
    }


    private static function setSessionToken(string $token): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return;
        }
        $_SESSION['_csrf_token'] = $token;
    }

    private static function sessionToken(): string
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return '';
        }
        $token = $_SESSION['_csrf_token'] ?? '';
        return is_string($token) ? $token : '';
    }

}
