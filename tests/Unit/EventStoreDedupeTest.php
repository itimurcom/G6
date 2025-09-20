<?php
declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Models\EventStore;

final class EventStoreDedupeTest extends TestCase
{
    public function testDedupeKeepsLastOccurrenceById(): void
    {
        $s = new EventStore();
        $input = [
            "2025-09-14" => [
                ["id" => "X", "title" => "Old", "time" => "09:00", "type" => "evt", "owner" => ""],
                ["id" => "Y", "title" => "Keep", "time" => "10:00", "type" => "evt", "owner" => ""],
            ],
            "2025-09-15" => [
                ["id" => "X", "title" => "New", "time" => "11:00", "type" => "evt", "owner" => ""],
                ["title" => "NoId", "time" => "12:00", "type" => "evt", "owner" => ""],
            ],
        ];
        $out = $s->dedupe($input);
        $this->assertSame("New", $out["2025-09-15"][0]["title"], "Last X should remain");
        $this->assertSame("Keep", $out["2025-09-14"][0]["title"]);
        $this->assertCount(1, array_filter($out["2025-09-14"], fn($e) => isset($e["id"]) && $e["id"]==="Y"));
        $this->assertCount(1, array_filter($out["2025-09-15"], fn($e) => !isset($e["id"]) || $e["id"]===""));
    }
}
