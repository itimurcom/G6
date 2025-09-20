<?php
declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Models\EventStore;

final class EventStoreWriteDiffTest extends TestCase
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

    public function testCreateUpdateMoveDeleteAndIdempotence(): void
    {
        $store = new EventStore($this->tmpPath);

        // 1) Create
        $N1 = [
            "2025-09-14" => [
                ["id" => "A", "title" => "t1", "time" => "09:00", "owner" => "", "type"=>"evt"]
            ]
        ];
        $r1 = $store->writeDiff($N1);
        $this->assertTrue($r1["ok"]);
        $this->assertSame(1, $r1["created"]);
        $this->assertSame(0, $r1["updated"]);

        // 2) Update in-place
        $N2 = [
            "2025-09-14" => [
                ["id" => "A", "title" => "t2", "time" => "09:00", "owner" => "", "type"=>"evt"]
            ]
        ];
        $r2 = $store->writeDiff($N2);
        $this->assertSame(1, $r2["updated"]);
        $this->assertSame(0, $r2["created"]);

        // 3) Move to another day
        $N3 = [
            "2025-09-15" => [
                ["id" => "A", "title" => "t2", "time" => "09:00", "owner" => "", "type"=>"evt"]
            ]
        ];
        $r3 = $store->writeDiff($N3);
        $this->assertSame(1, $r3["moved"]);
        $this->assertSame(0, $r3["created"]);

        // 4) Delete
        $N4 = [
            "2025-09-15" => []
        ];
        $r4 = $store->writeDiff($N4);
        $this->assertSame(1, $r4["deleted"]);

        // 5) Idempotence
        $r5 = $store->writeDiff($N4);
        $this->assertSame(0, $r5["deleted"]);
        $this->assertSame(0, $r5["updated"]);
        $this->assertSame(0, $r5["created"]);
        $this->assertSame(0, $r5["moved"]);
    }
}
