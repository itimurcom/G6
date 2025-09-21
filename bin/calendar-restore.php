#!/usr/bin/env php
<?php
declare(strict_types=1);

use App\Models\EventStore;

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Restore calendar storage from a backup file (json or json.gz).
 *
 * Usage:
 *   php bin/calendar-restore.php --file=PATH [--dest=PATH] [--dry-run]
 *
 * Defaults:
 *   --dest = EventStore default path (storage/data/db.json)
 */
final class RestoreCli
{
    private string $file;
    private string $dest;
    private bool $dryRun;

    public function __construct(array $argv)
    {
        $es = new EventStore();
        $defaults = [
            'file' => '',
            'dest' => $es->getPath(),
            'dry-run' => '0',
        ];
        $opts = $this->parseArgs($argv, $defaults);
        $this->file = (string)$opts['file'];
        $this->dest = (string)$opts['dest'];
        $this->dryRun = in_array(strtolower((string)$opts['dry-run']), ['1','true','yes'], true);
    }

    private function parseArgs(array $argv, array $defaults): array
    {
        $opts = $defaults;
        foreach (array_slice($argv, 1) as $arg) {
            if (preg_match('/^--([a-zA-Z0-9_-]+)=(.*)$/', $arg, $m)) {
                $opts[$m[1]] = $m[2];
            } elseif (preg_match('/^--([a-zA-Z0-9_-]+)$/', $arg, $m)) {
                $opts[$m[1]] = '1';
            }
        }
        return $opts;
    }

    public function run(): int
    {
        if ($this->file === '' || !file_exists($this->file)) {
            fwrite(STDERR, "ERROR: --file is required and must exist\n");
            return 2;
        }
        $payload = file_get_contents($this->file);
        if ($payload === false) {
            fwrite(STDERR, "ERROR: cannot read file: {$this->file}\n");
            return 3;
        }
        if (preg_match('/\.gz$/', $this->file)) {
            $payload = gzdecode($payload);
            if ($payload === false) {
                fwrite(STDERR, "ERROR: gzdecode failed\n");
                return 4;
            }
        }
        $json = json_decode($payload, true);
        if (!is_array($json)) {
            fwrite(STDERR, "ERROR: file does not contain valid JSON store\n");
            return 5;
        }

        // safety backup
        $bak = $this->dest.'.bak-'.date('Ymd-His');
        if ($this->dryRun) {
            echo json_encode(['ok'=>true,'dry_run'=>true,'would_write'=>$this->dest,'backup'=>$bak], JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE).PHP_EOL;
            return 0;
        }

        if (file_exists($this->dest)) {
            @copy($this->dest, $bak);
        }
        // Write via EventStore to ensure atomic move
        $es = new EventStore($this->dest);
        $es->write($json);

        echo json_encode(['ok'=>true,'path'=>$this->dest,'backup'=>$bak], JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE).PHP_EOL;
        return 0;
    }
}

exit((new RestoreCli($argv))->run());
