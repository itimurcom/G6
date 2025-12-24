<?php
declare(strict_types=1);

namespace App\Models;

interface EventRepositoryInterface {
    // Змінено: додано string $date
    public function create(string $date, array $data): array;
    
    public function updateById(string $id, array $data): array;
    public function deleteById(string $id): bool;
    public function getById(string $id): ?array;
    public function listByDate(string $date): array;
    public function listByRange(string $from, string $to): array;
    
    // Додано метод пошуку, якого не вистачало в інтерфейсі
    public function search(array $filters, int $limit, int $offset): array;
}