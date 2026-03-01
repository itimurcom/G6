<?php
declare(strict_types=1);

namespace App\Security;

final class DocumentCrypto
{
    /** @var array<string,mixed>|null */
    private ?array $config = null;

    /**
     * @return array{cipher:string,key_version:int,iv:string,auth_tag:string,ciphertext:string}
     */
    public function encrypt(string $plaintext): array
    {
        if ($plaintext === '') {
            throw new \InvalidArgumentException('plaintext required');
        }

        $cfg = $this->encryptionConfig();
        $cipher = (string)($cfg['cipher'] ?? 'aes-256-gcm');
        $keyVersion = (int)($cfg['current_key_version'] ?? 0);
        if ($keyVersion <= 0) {
            throw new \RuntimeException('documents.current_key_version missing');
        }

        $key = $this->resolveKeyMaterial($keyVersion);
        $ivLength = openssl_cipher_iv_length($cipher);
        if (!is_int($ivLength) || $ivLength <= 0) {
            throw new \RuntimeException('unsupported document cipher');
        }

        $iv = random_bytes($ivLength);
        $authTag = '';
        $ciphertext = openssl_encrypt($plaintext, $cipher, $key, OPENSSL_RAW_DATA, $iv, $authTag);
        if (!is_string($ciphertext) || $ciphertext === '') {
            throw new \RuntimeException('document_encrypt_failed');
        }
        if ($authTag === '') {
            throw new \RuntimeException('document_auth_tag_missing');
        }

        return [
            'cipher' => $cipher,
            'key_version' => $keyVersion,
            'iv' => $iv,
            'auth_tag' => $authTag,
            'ciphertext' => $ciphertext,
        ];
    }

    public function decrypt(string $ciphertext, string $iv, string $authTag, int $keyVersion, ?string $cipher = null): string
    {
        if ($ciphertext === '') {
            throw new \InvalidArgumentException('ciphertext required');
        }
        if ($iv === '' || $authTag === '') {
            throw new \InvalidArgumentException('iv and auth_tag required');
        }
        if ($keyVersion <= 0) {
            throw new \InvalidArgumentException('key_version required');
        }

        $cfg = $this->encryptionConfig();
        $cipher = trim((string)($cipher ?? ($cfg['cipher'] ?? 'aes-256-gcm')));
        if ($cipher === '') {
            throw new \RuntimeException('document cipher missing');
        }

        $key = $this->resolveKeyMaterial($keyVersion);
        $plaintext = openssl_decrypt($ciphertext, $cipher, $key, OPENSSL_RAW_DATA, $iv, $authTag);
        if (!is_string($plaintext) || $plaintext === '') {
            throw new \RuntimeException('document_decrypt_failed');
        }

        return $plaintext;
    }

    /** @return array<string,mixed> */
    private function encryptionConfig(): array
    {
        if ($this->config !== null) {
            return $this->config;
        }

        $cfg = require __DIR__ . '/../../config/files.php';
        $docs = is_array($cfg['documents'] ?? null) ? $cfg['documents'] : [];
        $enc = is_array($docs['encryption'] ?? null) ? $docs['encryption'] : [];
        $this->config = $enc;
        return $this->config;
    }

    private function resolveKeyMaterial(int $keyVersion): string
    {
        $cfg = $this->encryptionConfig();
        $keys = is_array($cfg['keys'] ?? null) ? $cfg['keys'] : [];
        $raw = (string)($keys[$keyVersion] ?? '');
        $raw = trim($raw);
        if ($raw === '') {
            throw new \RuntimeException('document encryption key missing for version ' . $keyVersion);
        }

        if (str_starts_with($raw, 'base64:')) {
            $decoded = base64_decode(substr($raw, 7), true);
            if (!is_string($decoded) || $decoded === '') {
                throw new \RuntimeException('document encryption key base64 decode failed');
            }
            $raw = $decoded;
        }

        if (strlen($raw) < 32) {
            $raw = hash('sha256', $raw, true);
        }

        if (strlen($raw) > 32) {
            $raw = substr($raw, 0, 32);
        }

        return $raw;
    }
}
