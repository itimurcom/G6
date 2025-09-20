<?php
declare(strict_types=1);

namespace Tests\Feature;

use PHPUnit\Framework\TestCase;
use Tests\Doubles\TestableApiBackupController;

final class BackupApiExportImportTest extends TestCase
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

    public function testExportThenImportRoundtrip(): void
    {
        $ctrl = new TestableApiBackupController($this->tmpPath);

        // initial export
        $ctrl->events();
        $data = $ctrl->lastResponse;
        $this->assertIsArray($data);

        // import a store
        $ctrl->injectedBody = [
            "2025-09-14" => [
                ["id"=>"A","title"=>"t1","time"=>"08:00","owner"=>"","type"=>"evt"]
            ]
        ];
        $ctrl->store();
        $res = $ctrl->lastResponse;
        $this->assertTrue($res["ok"]);

        // export again and verify structure
        $ctrl->export();
        $exp = $ctrl->lastResponse;
        $this->assertArrayHasKey("2025-09-14", $exp);
        $this->assertCount(1, $exp["2025-09-14"]);
    }
}
