<?php
declare(strict_types=1);

namespace Tests\Feature;

use PHPUnit\Framework\TestCase;
use Tests\Doubles\TestableApiBackupController;
use App\Models\EventStore;

final class BackupApiRepairTest extends TestCase
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
        // Seed RAW store with duplicates and a no-id entry (so repair has work to do)
        $es = new EventStore($this->tmpPath);
        $raw = [
            "2025-09-14" => [
                ["id"=>"X","title"=>"old","time"=>"08:00","owner"=>"","type"=>"evt"]
            ],
            "2025-09-15" => [
                ["id"=>"X","title"=>"new","time"=>"09:00","owner"=>"","type"=>"evt"],
                ["title"=>"noid","time"=>"10:00","owner"=>"","type"=>"evt"]
            ]
        ];
        $es->write($raw);

        $ctrl = new TestableApiBackupController($this->tmpPath);

        // Dry-run repair
        $_GET["dry_run"] = "true";
        $ctrl->repair();
        $dry = $ctrl->lastResponse;
        $this->assertTrue($dry["ok"]);
        $this->assertTrue($dry["dry_run"]);
        $this->assertGreaterThanOrEqual(1, $dry["dups_removed"], "Should detect and report duplicates to remove");
        $this->assertGreaterThanOrEqual(1, $dry["ids_assigned"], "Should report assigning IDs to no-id entries");

        // Apply
        $_GET["dry_run"] = "false";
        $ctrl->repair();
        $apply = $ctrl->lastResponse;
        $this->assertTrue($apply["ok"]);
        $this->assertFalse($apply["dry_run"]);

        // After apply, a new dry-run should report zero changes
        $_GET["dry_run"] = "true";
        $ctrl->repair();
        $again = $ctrl->lastResponse;
        $this->assertSame(0, $again["dups_removed"]);
    }
}
