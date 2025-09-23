<?php
declare(strict_types=1);

namespace App\Models;

interface EventRepositoryInterface {
    public function create(array $data): array;
    public function updateById(string $id, array $data): array;
    public function deleteById(string $id): bool;
    public function getById(string $id): ?array;
    public function listByDate(string $date): array;
    public function listByRange(string $from, string $to): array;
}
