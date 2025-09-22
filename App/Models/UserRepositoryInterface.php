<?php
namespace App\Models;

interface UserRepositoryInterface
{
    public function findById(int $id): ?array;
    public function findByLogin(string $login): ?array;
    public function create(array $data): int;
}
