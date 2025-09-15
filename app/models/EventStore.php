<?php
namespace App\Models;

class EventStore {
    private string $file;

    public function __construct(?string $file = null) {
        $root = dirname(__DIR__, 2);
        $default = $root . '/storage/data/db.json';
        // If provided $file is relative, join with project root
        if ($file && !str_starts_with($file, '/') && !preg_match('/^[A-Za-z]:\\\\/', $file)) {
            $file = $root . '/' . ltrim($file, '/');
        }
        $this->file = $file ?: $default;
    }

    public function path(): string { return $this->file; }

    public function ensureFile(): void {
        $dir = dirname($this->file);
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        if (!is_file($this->file)) @file_put_contents($this->file, "{}\n", LOCK_EX);
    }

    private static function array_is_list_compat(array $a): bool {
        if (function_exists('array_is_list')) return \array_is_list($a);
        $i=0; foreach ($a as $k=>$_){ if ($k!==$i++) return false; } return true;
    }

    public function read(): array {
        $this->ensureFile();
        $json = @file_get_contents($this->file);
        $data = json_decode($json ?: "{}", true);
        if (!is_array($data)) return [];
        if (self::array_is_list_compat($data)) return []; // [] -> {}
        return $data;
    }

    public function write(array $store): bool {
        $this->ensureFile();

        // Гарантуємо коренем об’єкт
        if (self::array_is_list_compat($store)) $store = [];

        $dir  = dirname($this->file);
        $json = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";

        // 1) Унікальний тимчасовий файл
        $tmp = @tempnam($dir, 'dbjson_');
        if ($tmp === false) {
            // якщо вже на цьому етапі щось не так — прямий запис з LOCK_EX
            return @file_put_contents($this->file, $json, LOCK_EX) !== false;
        }

        // 2) Запис у tmp під LOCK_EX
        $fh = @fopen($tmp, 'c+');
        if (!$fh) { @unlink($tmp); return false; }
        if (!flock($fh, LOCK_EX)) { fclose($fh); @unlink($tmp); return false; }

        ftruncate($fh, 0);
        $w1 = @fwrite($fh, $json);
        @fflush($fh);
        @flock($fh, LOCK_UN);
        @fclose($fh);

        if ($w1 === false) { @unlink($tmp); return false; }
        @chmod($tmp, 0664);

        // 3) Глобальний м’ютекс на операцію заміни файлу
        $lockPath = $this->file . '.lock';
        $lk = @fopen($lockPath, 'c');
        if ($lk) { @flock($lk, LOCK_EX); @chmod($lockPath, 0664); }

        // 4) Безпечна заміна: rename або fallbacks
        $ok = @rename($tmp, $this->file);               // POSIX: атомарна заміна
        if (!$ok) {
            @unlink($this->file);                       // Windows/WSL інколи потребує unlink
            $ok = @rename($tmp, $this->file);
            if (!$ok) {
                // останній шанс: прямий запис поверх
                $ok = @file_put_contents($this->file, $json, LOCK_EX) !== false;
                @unlink($tmp);
            }
        }

        if ($lk) { @flock($lk, LOCK_UN); @fclose($lk); }
        return $ok;
    }
}
