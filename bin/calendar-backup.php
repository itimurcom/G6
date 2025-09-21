#!/usr/bin/env php
<?php
declare(strict_types=1);

use App\Models\EventStore;

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Backup calendar storage (db.json) with optional compression and retention.
 *
 * Usage:
 *   php bin/calendar-backup.php [--source=PATH] [--dest=DIR] [--compress[=gz|none]]
 *                               [--keep-daily=N] [--keep-weekly=N] [--keep-monthly=N]
 *                               [--dry-run]
 *
 * Defaults:
 *   --source     = EventStore default path (storage/data/db.json)
 *   --dest       = storage/backups
 *   --compress   = gz
 *   --keep-daily = 7
 *   --keep-weekly= 8
 *   --keep-monthly=6
 */
final class BackupCli
{
    private string $source;
    private string $dest;
    private string $compress;
    private int $keepDaily;
    private int $keepWeekly;
    private int $keepMonthly;
    private bool $dryRun;
    private string $logFile;

    public function __construct(array $argv)
    {
        $es = new EventStore();
        $defaults = [
            'source' => $es->getPath(),
            'dest' => __DIR__ . '/../storage/backups',
            'compress' => 'gz',
            'keep-daily' => '7',
            'keep-weekly' => '8',
            'keep-monthly' => '6',
            'dry-run' => '0',
        ];
        $opts = $this->parseArgs($argv, $defaults);

        $this->source = $opts['source'];
        $this->dest = $opts['dest'];
        $this->compress = strtolower($opts['compress'] ?? 'gz');
        $this->keepDaily = (int)$opts['keep-daily'];
        $this->keepWeekly = (int)$opts['keep-weekly'];
        $this->keepMonthly = (int)$opts['keep-monthly'];
        $this->dryRun = in_array(strtolower((string)$opts['dry-run']), ['1','true','yes'], true);
        $this->logFile = __DIR__ . '/../storage/logs/backup.log';
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
        $this->ensureDir(dirname($this->source));
        $this->ensureDir($this->dest);
        $this->ensureDir(dirname($this->logFile));

        if (!file_exists($this->source)) {
            $this->log("ERROR: source not found: {$this->source}");
            return 2;
        }

        $stamp = (new DateTime('now', new DateTimeZone('Europe/Kyiv')))->format('Ymd-His');
        $baseName = "db-{$stamp}.json";
        $outPath = rtrim($this->dest, '/').'/'.$baseName;
        $data = file_get_contents($this->source);
        if ($data === false) {
            $this->log("ERROR: cannot read source: {$this->source}");
            return 3;
        }
        // validate JSON
        $decoded = json_decode($data, true);
        if (!is_array($decoded)) {
            $this->log("ERROR: source is not valid JSON: {$this->source}");
            return 4;
        }

        $written = 0;
        if ($this->compress === 'gz') {
            $outPath .= '.gz';
            $payload = gzencode($data, 9);
            if ($payload === false) {
                $this->log("ERROR: gzencode failed");
                return 5;
            }
            if (!$this->dryRun) {
                $written = file_put_contents($outPath, $payload, LOCK_EX);
            }
        } else {
            if (!$this->dryRun) {
                $written = file_put_contents($outPath, $data, LOCK_EX);
            }
        }

        $this->log(($this->dryRun ? '[DRY] ' : '')."Backup created: {$outPath} bytes=".($written ?: strlen((string)$data)));
        $actions = $this->applyRetention($this->dest, $this->keepDaily, $this->keepWeekly, $this->keepMonthly);
        foreach ($actions as $a) {
            $this->log(($this->dryRun ? '[DRY] ' : '').$a);
        }

        echo json_encode([
            'ok' => true,
            'dry_run' => $this->dryRun,
            'backup' => $outPath,
            'written' => $written,
            'retention' => $actions,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT).PHP_EOL;
        return 0;
    }

    private function ensureDir(string $dir): void
    {
        if (!is_dir($dir)) { @mkdir($dir, 0777, true); }
    }

    private function listBackups(string $dir): array
    {
        $files = glob(rtrim($dir, '/').'/db-*.json*');
        $list = [];
        foreach ($files as $f) {
            $fn = basename($f);
            if (!preg_match('/^db-(\d{8})-(\d{6})\.json(\.gz)?$/', $fn, $m)) continue;
            $date = $m[1]; $time = $m[2];
            $ts = DateTime::createFromFormat('Ymd-His', $date.'-'.$time, new DateTimeZone('Europe/Kyiv'));
            if (!$ts) continue;
            $list[] = ['path' => $f, 'ts' => $ts, 'ts_str' => $ts->format('c')];
        }
        usort($list, fn($a,$b) => $b['ts'] <=> $a['ts']); // newest first
        return $list;
    }

    private function applyRetention(string $dir, int $keepDaily, int $keepWeekly, int $keepMonthly): array
    {
        $actions = [];
        $list = $this->listBackups($dir);
        if (empty($list)) return ["No backups found for retention."];

        $keep = [];
        $now = new DateTime('now', new DateTimeZone('Europe/Kyiv'));

        // Daily: keep last N distinct days
        $days = [];
        foreach ($list as $item) {
            $d = $item['ts']->format('Y-m-d');
            if (!isset($days[$d])) $days[$d] = $item;
        }
        $dailyKept = array_slice(array_values($days), 0, $keepDaily);
        foreach ($dailyKept as $it) $keep[$it['path']] = true;

        // Weekly: for items older than last daily window, keep last N distinct ISO weeks
        $cutoffDaily = clone $now; $cutoffDaily->modify('-'.max(0,$keepDaily-1).' days'); // inclusive window
        $weeks = [];
        foreach ($list as $item) {
            if ($item['ts'] >= $cutoffDaily) continue;
            $wk = $item['ts']->format('o-W');
            if (!isset($weeks[$wk])) $weeks[$wk] = $item;
        }
        $weeklyKept = array_slice(array_values($weeks), 0, $keepWeekly);
        foreach ($weeklyKept as $it) $keep[$it['path']] = true;

        // Monthly: for items older than weekly window, keep last N distinct months
        $cutoffWeekly = clone $now; $cutoffWeekly->modify('-'.(7*max(0,$keepWeekly)).' days');
        $months = [];
        foreach ($list as $item) {
            if ($item['ts'] >= $cutoffWeekly) continue;
            $mo = $item['ts']->format('Y-m');
            if (!isset($months[$mo])) $months[$mo] = $item;
        }
        $monthlyKept = array_slice(array_values($months), 0, $keepMonthly);
        foreach ($monthlyKept as $it) $keep[$it['path']] = true;

        // Everything else → delete
        foreach ($list as $item) {
            $p = $item['path'];
            if (isset($keep[$p])) continue;
            if ($this->dryRun) {
                $actions[] = "Would delete: {$p}";
            } else {
                if (@unlink($p)) $actions[] = "Deleted: {$p}";
            }
        }
        if (empty($actions)) $actions[] = "Retention OK: nothing to remove.";
        return $actions;
    }

    private function log(string $line): void
    {
        $ts = (new DateTime('now', new DateTimeZone('Europe/Kyiv')))->format('Y-m-d H:i:s');
        $msg = "[$ts] $line
";
        @file_put_contents($this->logFile, $msg, FILE_APPEND);
    }
}

exit((new BackupCli($argv))->run());
