<?php
declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Models\EventStore;

final class EventStoreNormalizeTest extends TestCase
{
    public function testNormalizeAssignsIdsAndTypes(): void
    {
        $store = new EventStore(); // path not used in normalize()
        $input = [
            "2025-09-14" => [
                [
                    "time" => 600, // int -> should become string
                    "title" => "A",
                    "owner" => "O",
                    "type" => "evt",
                    "urgent" => 1, // -> true
                    "done" => 0,   // -> false
                    "user_id" => "3" // -> int
                ],
                [
                    "id" => "fixed-id-1",
                    "time" => "07:30",
                    "title" => "B",
                    "owner" => "O2",
                    "type" => "mi",
                    "urgent" => false,
                    "done" => true,
                    "user_id" => 0
                ]
            ]
        ];

        $norm = $store->normalizeStore($input);

        $this->assertArrayHasKey("2025-09-14", $norm);
        $this->assertCount(2, $norm["2025-09-14"]);
        $a = $norm["2025-09-14"][0];
        $b = $norm["2025-09-14"][1];

        $this->assertArrayHasKey("id", $a);
        $this->assertIsString($a["id"]);
        $this->assertSame("evt", $a["type"]);
        $this->assertTrue($a["urgent"]);
        $this->assertFalse($a["done"]);
        $this->assertSame(3, $a["user_id"]);
        $this->assertIsString($a["time"]);

        $this->assertSame("fixed-id-1", $b["id"]);
        $this->assertTrue($b["done"]);
    }
}
