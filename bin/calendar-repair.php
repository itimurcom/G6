#!/usr/bin/env php
<?php
declare(strict_types=1);

use App\Models\EventStore;

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Normalize + dedupe the store (same as /api/repair but via CLI).
 *
 * Usage:
 *   php bin/calendar-repair.php [--apply]
 */
final class RepairCli
{
    private bool $apply;

    public function __construct(array $argv)
    {
        $this->apply = in_array('--apply', $argv, true);
    }

    public function run(): int
    {
        $es = new EventStore();
        $summary = $es->repairSummary($this->apply);
        echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
        return $summary['ok'] ? 0 : 1;
    }
}

exit((new RepairCli($argv))->run());
