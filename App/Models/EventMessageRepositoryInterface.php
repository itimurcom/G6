<?php
declare(strict_types=1);

namespace App\Models;

interface EventMessageRepositoryInterface
{
    public function listByEvent(string $eventId, bool $includeDeleted = false, int $limit = 200, int $offset = 0): array;

    public function countByEvent(string $eventId, bool $includeDeleted = false): int;

    public function getById(int $id): ?array;

    public function create(string $eventId, int $userId, string $messageText): array;

    public function updateById(int $id, string $messageText, int $editorUserId): ?array;

    public function softDeleteById(int $id, int $deleterUserId): ?array;
}
