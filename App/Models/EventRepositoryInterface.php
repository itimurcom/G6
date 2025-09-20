<?php
namespace App\Models;

interface EventRepositoryInterface
{
    /** Return event by id (with 'date' included) or null */
    public function getById(string $id): ?array;

    /** Create event, returns its id. $data must include 'date' (Y-m-d) */
    public function create(array $data): string;

    /** Update by id with partial $patch; returns true if changed */
    public function updateById(string $id, array $patch): bool;

    /** Delete by id */
    public function deleteById(string $id): bool;

    /** List events for a specific date (Y-m-d) */
    public function listByDate(string $date): array;

    /** List events for inclusive date range; returns date-keyed map { 'Y-m-d' => [ ... ] } */
    public function listByRange(string $startDate, string $endDate): array;

    /** Flexible search with optional filters (date/start/end, text, owner, type, urgent, done) */
    public function search(array $filters = [], int $limit = 200, int $offset = 0): array;

    /** Flag helpers */
    public function setDone(string $id, bool|int $done): bool;
    public function setUrgent(string $id, bool|int $urgent): bool;
}
