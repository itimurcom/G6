<?php
namespace App\Models;

interface UserRepositoryInterface
{
    public function findById(int $id): ?array;
    public function findByEmail(string $email): ?array;
    public function create(array $data): int;
}
