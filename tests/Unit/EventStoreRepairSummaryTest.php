<?php
declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Models\EventStore;

final class EventStoreRepairSummaryTest extends TestCase
{
    private string $tmpPath;
    protected function setUp(): void
    {
        $this->tmpPath = sys_get_temp_dir().'/db_'.bin2hex(random_bytes(4)).'.json';
        @unlink($this->tmpPath);
        file_put_contents($this->tmpPath, "{}");
    }
    protected function tearDown(): void
    {
        @unlink($this->tmpPath);
    }

    public function testRepairDryRunAndApply(): void
    {
        $store = new EventStore($this->tmpPath);
        // write raw store with duplicates & no-id
        $raw = [
            "2025-09-14" => [
                ["id" => "X", "title" => "old", "time"=>"08:00", "owner"=>"", "type"=>"evt"],
                ["title" => "noid", "time"=>"09:00", "owner"=>"", "type"=>"evt"]
            ],
            "2025-09-15" => [
                ["id" => "X", "title" => "new", "time"=>"10:00", "owner"=>"", "type"=>"evt"]
            ]
        ];
        // direct write
        $store->write($raw);

        $dry = $store->repairSummary(false);
        $this->assertTrue($dry["ok"]);
        $this->assertTrue($dry["dry_run"]);
        $this->assertGreaterThanOrEqual(1, $dry["dups_removed"]);
        $this->assertGreaterThanOrEqual(1, $dry["ids_assigned"]);

        $apply = $store->repairSummary(true);
        $this->assertTrue($apply["ok"]);
        $this->assertFalse($apply["dry_run"]);

        $again = $store->repairSummary(false);
        $this->assertSame(0, $again["dups_removed"]);
    }
}
